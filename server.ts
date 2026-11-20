import 'dotenv/config';
import cookieParser from 'cookie-parser';
import express from 'express';
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import {
  attachUser,
  requireAdmin,
  requireAuth,
  signRiderToken,
  verifyCsrfOrigin,
} from './server/auth.ts';
import {
  initializeFlutterwaveTransaction,
  initializePaystackTransaction,
  verifyFlutterwaveTransaction,
  verifyFlutterwaveWebhookHash,
  verifyPaystackTransaction,
  verifyPaystackWebhookSignature,
} from './server/payments.ts';
import { createRateLimiter } from './server/rateLimit.ts';
import { storeEngine } from './server/storeEngine.ts';
import type {
  ComplaintCategory,
  ComplaintStatus,
  DeliveryStatus,
  OrderStatus,
  PaymentMethodId,
} from './src/types/commerce.ts';

const PORT = 3000;
const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');
const RECEIPTS_DIR = path.join(UPLOADS_DIR, 'receipts');
const PRODUCTS_UPLOAD_DIR = path.join(UPLOADS_DIR, 'products');
const EVIDENCE_DIR = path.join(UPLOADS_DIR, 'evidence');
const RIDERS_UPLOAD_DIR = path.join(UPLOADS_DIR, 'riders');
const REVIEWS_UPLOAD_DIR = path.join(UPLOADS_DIR, 'reviews');
const CMS_UPLOAD_DIR = path.join(UPLOADS_DIR, 'cms');

for (const dir of [
  UPLOADS_DIR,
  RECEIPTS_DIR,
  PRODUCTS_UPLOAD_DIR,
  EVIDENCE_DIR,
  RIDERS_UPLOAD_DIR,
  REVIEWS_UPLOAD_DIR,
  CMS_UPLOAD_DIR,
]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

const makeImageStorage = (targetDir: string, prefix: string) =>
  multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, targetDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
      cb(null, `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
    },
  });

const receiptStorage = makeImageStorage(RECEIPTS_DIR, 'receipt');
const productImageStorage = makeImageStorage(PRODUCTS_UPLOAD_DIR, 'dm-media');
const evidenceStorage = makeImageStorage(EVIDENCE_DIR, 'dm-evidence');
const riderPhotoStorage = makeImageStorage(RIDERS_UPLOAD_DIR, 'dm-rider');
const reviewPhotoStorage = makeImageStorage(REVIEWS_UPLOAD_DIR, 'dm-review');
const cmsMediaStorage = makeImageStorage(CMS_UPLOAD_DIR, 'dm-cms');

const allowedReceiptMimes = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
const allowedImageMimes = new Set(['image/jpeg', 'image/png', 'image/webp']);

const uploadReceipt = multer({
  storage: receiptStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    cb(null, allowedReceiptMimes.has(file.mimetype));
  },
});

const uploadProductImage = multer({
  storage: productImageStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    cb(null, allowedImageMimes.has(file.mimetype));
  },
});

const uploadEvidenceImage = multer({
  storage: evidenceStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    cb(null, allowedImageMimes.has(file.mimetype));
  },
});

const uploadRiderPhoto = multer({
  storage: riderPhotoStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    cb(null, allowedImageMimes.has(file.mimetype));
  },
});

const uploadReviewPhoto = multer({
  storage: reviewPhotoStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    cb(null, allowedImageMimes.has(file.mimetype));
  },
});

const uploadCmsMedia = multer({
  storage: cmsMediaStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    cb(null, allowedImageMimes.has(file.mimetype));
  },
});

const riderLoginLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 10,
  keyPrefix: 'rider-login',
  message: 'Too many rider login attempts. Please wait 15 minutes and try again.',
});
const otpVerifyLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 15,
  keyPrefix: 'otp-verify',
  message: 'Too many OTP verification attempts. Please wait and try again.',
});
const otpResendLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  maxRequests: 6,
  keyPrefix: 'otp-resend',
  message: 'OTP resend rate limit exceeded. Please check your email or wait a few minutes.',
});
const complaintLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 12,
  keyPrefix: 'complaint',
  message: 'Too many complaint submissions. Please wait a few minutes.',
});
const publicTrackLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  maxRequests: 35,
  keyPrefix: 'public-track',
  message: 'Too many tracking lookups. Please wait a few minutes.',
});

function requireActiveRider(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
): void {
  if (!req.rider) {
    res.status(401).json({ error: 'Rider authentication required.' });
    return;
  }
  const active = storeEngine.getRiderById(req.rider.riderId);
  if (!active || active.status !== 'active') {
    res.status(403).json({ error: 'Rider account is inactive or unauthorized.' });
    return;
  }
  next();
}

async function startServer(): Promise<void> {
  const app = express();

  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  app.use(cookieParser());

  app.use(
    express.json({
      limit: '2mb',
      verify: (req, _res, buf) => {
        (req as express.Request & { rawBody?: Buffer }).rawBody = buf;
      },
    })
  );

  app.use('/uploads', express.static(UPLOADS_DIR));
  app.use('/api', verifyCsrfOrigin);
  app.use(attachUser);

  // --- Health & Connection Status ---
  app.get('/api/health', async (_req, res) => {
    const status = await storeEngine.getConnectionStatus();
    res.json({ ok: true, store: 'Diamond Market', ...status });
  });

  // --- Public Storefront Bootstrap ---
  app.get('/api/store/bootstrap', async (_req, res) => {
    try {
      const [categories, products, connection] = await Promise.all([
        storeEngine.getCategories(false),
        storeEngine.getProducts(false),
        storeEngine.getConnectionStatus(),
      ]);
      const ds = storeEngine.getDeliverySettings();
      const publicCms = storeEngine.getPublicCms();
      res.json({
        settings: storeEngine.getStoreSettings(),
        deliveryOptions: {
          ogbomosoLocalFee: ds.ogbomosoLocalFee,
          interstateDefaultFee: ds.interstateDefaultFee,
          nationwideDefaultFee: ds.nationwideDefaultFee,
          freeDeliveryThreshold: ds.freeDeliveryThreshold,
          estimatedTimes: ds.estimatedTimes,
          pickupEnabled: ds.pickupEnabled,
          pickupAddress: ds.pickupAddress,
          pickupInstructions: ds.pickupInstructions,
          localDeliveryEnabled: ds.localDeliveryEnabled,
          interstateDeliveryEnabled: ds.interstateDeliveryEnabled,
          nationwideDeliveryEnabled: ds.nationwideDeliveryEnabled,
          requireCustomerConfirmation: ds.requireCustomerConfirmation,
        },
        categories,
        products,
        shippingZones: storeEngine.getShippingZones(false),
        paymentGateways: storeEngine.getPublicPaymentGateways(),
        connection,
        cms: publicCms.cms,
        cmsPages: publicCms.pages,
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load store' });
    }
  });

  // --- Public Dynamic CMS Page Lookup ---
  app.get('/api/pages/:slug', (req, res) => {
    const page = storeEngine.getPublicPageBySlug(req.params.slug);
    if (!page) {
      res.status(404).json({ error: 'Page not found or not published.' });
      return;
    }
    res.json({ page });
  });

  // --- Public Verified Testimonials ---
  app.get('/api/testimonials', (_req, res) => {
    res.json(storeEngine.getPublicTestimonials());
  });

  // --- Public Products & Categories ---
  app.get('/api/products', async (req, res) => {
    try {
      const [allProducts, categories] = await Promise.all([
        storeEngine.getProducts(false),
        storeEngine.getCategories(true),
      ]);
      let products = allProducts;
      const { q, category, sort, minPrice, maxPrice, featured, inStock } = req.query;

      if (typeof q === 'string' && q.trim()) {
        const needle = q.trim().toLowerCase();
        products = products.filter(
          (p) =>
            p.name.toLowerCase().includes(needle) ||
            p.categoryName.toLowerCase().includes(needle) ||
            (p.subcategoryName || '').toLowerCase().includes(needle) ||
            (p.brand || '').toLowerCase().includes(needle) ||
            p.description.toLowerCase().includes(needle) ||
            p.shortDescription.toLowerCase().includes(needle) ||
            p.tags.some((t) => t.toLowerCase().includes(needle))
        );
      }
      if (typeof category === 'string' && category.trim() && category !== 'all') {
        const matchedCat = categories.find((c) => c.slug === category || c.id === category);
        const childIds = matchedCat
          ? categories.filter((c) => c.parentId === matchedCat.id).map((c) => c.id)
          : [];
        products = products.filter(
          (p) =>
            p.categorySlug === category ||
            p.categoryId === category ||
            p.subcategoryId === category ||
            (matchedCat &&
              (p.categoryId === matchedCat.id ||
                p.subcategoryId === matchedCat.id ||
                childIds.includes(p.categoryId) ||
                (p.subcategoryId ? childIds.includes(p.subcategoryId) : false)))
        );
      }
      if (featured === 'true') {
        products = products.filter((p) => p.featured);
      }
      if (inStock === 'true') {
        products = products.filter((p) => p.inStock);
      }
      if (typeof minPrice === 'string' && !Number.isNaN(Number(minPrice))) {
        const min = Number(minPrice);
        products = products.filter((p) => (p.salePrice || p.price) >= min);
      }
      if (typeof maxPrice === 'string' && !Number.isNaN(Number(maxPrice))) {
        const max = Number(maxPrice);
        products = products.filter((p) => (p.salePrice || p.price) <= max);
      }

      if (sort === 'price_asc') {
        products.sort((a, b) => (a.salePrice || a.price) - (b.salePrice || b.price));
      } else if (sort === 'price_desc') {
        products.sort((a, b) => (b.salePrice || b.price) - (a.salePrice || a.price));
      } else if (sort === 'newest') {
        products.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      } else if (sort === 'popularity') {
        products.sort((a, b) => b.salesCount - a.salesCount);
      } else if (sort === 'rating') {
        products.sort((a, b) => b.averageRating - a.averageRating);
      } else {
        products.sort((a, b) => Number(b.featured) - Number(a.featured));
      }

      res.json({ products });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to fetch products' });
    }
  });

  app.get('/api/products/:idOrSlug', async (req, res) => {
    try {
      const product = await storeEngine.getProductByIdOrSlug(req.params.idOrSlug);
      if (!product || product.status !== 'publish') {
        res.status(404).json({ error: 'Product not found' });
        return;
      }
      const reviews = storeEngine.getReviews(product.id, false);
      const all = await storeEngine.getProducts(false);
      const related = all
        .filter((p) => p.id !== product.id && p.categoryId === product.categoryId)
        .slice(0, 4);
      res.json({ product, reviews, related });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Error loading product' });
    }
  });

  app.get('/api/categories', async (_req, res) => {
    const categories = await storeEngine.getCategories(false);
    res.json({ categories });
  });

  // --- Coupons & Shipping Calculation ---
  app.post('/api/coupons/validate', (req, res) => {
    const { code, subtotal } = req.body as { code?: string; subtotal?: number };
    if (!code || typeof code !== 'string') {
      res.status(400).json({ valid: false, message: 'Enter a coupon code.' });
      return;
    }
    const result = storeEngine.validateCoupon(code, Number(subtotal || 0));
    res.json(result);
  });

  app.post('/api/shipping/calculate', (req, res) => {
    const { state, subtotal, pickupAtHub } = req.body as {
      state?: string;
      subtotal?: number;
      pickupAtHub?: boolean;
    };
    const result = storeEngine.resolveShippingForState(
      state || 'Oyo',
      Number(subtotal || 0),
      Boolean(pickupAtHub)
    );
    res.json(result);
  });

  app.post('/api/newsletter', (req, res) => {
    const { email } = req.body as { email?: string };
    if (!email || !email.includes('@')) {
      res.status(400).json({ error: 'Valid email address is required.' });
      return;
    }
    const result = storeEngine.subscribeNewsletter(email);
    res.json(result);
  });

  // --- Auth Session Sync ---
  app.post('/api/auth/session', requireAuth, async (req, res) => {
    try {
      const user = req.user!;
      const body = req.body as { displayName?: string; phone?: string };
      const syncResult = await storeEngine.syncAuthenticatedCustomer({
        uid: user.uid,
        email: user.email,
        displayName: body.displayName || user.name || user.email.split('@')[0],
        phone: body.phone,
      });

      res.json({
        authenticated: true,
        uid: user.uid,
        email: user.email,
        emailVerified: user.emailVerified,
        isAdmin: user.isAdmin,
        wooCustomerId: syncResult.wooCustomerId || null,
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Session sync failed' });
    }
  });

  // --- Reviews ---
  app.post('/api/reviews/photo-upload', requireAuth, uploadReviewPhoto.single('image'), (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: 'Valid JPG, PNG, or WEBP photo under 5MB is required.' });
      return;
    }
    res.json({ url: `/uploads/reviews/${req.file.filename}` });
  });

  app.post('/api/reviews', requireAuth, (req, res) => {
    try {
      const {
        productId,
        orderId,
        rating,
        title,
        qualityRating,
        accuracyRating,
        sizeFitFeedback,
        comment,
        photos,
      } = req.body as {
        productId?: string;
        orderId?: string;
        rating?: number;
        title?: string;
        qualityRating?: number;
        accuracyRating?: number;
        sizeFitFeedback?: 'runs_small' | 'true_to_size' | 'runs_large' | 'comfortable' | '';
        comment?: string;
        photos?: string[];
      };
      if (!productId || !rating || !comment?.trim()) {
        res.status(400).json({ error: 'Product, rating, and review comment are required.' });
        return;
      }
      const user = req.user!;
      const review = storeEngine.submitReview({
        productId,
        orderId,
        reviewerName: user.name || user.email.split('@')[0],
        reviewerEmail: user.email,
        userId: user.uid,
        rating: Number(rating),
        title,
        qualityRating,
        accuracyRating,
        sizeFitFeedback,
        comment,
        photos,
      });
      res.status(201).json({
        review,
        message:
          review.status === 'approved'
            ? 'Thank you! Your verified review has been published.'
            : 'Review submitted and awaiting administrator moderation.',
      });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to submit review' });
    }
  });

  app.post('/api/reviews/:id/report', requireAuth, (req, res) => {
    try {
      const { reason } = req.body as { reason?: string };
      const review = storeEngine.reportReview(req.params.id, reason || 'Reported by customer', req.user!.email);
      res.json({ review, message: 'Thank you. Our moderation team will inspect this review.' });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Unable to report review' });
    }
  });

  // --- Checkout & Payment Initialization ---
  app.post('/api/checkout', async (req, res) => {
    try {
      const body = req.body as {
        billing: {
          firstName: string;
          lastName: string;
          email: string;
          phone: string;
          street: string;
          city: string;
          state: string;
          country: string;
        };
        deliveryInstructions?: string;
        items: { productId: string; variationId?: string; quantity: number }[];
        couponCode?: string | null;
        paymentMethod: PaymentMethodId;
        pickupAtHub?: boolean;
      };

      if (
        !body.billing?.firstName?.trim() ||
        !body.billing?.lastName?.trim() ||
        !body.billing?.email?.includes('@') ||
        !body.billing?.phone?.trim() ||
        !body.billing?.street?.trim() ||
        !body.billing?.city?.trim() ||
        !body.billing?.state?.trim()
      ) {
        res.status(400).json({ error: 'Complete Nigerian billing and delivery details are required.' });
        return;
      }

      if (!['paystack', 'flutterwave', 'bacs', 'cod'].includes(body.paymentMethod)) {
        res.status(400).json({ error: 'Invalid payment method selected.' });
        return;
      }

      const secrets = storeEngine.getSecretsForServer();
      if (body.paymentMethod === 'paystack' && !secrets.paystackSecretKey?.startsWith('sk_')) {
        res.status(400).json({
          error:
            'Paystack secret key is not configured on the server yet. Please configure it in Admin -> Payment Settings or choose Bank Transfer / Pay on Delivery.',
        });
        return;
      }
      if (body.paymentMethod === 'flutterwave' && !secrets.flutterwaveSecretKey?.includes('FLWSECK')) {
        res.status(400).json({
          error:
            'Flutterwave secret key is not configured on the server yet. Please configure it in Admin -> Payment Settings or choose Bank Transfer / Pay on Delivery.',
        });
        return;
      }

      const order = await storeEngine.createAuthoritativeOrder({
        customerUid: req.user?.uid || null,
        billing: body.billing,
        deliveryInstructions: body.deliveryInstructions,
        items: body.items,
        couponCode: body.couponCode,
        paymentMethod: body.paymentMethod,
        pickupAtHub: body.pickupAtHub,
      });

      const appBaseUrl =
        process.env.APP_URL && process.env.APP_URL !== 'MY_APP_URL'
          ? process.env.APP_URL.replace(/\/+$/, '')
          : `${req.protocol}://${req.get('host')}`;

      if (body.paymentMethod === 'paystack') {
        const init = await initializePaystackTransaction({
          secretKey: secrets.paystackSecretKey!,
          email: order.customerEmail,
          amountNgn: order.total,
          reference: order.paymentReference,
          callbackUrl: `${appBaseUrl}/?payment_callback=paystack&order_id=${encodeURIComponent(order.id)}&reference=${encodeURIComponent(order.paymentReference)}`,
          metadata: { orderId: order.id, orderNumber: order.orderNumber },
        });
        res.status(201).json({ order, gatewayRedirectUrl: init.authorizationUrl });
        return;
      }

      if (body.paymentMethod === 'flutterwave') {
        const init = await initializeFlutterwaveTransaction({
          secretKey: secrets.flutterwaveSecretKey!,
          email: order.customerEmail,
          name: `${order.billing.firstName} ${order.billing.lastName}`,
          phone: order.billing.phone,
          amountNgn: order.total,
          txRef: order.paymentReference,
          redirectUrl: `${appBaseUrl}/?payment_callback=flutterwave&order_id=${encodeURIComponent(order.id)}`,
        });
        res.status(201).json({ order, gatewayRedirectUrl: init.authorizationUrl });
        return;
      }

      res.status(201).json({
        order,
        paymentGateways: storeEngine.getPublicPaymentGateways(),
      });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Checkout failed' });
    }
  });

  // --- Payment Verification Callbacks ---
  app.post('/api/payments/paystack/verify', async (req, res) => {
    try {
      const { reference } = req.body as { reference?: string };
      if (!reference) {
        res.status(400).json({ error: 'Transaction reference is required.' });
        return;
      }
      const secrets = storeEngine.getSecretsForServer();
      const result = await verifyPaystackTransaction(secrets.paystackSecretKey || '', reference);
      if (result.verified) {
        const order = await storeEngine.markOrderPaymentResult(reference, {
          paid: true,
          transactionId: result.transactionId,
          verifiedAmountNgn: result.amountNgn,
          note: `Paystack transaction verified (${result.gatewayMessage}).`,
        });
        res.json({ verified: true, order });
      } else {
        const order = await storeEngine.markOrderPaymentResult(reference, {
          paid: false,
          failed: result.status === 'failed',
          note: `Paystack verification returned status=${result.status}: ${result.gatewayMessage}`,
        });
        res.status(400).json({ verified: false, order, message: result.gatewayMessage });
      }
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Verification error' });
    }
  });

  app.post('/api/payments/flutterwave/verify', async (req, res) => {
    try {
      const { transactionId, txRef } = req.body as { transactionId?: string; txRef?: string };
      if (!transactionId || !txRef) {
        res.status(400).json({ error: 'transactionId and txRef are required.' });
        return;
      }
      const secrets = storeEngine.getSecretsForServer();
      const result = await verifyFlutterwaveTransaction(
        secrets.flutterwaveSecretKey || '',
        transactionId
      );
      if (result.verified) {
        const order = await storeEngine.markOrderPaymentResult(txRef, {
          paid: true,
          transactionId: result.transactionId,
          verifiedAmountNgn: result.amountNgn,
          note: `Flutterwave transaction verified (${result.gatewayMessage}).`,
        });
        res.json({ verified: true, order });
      } else {
        const order = await storeEngine.markOrderPaymentResult(txRef, {
          paid: false,
          failed: result.status === 'failed',
          note: `Flutterwave verification returned status=${result.status}: ${result.gatewayMessage}`,
        });
        res.status(400).json({ verified: false, order, message: result.gatewayMessage });
      }
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Verification error' });
    }
  });

  // --- Paystack & Flutterwave Server Webhooks ---
  app.post('/api/webhooks/paystack', async (req, res) => {
    try {
      const rawBody = (req as express.Request & { rawBody?: Buffer }).rawBody || Buffer.from('');
      const sig = req.headers['x-paystack-signature'] as string | undefined;
      const secrets = storeEngine.getSecretsForServer();
      if (!verifyPaystackWebhookSignature(rawBody, sig, secrets.paystackSecretKey || '')) {
        res.status(401).send('Invalid signature');
        return;
      }
      const event = req.body as {
        event?: string;
        data?: { reference?: string; amount?: number; id?: number; gateway_response?: string };
      };
      if (event.event === 'charge.success' && event.data?.reference) {
        await storeEngine.markOrderPaymentResult(event.data.reference, {
          paid: true,
          transactionId: String(event.data.id || ''),
          verifiedAmountNgn: event.data.amount ? Math.round(event.data.amount / 100) : undefined,
          note: `Paystack webhook confirmed charge.success (${event.data.gateway_response || 'OK'}).`,
        });
      }
      res.status(200).send('OK');
    } catch (err) {
      console.error('Paystack webhook error:', err);
      res.status(500).send('Error');
    }
  });

  app.post('/api/webhooks/flutterwave', async (req, res) => {
    try {
      const verifHash = req.headers['verif-hash'] as string | undefined;
      const secrets = storeEngine.getSecretsForServer();
      if (!verifyFlutterwaveWebhookHash(verifHash, secrets.flutterwaveWebhookHash || '')) {
        res.status(401).send('Invalid webhook hash');
        return;
      }
      const payload = req.body as {
        event?: string;
        data?: { id?: number; tx_ref?: string; status?: string; amount?: number };
      };
      if (payload.event === 'charge.completed' && payload.data?.id && payload.data?.tx_ref) {
        const verified = await verifyFlutterwaveTransaction(
          secrets.flutterwaveSecretKey || '',
          String(payload.data.id)
        );
        if (verified.verified) {
          await storeEngine.markOrderPaymentResult(payload.data.tx_ref, {
            paid: true,
            transactionId: verified.transactionId,
            verifiedAmountNgn: verified.amountNgn,
            note: 'Flutterwave webhook charge.completed verified.',
          });
        }
      }
      res.status(200).send('OK');
    } catch (err) {
      console.error('Flutterwave webhook error:', err);
      res.status(500).send('Error');
    }
  });

  // --- Bank Transfer Receipt Upload & Order Tracking ---
  app.post('/api/orders/:id/receipt', uploadReceipt.single('receipt'), (req, res) => {
    try {
      const order = storeEngine.getOrderByIdOrRef(req.params.id);
      if (!order) {
        res.status(404).json({ error: 'Order not found' });
        return;
      }
      const emailCheck = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
      const isOwner =
        req.user && (req.user.uid === order.customerUid || req.user.email.toLowerCase() === order.customerEmail);
      if (!isOwner && emailCheck !== order.customerEmail) {
        res.status(403).json({ error: 'Verification failed: billing email does not match order.' });
        return;
      }
      if (!req.file) {
        res.status(400).json({ error: 'Upload a valid receipt image (JPG, PNG, WEBP) or PDF under 5MB.' });
        return;
      }
      const receiptUrl = `/uploads/receipts/${req.file.filename}`;
      const updated = storeEngine.attachTransferReceipt(order.id, receiptUrl, req.body.note);
      res.json({ order: updated });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Receipt upload failed' });
    }
  });

  app.post('/api/orders/track', publicTrackLimiter, (req, res) => {
    const { orderNumber, email } = req.body as { orderNumber?: string; email?: string };
    if (!orderNumber || !email) {
      res.status(400).json({ error: 'Order number and billing email are required.' });
      return;
    }
    const order = storeEngine.getOrderByIdOrRef(orderNumber.trim());
    if (!order || order.customerEmail !== email.trim().toLowerCase()) {
      res.status(404).json({ error: 'No matching order found for that order number and email.' });
      return;
    }
    const deliveryRecord = storeEngine.getDeliveryByOrderId(order.id);
    res.json({
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        paymentMethod: order.paymentMethod,
        paymentMethodTitle: order.paymentMethodTitle,
        paymentStatus: order.paymentStatus,
        paymentReference: order.paymentReference,
        total: order.total,
        subtotal: order.subtotal,
        shippingTotal: order.shippingTotal,
        discountTotal: order.discountTotal,
        codFee: order.codFee,
        items: order.items,
        delivery: order.delivery,
        shippingZoneName: order.shippingZoneName,
        transferReceiptUrl: order.transferReceiptUrl,
        billing: {
          firstName: order.billing.firstName,
          lastName: order.billing.lastName,
          city: order.billing.city,
          state: order.billing.state,
          email: order.billing.email,
        },
        notes: order.notes.filter((n) => n.isCustomerVisible),
        createdAt: order.createdAt,
      },
      deliveryHistory: deliveryRecord?.history || [],
    });
  });

  // --- Public Signed-Token Delivery Confirmation, Issue & Review Flows ---
  app.get('/api/confirm-delivery/:token', (req, res) => {
    try {
      const preview = storeEngine.getConfirmationPreviewByToken(req.params.token);
      res.json(preview);
    } catch (err) {
      res.status(404).json({ error: err instanceof Error ? err.message : 'Invalid confirmation link' });
    }
  });

  app.post('/api/confirm-delivery/:token', async (req, res) => {
    try {
      const result = await storeEngine.confirmDeliveryByToken(req.params.token);
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Could not confirm delivery' });
    }
  });

  app.post('/api/confirm-delivery/:token/issue', complaintLimiter, async (req, res) => {
    try {
      const { category, subject, description } = req.body as {
        category?: ComplaintCategory;
        subject?: string;
        description?: string;
      };
      const complaint = await storeEngine.submitComplaint({
        confirmToken: req.params.token,
        category: category || 'order_not_received',
        subject: subject || '',
        description: description || '',
      });
      res.status(201).json({ complaint });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Unable to submit delivery issue' });
    }
  });

  app.post('/api/confirm-delivery/:token/rider-review', (req, res) => {
    try {
      const body = req.body as {
        politenessRating?: number;
        communicationRating?: number;
        timelinessRating?: number;
        handlingRating?: number;
        comment?: string;
      };
      const review = storeEngine.submitRiderReview({
        confirmToken: req.params.token,
        politenessRating: Number(body.politenessRating || 5),
        communicationRating: Number(body.communicationRating || 5),
        timelinessRating: Number(body.timelinessRating || 5),
        handlingRating: Number(body.handlingRating || 5),
        comment: body.comment || '',
      });
      res.status(201).json({ review });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Could not save rider rating' });
    }
  });

  app.post('/api/confirm-delivery/:token/product-review', (req, res) => {
    try {
      const preview = storeEngine.getConfirmationPreviewByToken(req.params.token);
      const order = storeEngine.getOrderByIdOrRef(preview.orderId);
      if (!order) {
        res.status(404).json({ error: 'Order not found' });
        return;
      }
      const body = req.body as {
        productId?: string;
        rating?: number;
        title?: string;
        qualityRating?: number;
        accuracyRating?: number;
        sizeFitFeedback?: 'runs_small' | 'true_to_size' | 'runs_large' | 'comfortable' | '';
        comment?: string;
      };
      if (!body.productId || !body.comment?.trim()) {
        res.status(400).json({ error: 'Select a product and write your feedback.' });
        return;
      }
      const inOrder = order.items.some((i) => i.productId === body.productId);
      if (!inOrder) {
        res.status(400).json({ error: 'Selected item is not part of this confirmed order.' });
        return;
      }
      const review = storeEngine.submitReview({
        productId: body.productId,
        orderId: order.id,
        reviewerName: `${order.billing.firstName} ${order.billing.lastName}`.trim() || 'Verified Buyer',
        reviewerEmail: order.customerEmail,
        userId: order.customerUid || undefined,
        rating: Number(body.rating || 5),
        title: body.title,
        qualityRating: body.qualityRating,
        accuracyRating: body.accuracyRating,
        sizeFitFeedback: body.sizeFitFeedback,
        comment: body.comment,
      });
      res.status(201).json({ review });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Could not submit product review' });
    }
  });

  // --- Authenticated Customer Orders, Confirmations, OTP & Complaints ---
  app.get('/api/customer/orders', requireAuth, (req, res) => {
    const orders = storeEngine.getOrdersForCustomer(req.user!.uid, req.user!.email);
    const deliveriesByOrderId: Record<string, ReturnType<typeof storeEngine.getDeliveryByOrderId>> = {};
    for (const o of orders) {
      deliveriesByOrderId[o.id] = storeEngine.getDeliveryByOrderId(o.id);
    }
    res.json({ orders, deliveriesByOrderId });
  });

  app.get('/api/customer/orders/:id', requireAuth, (req, res) => {
    const order = storeEngine.getOrderByIdOrRef(req.params.id);
    if (!order) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }
    const isOwner =
      (order.customerUid && order.customerUid === req.user!.uid) ||
      order.customerEmail === req.user!.email.toLowerCase();
    if (!isOwner && !req.user!.isAdmin) {
      res.status(403).json({ error: 'Access denied. You can only view your own orders.' });
      return;
    }
    res.json({ order, delivery: storeEngine.getDeliveryByOrderId(order.id) });
  });

  app.post('/api/customer/orders/:id/confirm-delivery', requireAuth, async (req, res) => {
    try {
      const delivery = await storeEngine.customerConfirmDelivery(
        req.params.id,
        req.user!.uid,
        req.user!.email
      );
      res.json({ delivery });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Confirmation failed' });
    }
  });

  app.post('/api/customer/orders/:id/otp-resend', requireAuth, otpResendLimiter, async (req, res) => {
    try {
      const result = await storeEngine.resendOtpForCustomerOrder(
        req.params.id,
        req.user!.uid,
        req.user!.email
      );
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Unable to send OTP' });
    }
  });

  app.get('/api/customer/complaints', requireAuth, (req, res) => {
    const complaints = storeEngine.listCustomerComplaints(req.user!.uid, req.user!.email);
    res.json({ complaints });
  });

  app.post('/api/customer/complaints/upload', requireAuth, uploadEvidenceImage.single('image'), (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: 'Valid JPG, PNG, or WEBP image under 5MB required.' });
      return;
    }
    res.json({ url: `/uploads/evidence/${req.file.filename}` });
  });

  app.post('/api/customer/complaints', requireAuth, complaintLimiter, async (req, res) => {
    try {
      const body = req.body as {
        orderId?: string;
        category?: ComplaintCategory;
        subject?: string;
        description?: string;
        evidenceUrls?: string[];
      };
      const complaint = await storeEngine.submitComplaint({
        orderId: body.orderId,
        customerUid: req.user!.uid,
        customerEmail: req.user!.email,
        category: body.category || 'other',
        subject: body.subject || '',
        description: body.description || '',
        evidenceUrls: body.evidenceUrls,
      });
      res.status(201).json({ complaint });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Complaint submission failed' });
    }
  });

  app.post('/api/customer/rider-reviews', requireAuth, (req, res) => {
    try {
      const body = req.body as {
        orderId?: string;
        politenessRating?: number;
        communicationRating?: number;
        timelinessRating?: number;
        handlingRating?: number;
        comment?: string;
      };
      const review = storeEngine.submitRiderReview({
        orderId: body.orderId,
        customerUid: req.user!.uid,
        customerEmail: req.user!.email,
        politenessRating: Number(body.politenessRating || 5),
        communicationRating: Number(body.communicationRating || 5),
        timelinessRating: Number(body.timelinessRating || 5),
        handlingRating: Number(body.handlingRating || 5),
        comment: body.comment || '',
      });
      res.status(201).json({ review });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Could not submit rider review' });
    }
  });

  // --- DEDICATED RIDER PORTAL API (Strictly Isolated Role) ---
  app.post('/api/rider/login', riderLoginLimiter, (req, res) => {
    try {
      const { identifier, passcode } = req.body as { identifier?: string; passcode?: string };
      if (!identifier?.trim() || !passcode?.trim()) {
        res.status(400).json({ error: 'Rider ID/email and passcode are required.' });
        return;
      }
      const rider = storeEngine.authenticateRider(identifier, passcode);
      const token = signRiderToken({
        riderId: rider.id,
        riderCode: rider.riderCode,
        fullName: rider.fullName,
        email: rider.email,
        phone: rider.phone,
      });
      res.cookie('dm_rider_session', token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 12 * 60 * 60 * 1000,
      });
      res.json({ rider, token });
    } catch (err) {
      res.status(401).json({ error: err instanceof Error ? err.message : 'Rider login failed' });
    }
  });

  app.post('/api/rider/logout', (_req, res) => {
    res.clearCookie('dm_rider_session');
    res.json({ ok: true });
  });

  app.get('/api/rider/me', requireActiveRider, (req, res) => {
    const rider = storeEngine.getRiderById(req.rider!.riderId);
    const reviews = storeEngine.getRiderReviews({
      riderId: req.rider!.riderId,
      stripPrivateEmail: true,
    });
    const avgRating =
      reviews.length > 0
        ? Number((reviews.reduce((acc, r) => acc + r.overallRating, 0) / reviews.length).toFixed(1))
        : null;
    const ds = storeEngine.getDeliverySettings();
    res.json({
      rider,
      ratingSummary: { averageRating: avgRating, reviewCount: reviews.length, reviews },
      evidenceRules: {
        collectDeliveryPhoto: ds.collectDeliveryPhoto,
        collectDeliveryLocation: ds.collectDeliveryLocation,
      },
    });
  });

  app.get('/api/rider/deliveries', requireActiveRider, (req, res) => {
    const deliveries = storeEngine.getDeliveriesForRider(req.rider!.riderId);
    res.json({ deliveries });
  });

  app.post('/api/rider/deliveries/:id/verify-otp', requireActiveRider, otpVerifyLimiter, (req, res) => {
    try {
      const { otpCode } = req.body as { otpCode?: string };
      if (!otpCode?.trim()) {
        res.status(400).json({ error: 'Enter the 6-digit OTP provided by the customer.' });
        return;
      }
      const result = storeEngine.verifyDeliveryOtpByRider(req.rider!.riderId, req.params.id, otpCode);
      res.json(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'OTP verification failed';
      res.status(msg.includes('Access denied') ? 403 : 400).json({ error: msg });
    }
  });

  app.post('/api/rider/deliveries/:id/status', requireActiveRider, async (req, res) => {
    try {
      const updated = await storeEngine.riderUpdateDeliveryStatus(req.rider!.riderId, req.params.id, req.body);
      res.json({ delivery: updated });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Status update failed';
      res.status(msg.includes('Access denied') ? 403 : 400).json({ error: msg });
    }
  });

  app.post(
    '/api/rider/deliveries/:id/evidence-upload',
    requireActiveRider,
    uploadEvidenceImage.single('image'),
    (req, res) => {
      const mine = storeEngine.getDeliveriesForRider(req.rider!.riderId);
      if (!mine.some((d) => d.delivery.id === req.params.id)) {
        res.status(403).json({ error: 'Access denied: delivery is not assigned to you.' });
        return;
      }
      if (!req.file) {
        res.status(400).json({ error: 'Valid JPG, PNG, or WEBP delivery proof photo under 5MB required.' });
        return;
      }
      res.json({ url: `/uploads/evidence/${req.file.filename}` });
    }
  );

  // --- PRIVATE ADMIN DASHBOARD API ---
  app.get('/api/admin/overview', requireAdmin, async (_req, res) => {
    try {
      const [connection, orders, products, categories] = await Promise.all([
        storeEngine.getConnectionStatus(),
        storeEngine.getAllOrders(),
        storeEngine.getProducts(true),
        storeEngine.getCategories(true),
      ]);
      res.json({
        connection,
        analytics: storeEngine.getAnalytics(),
        recentOrders: orders.slice(0, 10),
        products,
        categories,
        orders,
        customers: storeEngine.getCustomers(),
        coupons: storeEngine.getCoupons(),
        reviews: storeEngine.getReviews(undefined, true),
        riderReviews: storeEngine.getRiderReviews({ includeAllStatuses: true }),
        deliveries: storeEngine.listDeliveries(),
        riders: storeEngine.listRiders(),
        complaints: storeEngine.listAllComplaints(),
        deliverySettings: storeEngine.getDeliverySettings(),
        deliveryAnalytics: storeEngine.getDeliveryAnalytics(),
        emailLogs: storeEngine.getEmailLogs(),
        shippingZones: storeEngine.getShippingZones(true),
        paymentGateways: storeEngine.getAdminPaymentGateways(),
        storeSettings: storeEngine.getStoreSettings(),
        notifications: storeEngine.getNotifications(),
        auditLogs: storeEngine.getAuditLogs(),
        cmsState: storeEngine.getAdminCmsState(),
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Admin overview failed' });
    }
  });

  app.post('/api/admin/upload', requireAdmin, uploadProductImage.single('image'), (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: 'Valid JPG, PNG, or WEBP image under 5MB required.' });
      return;
    }
    res.json({ url: `/uploads/products/${req.file.filename}` });
  });

  app.post('/api/admin/products', requireAdmin, async (req, res) => {
    try {
      const product = await storeEngine.createProduct(req.user!.email, req.body);
      res.status(201).json({ product });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to create product' });
    }
  });

  app.put('/api/admin/products/:id', requireAdmin, async (req, res) => {
    try {
      const product = await storeEngine.updateProduct(req.user!.email, req.params.id, req.body);
      res.json({ product });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to update product' });
    }
  });

  app.post('/api/admin/products/:id/duplicate', requireAdmin, async (req, res) => {
    try {
      const product = await storeEngine.duplicateProduct(req.user!.email, req.params.id);
      res.status(201).json({ product });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to duplicate product' });
    }
  });

  app.delete('/api/admin/products/:id', requireAdmin, async (req, res) => {
    try {
      const archiveOnly = req.query.archive === 'true';
      await storeEngine.deleteProduct(req.user!.email, req.params.id, archiveOnly);
      res.json({ ok: true });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to delete product' });
    }
  });

  app.post('/api/admin/categories', requireAdmin, async (req, res) => {
    try {
      const category = await storeEngine.createCategory(req.user!.email, req.body);
      res.status(201).json({ category });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to create category' });
    }
  });

  app.put('/api/admin/categories/:id', requireAdmin, async (req, res) => {
    try {
      const category = await storeEngine.updateCategory(req.user!.email, req.params.id, req.body);
      res.json({ category });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to update category' });
    }
  });

  app.post('/api/admin/categories/reorder', requireAdmin, async (req, res) => {
    try {
      const { orderedIds } = req.body as { orderedIds?: string[] };
      if (!Array.isArray(orderedIds)) {
        res.status(400).json({ error: 'orderedIds array required' });
        return;
      }
      const categories = await storeEngine.reorderCategories(req.user!.email, orderedIds);
      res.json({ categories });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to reorder categories' });
    }
  });

  app.delete('/api/admin/categories/:id', requireAdmin, async (req, res) => {
    try {
      await storeEngine.deleteCategory(req.user!.email, req.params.id);
      res.json({ ok: true });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to delete category' });
    }
  });

  app.put('/api/admin/orders/:id', requireAdmin, async (req, res) => {
    try {
      const order = await storeEngine.adminUpdateOrder(
        req.user!.email,
        req.params.id,
        req.body as {
          status?: OrderStatus;
          delivery?: Record<string, string>;
          note?: string;
          isCustomerVisible?: boolean;
        }
      );
      res.json({ order });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to update order' });
    }
  });

  app.post('/api/admin/orders/:id/confirm-payment', requireAdmin, async (req, res) => {
    try {
      const order = storeEngine.getOrderByIdOrRef(req.params.id);
      if (!order) {
        res.status(404).json({ error: 'Order not found' });
        return;
      }
      const updated = await storeEngine.markOrderPaymentResult(order.id, {
        paid: true,
        verifiedAmountNgn: order.total,
        transactionId: `MANUAL-${Date.now().toString().slice(-6)}`,
        note:
          (req.body as { note?: string })?.note ||
          `Payment manually verified and confirmed by administrator (${req.user!.email}).`,
        actorEmail: req.user!.email,
      });
      res.json({ order: updated });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to confirm payment' });
    }
  });

  app.put('/api/admin/payment-gateways/:id', requireAdmin, async (req, res) => {
    try {
      const gatewayId = req.params.id as PaymentMethodId;
      if (!['paystack', 'flutterwave', 'bacs', 'cod'].includes(gatewayId)) {
        res.status(400).json({ error: 'Unknown payment gateway' });
        return;
      }
      const paymentGateways = await storeEngine.updatePaymentGatewayConfig(
        req.user!.email,
        gatewayId,
        req.body
      );
      res.json({ paymentGateways });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Gateway update failed' });
    }
  });

  app.post('/api/admin/shipping-zones', requireAdmin, (req, res) => {
    const shippingZones = storeEngine.saveShippingZone(req.user!.email, req.body);
    res.json({ shippingZones });
  });

  app.delete('/api/admin/shipping-zones/:id', requireAdmin, (req, res) => {
    const shippingZones = storeEngine.deleteShippingZone(req.user!.email, req.params.id);
    res.json({ shippingZones });
  });

  app.post('/api/admin/coupons', requireAdmin, (req, res) => {
    const coupons = storeEngine.saveCoupon(req.user!.email, req.body);
    res.json({ coupons });
  });

  app.delete('/api/admin/coupons/:id', requireAdmin, (req, res) => {
    const coupons = storeEngine.deleteCoupon(req.user!.email, req.params.id);
    res.json({ coupons });
  });

  app.put('/api/admin/reviews/:id', requireAdmin, (req, res) => {
    try {
      const { status } = req.body as { status: 'approved' | 'hold' | 'rejected' };
      const reviews = storeEngine.moderateReview(req.user!.email, req.params.id, status);
      res.json({ reviews });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to moderate review' });
    }
  });

  app.put('/api/admin/reviews/:id/feature', requireAdmin, (req, res) => {
    try {
      const { featured } = req.body as { featured?: boolean };
      const reviews = storeEngine.featureProductReview(req.user!.email, req.params.id, Boolean(featured));
      res.json({ reviews });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to update testimonial highlight' });
    }
  });

  app.delete('/api/admin/reviews/:id', requireAdmin, (req, res) => {
    const reviews = storeEngine.deleteReview(req.user!.email, req.params.id);
    res.json({ reviews });
  });

  app.put('/api/admin/rider-reviews/:id', requireAdmin, (req, res) => {
    try {
      const riderReviews = storeEngine.moderateRiderReview(req.user!.email, req.params.id, req.body);
      res.json({ riderReviews });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to moderate rider review' });
    }
  });

  // --- Admin Delivery Management, Riders, Complaints, Delivery Settings & Emails ---
  app.get('/api/admin/deliveries', requireAdmin, (_req, res) => {
    res.json({
      deliveries: storeEngine.listDeliveries(),
      deliveryAnalytics: storeEngine.getDeliveryAnalytics(),
    });
  });

  app.post('/api/admin/deliveries/:id/assign', requireAdmin, async (req, res) => {
    try {
      const { riderId, note } = req.body as { riderId?: string; note?: string };
      if (!riderId) {
        res.status(400).json({ error: 'riderId is required' });
        return;
      }
      const delivery = await storeEngine.assignRiderToDelivery(
        req.user!.email,
        req.params.id,
        riderId,
        note
      );
      res.json({ delivery });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to assign rider' });
    }
  });

  app.put('/api/admin/deliveries/:id/status', requireAdmin, async (req, res) => {
    try {
      const delivery = await storeEngine.adminUpdateDelivery(
        req.user!.email,
        req.params.id,
        req.body as { status?: DeliveryStatus; [k: string]: unknown }
      );
      res.json({ delivery });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to update delivery' });
    }
  });

  app.post('/api/admin/deliveries/:id/cod-collected', requireAdmin, async (req, res) => {
    try {
      const { collected, confirmPaymentPaid } = req.body as {
        collected?: boolean;
        confirmPaymentPaid?: boolean;
      };
      const delivery = await storeEngine.recordCodCollection(
        req.user!.email,
        req.params.id,
        Boolean(collected ?? true),
        Boolean(confirmPaymentPaid)
      );
      res.json({ delivery });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to record COD status' });
    }
  });

  app.post('/api/admin/deliveries/:id/remind', requireAdmin, async (req, res) => {
    try {
      const delivery = await storeEngine.sendManualConfirmationReminder(req.user!.email, req.params.id);
      res.json({ delivery });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to send reminder' });
    }
  });

  app.post('/api/admin/deliveries/run-reminders', requireAdmin, async (_req, res) => {
    try {
      const result = await storeEngine.runConfirmationReminders();
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Reminder run failed' });
    }
  });

  app.get('/api/admin/riders', requireAdmin, (_req, res) => {
    res.json({ riders: storeEngine.listRiders() });
  });

  app.post('/api/admin/rider-upload', requireAdmin, uploadRiderPhoto.single('image'), (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: 'Valid JPG, PNG, or WEBP photo under 5MB required.' });
      return;
    }
    res.json({ url: `/uploads/riders/${req.file.filename}` });
  });

  app.post('/api/admin/riders', requireAdmin, (req, res) => {
    try {
      const rider = storeEngine.registerRider(req.user!.email, req.body);
      res.status(201).json({ rider });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to register rider' });
    }
  });

  app.put('/api/admin/riders/:id', requireAdmin, (req, res) => {
    try {
      const rider = storeEngine.updateRider(req.user!.email, req.params.id, req.body);
      res.json({ rider });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to update rider' });
    }
  });

  app.put('/api/admin/complaints/:id', requireAdmin, async (req, res) => {
    try {
      const body = req.body as {
        status?: ComplaintStatus;
        adminNote?: string;
        resolutionSummary?: string;
        nextDeliveryStatus?: DeliveryStatus;
      };
      const complaint = await storeEngine.adminUpdateComplaint(req.user!.email, req.params.id, body);
      res.json({ complaint });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to update complaint' });
    }
  });

  app.put('/api/admin/delivery-settings', requireAdmin, (req, res) => {
    const deliverySettings = storeEngine.updateDeliverySettings(req.user!.email, req.body);
    res.json({ deliverySettings, shippingZones: storeEngine.getShippingZones(true) });
  });

  app.put('/api/admin/store-settings', requireAdmin, (req, res) => {
    const storeSettings = storeEngine.updateStoreSettings(req.user!.email, req.body);
    res.json({ storeSettings });
  });

  app.post('/api/admin/woocommerce-connect', requireAdmin, async (req, res) => {
    try {
      const connection = await storeEngine.configureWooCommerceConnection(req.user!.email, req.body);
      res.json({ connection });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Connection failed' });
    }
  });

  app.post('/api/admin/notifications/read', requireAdmin, (req, res) => {
    const notifications = storeEngine.markNotificationsRead((req.body as { id?: string })?.id);
    res.json({ notifications });
  });

  // --- Admin Website Editor (CMS) & Media Library Routes ---
  app.get('/api/admin/cms', requireAdmin, (_req, res) => {
    res.json(storeEngine.getAdminCmsState());
  });

  app.put('/api/admin/cms/draft', requireAdmin, (req, res) => {
    try {
      const cmsState = storeEngine.saveCmsDraft(req.user!.email, req.body);
      res.json(cmsState);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to save CMS draft' });
    }
  });

  app.post('/api/admin/cms/publish', requireAdmin, (req, res) => {
    try {
      const cmsState = storeEngine.publishCms(req.user!.email, req.body);
      res.json({
        cmsState,
        storeSettings: storeEngine.getStoreSettings(),
      });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to publish website changes' });
    }
  });

  app.post('/api/admin/cms/reset-draft', requireAdmin, (req, res) => {
    try {
      const cmsState = storeEngine.resetCmsDraftToPublished(req.user!.email);
      res.json(cmsState);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to reset draft' });
    }
  });

  app.post('/api/admin/cms/pages', requireAdmin, (req, res) => {
    try {
      const result = storeEngine.saveCmsPage(req.user!.email, req.body);
      res.status(201).json(result);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to create page' });
    }
  });

  app.put('/api/admin/cms/pages/:id', requireAdmin, (req, res) => {
    try {
      const result = storeEngine.saveCmsPage(req.user!.email, { ...req.body, id: req.params.id });
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to update page' });
    }
  });

  app.delete('/api/admin/cms/pages/:id', requireAdmin, (req, res) => {
    try {
      const cmsState = storeEngine.deleteCmsPage(req.user!.email, req.params.id);
      res.json({ cmsState });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to delete page' });
    }
  });

  app.get('/api/admin/media', requireAdmin, (_req, res) => {
    res.json({ mediaLibrary: storeEngine.listMediaAssets() });
  });

  app.post('/api/admin/media/upload', requireAdmin, uploadCmsMedia.single('image'), (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: 'Valid JPG, PNG, or WEBP image under 5MB required.' });
      return;
    }
    const body = req.body as { name?: string; folder?: 'hero' | 'banners' | 'logos' | 'pages' | 'products' | 'general'; replaceAssetId?: string };
    const url = `/uploads/cms/${req.file.filename}`;
    try {
      if (body.replaceAssetId) {
        const result = storeEngine.updateMediaAsset(req.user!.email, body.replaceAssetId, {
          url,
          mimeType: req.file.mimetype,
          sizeBytes: req.file.size,
          ...(body.name?.trim() ? { name: body.name.trim() } : {}),
        });
        res.json(result);
        return;
      }
      const result = storeEngine.addMediaAsset(req.user!.email, {
        name: body.name?.trim() || req.file.originalname.replace(/\.[^/.]+$/, ''),
        url,
        folder: body.folder || 'general',
        mimeType: req.file.mimetype,
        sizeBytes: req.file.size,
      });
      res.status(201).json(result);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Media save failed' });
    }
  });

  app.put('/api/admin/media/:id', requireAdmin, (req, res) => {
    try {
      const result = storeEngine.updateMediaAsset(req.user!.email, req.params.id, req.body);
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Media update failed' });
    }
  });

  app.delete('/api/admin/media/:id', requireAdmin, (req, res) => {
    try {
      const mediaLibrary = storeEngine.deleteMediaAsset(req.user!.email, req.params.id);
      res.json({ mediaLibrary });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to delete media asset' });
    }
  });

  // Periodic background confirmation reminder sweep (every 15 minutes)
  setInterval(() => {
    storeEngine.runConfirmationReminders().catch(() => {});
  }, 15 * 60 * 1000).unref();

  // --- Vite / Static Frontend Hosting ---
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Diamond Market full-stack server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
