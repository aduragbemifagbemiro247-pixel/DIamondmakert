import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type {
  AdminAnalytics,
  AuditLogEntry,
  BankTransferConfig,
  Category,
  CmsAdminState,
  CmsData,
  CmsPage,
  CodConfig,
  ComplaintCategory,
  ComplaintStatus,
  ConnectionStatus,
  Coupon,
  CustomerRecord,
  DeliveryAnalytics,
  DeliveryComplaint,
  DeliveryEvidence,
  DeliveryRecord,
  DeliverySettings,
  DeliveryStatus,
  DeliveryType,
  EmailLogEntry,
  FlutterwaveConfig,
  MediaAsset,
  MediaFolder,
  Order,
  OrderLineItem,
  OrderStatus,
  PaymentGatewaysSettings,
  PaymentMethodId,
  PaystackConfig,
  Product,
  ProductReview,
  Rider,
  RiderReview,
  RiderStatus,
  ShippingZone,
  StoreNotification,
  StoreSettings,
  VehicleType,
} from '../src/types/commerce.ts';
import {
  createDefaultCmsData,
  createInitialMediaLibrary,
  isReservedRouteSlug,
  normalizePageSlug,
  sanitizeCmsData,
} from './cmsDefaults.ts';
import {
  computeDeliveryAnalytics,
  createDefaultDeliverySettings,
  DELIVERY_STATUS_LABELS,
  generateOtpCode,
  hashOtpOrToken,
  hashPassword,
  normalizeDeliveryStatus,
  RIDER_ALLOWED_TARGET_STATUSES,
  sanitizeText,
  verifyHashedValue,
  verifyPassword,
} from './deliveryHelpers.ts';
import { buildOrderEmail, dispatchTransactionalEmail, type EmailEventKey } from './emails.ts';
import { maskSecret } from './payments.ts';
import { WooCommerceClient } from './woocommerce.ts';

interface RuntimeSecrets {
  woocommerceUrl?: string;
  wcConsumerKey?: string;
  wcConsumerSecret?: string;
  wpBridgeSecret?: string;
  paystackSecretKey?: string;
  flutterwaveSecretKey?: string;
  flutterwaveWebhookHash?: string;
}

export interface StoredRider extends Rider {
  passwordHash: string;
  passwordSalt: string;
}

export interface StoredDeliveryRecord extends DeliveryRecord {
  otpHash?: string;
  otpSalt?: string;
  confirmationNonce?: string;
  sentEmailEvents?: string[];
}

interface StoreDatabase {
  categories: Category[];
  products: Product[];
  orders: Order[];
  customers: CustomerRecord[];
  coupons: Coupon[];
  reviews: ProductReview[];
  shippingZones: ShippingZone[];
  paymentGateways: {
    paystack: Omit<PaystackConfig, 'hasSecretKey' | 'secretKeyMasked'>;
    flutterwave: Omit<FlutterwaveConfig, 'hasSecretKey' | 'secretKeyMasked' | 'hasWebhookHash'>;
    bacs: BankTransferConfig;
    cod: CodConfig;
  };
  storeSettings: StoreSettings;
  deliverySettings: DeliverySettings;
  riders: StoredRider[];
  deliveries: StoredDeliveryRecord[];
  complaints: DeliveryComplaint[];
  riderReviews: RiderReview[];
  emailLogs: EmailLogEntry[];
  notifications: StoreNotification[];
  auditLogs: AuditLogEntry[];
  newsletterSubscribers: { email: string; subscribedAt: string }[];
  cmsPublished: CmsData;
  cmsDraft: CmsData;
  cmsLastPublishedAt?: string | null;
  cmsLastDraftSavedAt?: string | null;
  cmsLastPublishedBy?: string | null;
  mediaLibrary: MediaAsset[];
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'sandbox-store.json');
const SECRETS_FILE = path.resolve(process.cwd(), '.runtime-secrets.json');

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadSecrets(): RuntimeSecrets {
  let fileSecrets: RuntimeSecrets = {};
  if (fs.existsSync(SECRETS_FILE)) {
    try {
      fileSecrets = JSON.parse(fs.readFileSync(SECRETS_FILE, 'utf-8')) as RuntimeSecrets;
    } catch {
      fileSecrets = {};
    }
  }
  return {
    woocommerceUrl: process.env.WOOCOMMERCE_URL || fileSecrets.woocommerceUrl || '',
    wcConsumerKey: process.env.WC_CONSUMER_KEY || fileSecrets.wcConsumerKey || '',
    wcConsumerSecret: process.env.WC_CONSUMER_SECRET || fileSecrets.wcConsumerSecret || '',
    wpBridgeSecret: process.env.WP_BRIDGE_SECRET || fileSecrets.wpBridgeSecret || '',
    paystackSecretKey: process.env.PAYSTACK_SECRET_KEY || fileSecrets.paystackSecretKey || '',
    flutterwaveSecretKey: process.env.FLUTTERWAVE_SECRET_KEY || fileSecrets.flutterwaveSecretKey || '',
    flutterwaveWebhookHash: process.env.FLUTTERWAVE_WEBHOOK_HASH || fileSecrets.flutterwaveWebhookHash || '',
  };
}

function saveRuntimeSecrets(patch: Partial<RuntimeSecrets>): void {
  let current: RuntimeSecrets = {};
  if (fs.existsSync(SECRETS_FILE)) {
    try {
      current = JSON.parse(fs.readFileSync(SECRETS_FILE, 'utf-8')) as RuntimeSecrets;
    } catch {
      current = {};
    }
  }
  const merged = { ...current, ...patch };
  fs.writeFileSync(SECRETS_FILE, JSON.stringify(merged, null, 2), { mode: 0o600 });
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function createInitialStoreData(): StoreDatabase {
  const now = new Date().toISOString();

  const categories: Category[] = [
    {
      id: 'cat-shoes',
      name: 'Shoes',
      slug: 'shoes',
      description: 'Signature sneakers, handcrafted loafers, heels, and athletic footwear.',
      parentId: null,
      image: '/src/assets/images/prod_leather_sneakers_1795178922442.jpg',
      bannerImage: '/src/assets/images/hero_diamond_fashion_1795178919083.jpg',
      featured: true,
      visible: true,
      sortOrder: 1,
      createdAt: now,
    },
    {
      id: 'cat-sneakers',
      name: 'Sneakers',
      slug: 'sneakers',
      description: 'Low-top Italian leather sneakers and minimalist street silhouettes.',
      parentId: 'cat-shoes',
      image: '/src/assets/images/prod_leather_sneakers_1795178922442.jpg',
      featured: true,
      visible: true,
      sortOrder: 2,
      createdAt: now,
    },
    {
      id: 'cat-loafers',
      name: 'Loafers & Dress Shoes',
      slug: 'loafers-dress-shoes',
      description: 'Hand-stitched suede loafers and formal leather footwear.',
      parentId: 'cat-shoes',
      image: '/src/assets/images/prod_suede_loafers_1795178922817.jpg',
      featured: true,
      visible: true,
      sortOrder: 3,
      createdAt: now,
    },
    {
      id: 'cat-heels',
      name: 'Heels & Evening Sandals',
      slug: 'heels-sandals',
      description: 'Sculptural heels and occasion sandals with champagne gold hardware.',
      parentId: 'cat-shoes',
      image: '/src/assets/images/prod_stiletto_heels_1795178922483.jpg',
      featured: true,
      visible: true,
      sortOrder: 4,
      createdAt: now,
    },
    {
      id: 'cat-wears',
      name: 'Wears',
      slug: 'wears',
      description: 'Contemporary tailored two-pieces, shirts, hoodies, and luxury everyday clothing.',
      parentId: null,
      image: '/src/assets/images/prod_tailored_two_piece_1795178922245.jpg',
      bannerImage: '/src/assets/images/hero_diamond_fashion_1795178919083.jpg',
      featured: true,
      visible: true,
      sortOrder: 5,
      createdAt: now,
    },
    {
      id: 'cat-tailored',
      name: 'Two-Piece & Tailored Suits',
      slug: 'tailored-two-piece',
      description: 'Clean-cut linen senator outfits, formal shirts, and two-piece ensembles.',
      parentId: 'cat-wears',
      image: '/src/assets/images/prod_tailored_two_piece_1795178922245.jpg',
      featured: true,
      visible: true,
      sortOrder: 6,
      createdAt: now,
    },
    {
      id: 'cat-casualwear',
      name: 'Hoodies & Casualwear',
      slug: 'hoodies-casualwear',
      description: 'Heavyweight cotton hoodies, relaxed trousers, and refined casual wears.',
      parentId: 'cat-wears',
      image: '/src/assets/images/prod_essential_hoodie_1795178922447.jpg',
      featured: true,
      visible: true,
      sortOrder: 7,
      createdAt: now,
    },
    {
      id: 'cat-accessories',
      name: 'Accessories',
      slug: 'accessories',
      description: 'Grained leather bags, brushed gold-buckle belts, and finishing pieces.',
      parentId: null,
      image: '/src/assets/images/prod_crafted_leather_bag_1795178922982.jpg',
      featured: true,
      visible: true,
      sortOrder: 8,
      createdAt: now,
    },
  ];

  const products: Product[] = [
    {
      id: 'prod-dm-101',
      slug: 'monolith-italian-leather-sneakers',
      name: 'Monolith Italian Leather Low-Top Sneakers',
      sku: 'DM-SHU-101',
      brand: 'Diamond Atelier',
      material: '100% Full-Grain Italian Calfskin & Margom Rubber Sole',
      shortDescription:
        'Minimalist obsidian-and-ivory calfskin court sneakers hand-stitched for all-day sophistication.',
      description:
        '<h3>Architectural Court Silhouette</h3><p>Crafted from supple full-grain calfskin leather with a contrasting warm ivory heel tab and double-stitched cupsole. Engineered for effortless pairing with both tailored trousers and casual weekend denim.</p><ul><li>Breathable calfskin interior lining</li><li>Waxed cotton tonal laces</li><li>Reinforced heel counter for lasting structure</li></ul>',
      careInstructions: 'Wipe clean with a soft damp cloth. Condition leather monthly and store with shoe trees.',
      sizeGuide: 'True to European sizing (EU 40–45). Half sizes should size up.',
      price: 95000,
      salePrice: 78500,
      categoryId: 'cat-shoes',
      categoryName: 'Shoes',
      categorySlug: 'shoes',
      subcategoryId: 'cat-sneakers',
      subcategoryName: 'Sneakers',
      tags: ['sneakers', 'leather', 'shoes', 'men', 'unisex'],
      images: [
        '/src/assets/images/prod_leather_sneakers_1795178922442.jpg',
        '/src/assets/images/hero_diamond_fashion_1795178919083.jpg',
      ],
      stockQuantity: 28,
      manageStock: true,
      lowStockThreshold: 5,
      inStock: true,
      status: 'publish',
      featured: true,
      isNewArrival: true,
      isBestSeller: true,
      salesCount: 0,
      averageRating: 0,
      reviewCount: 0,
      weightKg: 1.15,
      dimensions: 'Boxed 34 x 24 x 12 cm',
      specifications: [
        { label: 'Upper Material', value: 'Full-Grain Calfskin Leather' },
        { label: 'Outsole', value: 'Stitched Ivory Rubber Cupsole' },
        { label: 'Lining', value: 'Breathable Leather Footbed' },
        { label: 'Origin', value: 'Curated by Diamond Market Ogbomoso' },
      ],
      type: 'variable',
      variations: [
        {
          id: 'var-101-41',
          sku: 'DM-SHU-101-41',
          attributes: { Size: 'EU 41', Color: 'Obsidian / Ivory' },
          price: 95000,
          salePrice: 78500,
          stockQuantity: 7,
          inStock: true,
        },
        {
          id: 'var-101-42',
          sku: 'DM-SHU-101-42',
          attributes: { Size: 'EU 42', Color: 'Obsidian / Ivory' },
          price: 95000,
          salePrice: 78500,
          stockQuantity: 9,
          inStock: true,
        },
        {
          id: 'var-101-43',
          sku: 'DM-SHU-101-43',
          attributes: { Size: 'EU 43', Color: 'Obsidian / Ivory' },
          price: 95000,
          salePrice: 78500,
          stockQuantity: 7,
          inStock: true,
        },
        {
          id: 'var-101-44',
          sku: 'DM-SHU-101-44',
          attributes: { Size: 'EU 44', Color: 'Obsidian / Ivory' },
          price: 95000,
          salePrice: 78500,
          stockQuantity: 5,
          inStock: true,
        },
      ],
      codAllowed: true,
      seoTitle: 'Monolith Italian Leather Low-Top Sneakers | Diamond Market',
      seoDescription: 'Minimalist obsidian and ivory leather sneakers available at Diamond Market Ogbomoso.',
      returnPolicy: {
        enabled: true,
        returnWindowDays: 7,
        eligibleConditions: 'Unworn pair in original clean Diamond Market shoebox with zero sole creasing.',
        nonReturnableConditions: 'Worn outdoors, scuffed soles, or missing dust bag and box.',
        exchangeRules: 'Free EU size exchange within 7 days subject to size stock availability.',
        refundConditions: 'Full refund or store credit issued within 3–5 business days after inspection.',
        returnShippingPayer: 'customer',
        formattedText:
          'Eligible for return or size exchange within 7 days of delivery when tried strictly indoors on carpet and returned in unworn condition inside the original shoebox.',
      },
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'prod-dm-102',
      slug: 'sovereign-espresso-suede-tassel-loafers',
      name: 'Sovereign Espresso Suede Buckle Loafers',
      sku: 'DM-SHU-102',
      brand: 'Diamond Heritage',
      material: 'Water-Resistant Italian Suede & Blake-Stitched Leather Sole',
      shortDescription:
        'Hand-stitched espresso brown suede loafers finished with signature champagne-gold snaffle hardware.',
      description:
        '<h3>Timeless Gentleman’s Loafer</h3><p>Designed to elevate native senator attire, tailored suits, and evening dressing alike. Built on an elongated almond toe last with a brushed champagne-gold horsebit accent and supple leather insole.</p><ul><li>Blake-stitched sole construction for flexibility</li><li>Suede leather protector finish</li><li>Supple cushioned leather heel pillow</li></ul>',
      careInstructions: 'Brush gently with a soft suede brush in one direction; avoid heavy rain saturation.',
      price: 115000,
      salePrice: 98000,
      categoryId: 'cat-shoes',
      categoryName: 'Shoes',
      categorySlug: 'shoes',
      subcategoryId: 'cat-loafers',
      subcategoryName: 'Loafers & Dress Shoes',
      tags: ['loafers', 'suede', 'dress shoes', 'formal', 'gold'],
      images: [
        '/src/assets/images/prod_suede_loafers_1795178922817.jpg',
        '/src/assets/images/hero_diamond_fashion_1795178919083.jpg',
      ],
      stockQuantity: 18,
      manageStock: true,
      lowStockThreshold: 4,
      inStock: true,
      status: 'publish',
      featured: true,
      isNewArrival: true,
      isBestSeller: true,
      salesCount: 0,
      averageRating: 0,
      reviewCount: 0,
      weightKg: 1.25,
      dimensions: 'Boxed 35 x 24 x 12 cm',
      specifications: [
        { label: 'Upper', value: 'Velvet Espresso Calf Suede' },
        { label: 'Hardware', value: 'Brushed Champagne Gold Buckle' },
        { label: 'Construction', value: 'Blake-Stitched Leather Sole' },
      ],
      type: 'variable',
      variations: [
        {
          id: 'var-102-41',
          sku: 'DM-SHU-102-41',
          attributes: { Size: 'EU 41', Color: 'Espresso Brown' },
          price: 115000,
          salePrice: 98000,
          stockQuantity: 4,
          inStock: true,
        },
        {
          id: 'var-102-42',
          sku: 'DM-SHU-102-42',
          attributes: { Size: 'EU 42', Color: 'Espresso Brown' },
          price: 115000,
          salePrice: 98000,
          stockQuantity: 6,
          inStock: true,
        },
        {
          id: 'var-102-43',
          sku: 'DM-SHU-102-43',
          attributes: { Size: 'EU 43', Color: 'Espresso Brown' },
          price: 115000,
          salePrice: 98000,
          stockQuantity: 5,
          inStock: true,
        },
        {
          id: 'var-102-45',
          sku: 'DM-SHU-102-45',
          attributes: { Size: 'EU 45', Color: 'Espresso Brown' },
          price: 115000,
          salePrice: 98000,
          stockQuantity: 3,
          inStock: true,
        },
      ],
      codAllowed: true,
      returnPolicy: {
        enabled: true,
        returnWindowDays: 7,
        eligibleConditions: 'Unworn suede loafers with protective sole film intact.',
        nonReturnableConditions: 'Creased vamps, water stains, or outdoor sole marks.',
        exchangeRules: 'One complimentary size swap per order within 7 days.',
        refundConditions: 'Refunded via original Paystack, Flutterwave, or bank account once cleared.',
        returnShippingPayer: 'depends',
        formattedText:
          'We gladly accept returns or EU size exchanges within 7 days provided the suede upper is unmarked and protective sole films remain intact.',
      },
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'prod-dm-103',
      slug: 'champagne-noir-stiletto-evening-sandals',
      name: 'Champagne Noir Satin Stiletto Sandals',
      sku: 'DM-SHU-103',
      brand: 'Diamond Atelier',
      material: 'Silk-Finish Black Satin & Metallic Gold Leather Straps',
      shortDescription:
        'Sculptural black satin evening heels accented with metallic champagne gold ankle straps.',
      description:
        '<h3>Evening Elegance Redefined</h3><p>Engineered for weddings, red-carpet galas, and signature celebrations. Features a balanced 95mm gilded heel, padded arch footbed, and delicate metallic champagne ankle buckle.</p><ul><li>Cushioned memory-gel forefoot pad</li><li>95mm balanced champagne gold stiletto heel</li><li>Adjustable delicate ankle strap buckle</li></ul>',
      careInstructions: 'Store inside individual dust bags away from sharp jewelry.',
      price: 88000,
      salePrice: 74000,
      categoryId: 'cat-shoes',
      categoryName: 'Shoes',
      categorySlug: 'shoes',
      subcategoryId: 'cat-heels',
      subcategoryName: 'Heels & Evening Sandals',
      tags: ['heels', 'women', 'evening', 'sandals', 'gold'],
      images: ['/src/assets/images/prod_stiletto_heels_1795178922483.jpg'],
      stockQuantity: 20,
      manageStock: true,
      lowStockThreshold: 4,
      inStock: true,
      status: 'publish',
      featured: true,
      isNewArrival: true,
      isBestSeller: false,
      salesCount: 0,
      averageRating: 0,
      reviewCount: 0,
      weightKg: 0.85,
      dimensions: '30 x 21 x 11 cm',
      specifications: [
        { label: 'Heel Height', value: '95mm (3.7 inches)' },
        { label: 'Material', value: 'Black Satin & Metallic Gold Kidskin' },
        { label: 'Closure', value: 'Gold Buckle Ankle Strap' },
      ],
      type: 'variable',
      variations: [
        {
          id: 'var-103-38',
          sku: 'DM-SHU-103-38',
          attributes: { Size: 'EU 38', Color: 'Black & Champagne Gold' },
          price: 88000,
          salePrice: 74000,
          stockQuantity: 6,
          inStock: true,
        },
        {
          id: 'var-103-39',
          sku: 'DM-SHU-103-39',
          attributes: { Size: 'EU 39', Color: 'Black & Champagne Gold' },
          price: 88000,
          salePrice: 74000,
          stockQuantity: 8,
          inStock: true,
        },
        {
          id: 'var-103-40',
          sku: 'DM-SHU-103-40',
          attributes: { Size: 'EU 40', Color: 'Black & Champagne Gold' },
          price: 88000,
          salePrice: 74000,
          stockQuantity: 6,
          inStock: true,
        },
      ],
      codAllowed: true,
      returnPolicy: {
        enabled: true,
        returnWindowDays: 5,
        eligibleConditions: 'Unworn heels tried indoors on carpeted surfaces only, with gold heel tips unscratched.',
        nonReturnableConditions: 'Satin snags, stretched ankle straps, or scuffed soles/heel caps.',
        exchangeRules: 'Size exchange permitted within 5 days of delivery.',
        refundConditions: 'Refund processed within 3 business days of quality inspection.',
        returnShippingPayer: 'customer',
        formattedText:
          'Due to the delicate satin finish, returns and size exchanges are accepted within 5 days only when unworn and free of heel or strap marks.',
      },
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'prod-dm-104',
      slug: 'obsidian-tailored-senator-two-piece-set',
      name: 'Obsidian Linen Tailored Two-Piece & Formal Set',
      sku: 'DM-WR-104',
      brand: 'Diamond Couture',
      material: 'Breathable Belgian Cotton-Linen Blend (240 GSM)',
      shortDescription:
        'Crisp charcoal-black Mandarin-collar tunic and tailored pleated trousers with brushed brass button detail.',
      description:
        '<h3>Precision Contemporary Tailoring</h3><p>Designed for Nigerian climate comfort without sacrificing sharp executive structure. The subtle tonal chest embroidery and brushed brass collar stud deliver understated luxury for Friday receptions and milestone occasions.</p><ul><li>Structured Mandarin neckline with signature brass stud</li><li>Straight-leg tailored trousers with side-tab waist adjusters</li><li>Breathable high-twist linen-cotton fabric</li></ul>',
      careInstructions: 'Dry clean only or cool steam press inside-out.',
      price: 125000,
      salePrice: null,
      categoryId: 'cat-wears',
      categoryName: 'Wears',
      categorySlug: 'wears',
      subcategoryId: 'cat-tailored',
      subcategoryName: 'Two-Piece & Tailored Suits',
      tags: ['two-piece', 'senator', 'tailored', 'suit', 'wears'],
      images: [
        '/src/assets/images/prod_tailored_two_piece_1795178922245.jpg',
        '/src/assets/images/hero_diamond_fashion_1795178919083.jpg',
      ],
      stockQuantity: 15,
      manageStock: true,
      lowStockThreshold: 3,
      inStock: true,
      status: 'publish',
      featured: true,
      isNewArrival: true,
      isBestSeller: true,
      salesCount: 0,
      averageRating: 0,
      reviewCount: 0,
      weightKg: 0.9,
      dimensions: 'Garment Box',
      specifications: [
        { label: 'Fabric', value: 'Cotton-Linen 240 GSM Weave' },
        { label: 'Fit', value: 'Modern Tailored Silhouette' },
        { label: 'Hardware', value: 'Signature Brushed Gold Button' },
      ],
      type: 'variable',
      variations: [
        {
          id: 'var-104-m',
          sku: 'DM-WR-104-M',
          attributes: { Size: 'M (Chest 40")', Color: 'Charcoal Black' },
          price: 125000,
          salePrice: null,
          stockQuantity: 5,
          inStock: true,
        },
        {
          id: 'var-104-l',
          sku: 'DM-WR-104-L',
          attributes: { Size: 'L (Chest 42")', Color: 'Charcoal Black' },
          price: 125000,
          salePrice: null,
          stockQuantity: 6,
          inStock: true,
        },
        {
          id: 'var-104-xl',
          sku: 'DM-WR-104-XL',
          attributes: { Size: 'XL (Chest 44")', Color: 'Charcoal Black' },
          price: 125000,
          salePrice: null,
          stockQuantity: 4,
          inStock: true,
        },
      ],
      codAllowed: true,
      returnPolicy: {
        enabled: true,
        returnWindowDays: 7,
        eligibleConditions: 'Unwashed, unaltered garments with original Diamond Market swing tags attached.',
        nonReturnableConditions: 'Perfume scent, deodorant marks, tailored alterations, or detached tags.',
        exchangeRules: 'Free exchange for a different chest/waist size within 7 days.',
        refundConditions: 'Full refund issued once garment passes fabric and tag check.',
        returnShippingPayer: 'store',
        formattedText:
          'Returns or size exchanges are covered within 7 days for unworn, unaltered garments with tags still attached. Diamond Market covers return pickup within Oyo & Lagos for size swaps.',
      },
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'prod-dm-105',
      slug: 'noir-heavyweight-hoodie-ivory-trousers-set',
      name: 'Noir 450GSM Hoodie & Ivory Pleated Trousers',
      sku: 'DM-WR-105',
      brand: 'Diamond Street',
      material: '450 GSM Combed French Terry Cotton & Twill Trousers',
      shortDescription:
        'Structured heavyweight black cotton hoodie paired with crisp stone-ivory pleated casual trousers.',
      description:
        '<h3>Elevated Weekend Dressing</h3><p>Engineered to hold an architectural drape wash after wash. The double-lined hood and relaxed pleated trousers bridge streetwear comfort and quiet boutique luxury.</p><ul><li>450 GSM organic ring-spun cotton fleece</li><li>Double-pleated ivory cotton twill trousers</li><li>Clean rib-knit cuffs with zero pilling</li></ul>',
      price: 82000,
      salePrice: 69500,
      categoryId: 'cat-wears',
      categoryName: 'Wears',
      categorySlug: 'wears',
      subcategoryId: 'cat-casualwear',
      subcategoryName: 'Hoodies & Casualwear',
      tags: ['hoodie', 'trousers', 'casual', 'streetwear', 'wears'],
      images: ['/src/assets/images/prod_essential_hoodie_1795178922447.jpg'],
      stockQuantity: 22,
      manageStock: true,
      lowStockThreshold: 5,
      inStock: true,
      status: 'publish',
      featured: true,
      isNewArrival: false,
      isBestSeller: true,
      salesCount: 0,
      averageRating: 0,
      reviewCount: 0,
      weightKg: 1.05,
      dimensions: 'Folded Pack',
      specifications: [
        { label: 'Hoodie Weight', value: '450 GSM Heavyweight French Terry' },
        { label: 'Trousers', value: 'Stone-Ivory Pleated Cotton Twill' },
        { label: 'Fit', value: 'Relaxed Structured Fit' },
      ],
      type: 'variable',
      variations: [
        {
          id: 'var-105-m',
          sku: 'DM-WR-105-M',
          attributes: { Size: 'M', Style: '2-Piece Full Set' },
          price: 82000,
          salePrice: 69500,
          stockQuantity: 8,
          inStock: true,
        },
        {
          id: 'var-105-l',
          sku: 'DM-WR-105-L',
          attributes: { Size: 'L', Style: '2-Piece Full Set' },
          price: 82000,
          salePrice: 69500,
          stockQuantity: 9,
          inStock: true,
        },
        {
          id: 'var-105-xl',
          sku: 'DM-WR-105-XL',
          attributes: { Size: 'XL', Style: '2-Piece Full Set' },
          price: 82000,
          salePrice: 69500,
          stockQuantity: 5,
          inStock: true,
        },
      ],
      codAllowed: true,
      returnPolicy: {
        enabled: true,
        returnWindowDays: 7,
        eligibleConditions: 'Unworn, unwashed full set with original tags intact.',
        nonReturnableConditions: 'Washed, stained, or separated single pieces of a 2-piece bundle.',
        exchangeRules: 'Exchanges accepted as a complete set within 7 days.',
        refundConditions: 'Refund to original payment channel within 3–5 business days.',
        returnShippingPayer: 'customer',
        formattedText:
          'Both the hoodie and trousers must be returned together unworn with tags within 7 days for an exchange or full refund.',
      },
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'prod-dm-106',
      slug: 'atelier-calfskin-tote-and-gold-buckle-belt',
      name: 'Atelier Calfskin Tote & Champagne Buckle Belt',
      sku: 'DM-ACC-106',
      brand: 'Diamond Atelier',
      material: 'Grained Black Calfskin & Brushed Brass Hardware',
      shortDescription:
        'Structured architectural black leather tote paired with a matching champagne-gold buckle dress belt.',
      description:
        '<h3>Signature Leather Craftsmanship</h3><p>Cut from scratch-resistant pebbled calfskin leather and finished with tonal edge paint. Generously proportioned for daily essentials, documents, or weekend carry, paired seamlessly with a solid brass-buckled leather belt.</p>',
      price: 135000,
      salePrice: 112000,
      categoryId: 'cat-accessories',
      categoryName: 'Accessories',
      categorySlug: 'accessories',
      tags: ['bag', 'belt', 'leather', 'accessories', 'gold'],
      images: ['/src/assets/images/prod_crafted_leather_bag_1795178922982.jpg'],
      stockQuantity: 14,
      manageStock: true,
      lowStockThreshold: 3,
      inStock: true,
      status: 'publish',
      featured: true,
      isNewArrival: true,
      isBestSeller: false,
      salesCount: 0,
      averageRating: 0,
      reviewCount: 0,
      weightKg: 1.3,
      dimensions: '38 x 29 x 16 cm',
      specifications: [
        { label: 'Leather', value: 'Pebbled Full-Grain Calfskin' },
        { label: 'Hardware', value: 'Brushed Champagne Gold Brass' },
        { label: 'Includes', value: 'Structured Tote + Matching Belt + Dust Bag' },
      ],
      type: 'simple',
      variations: [],
      codAllowed: true,
      returnPolicy: {
        enabled: true,
        returnWindowDays: 7,
        eligibleConditions: 'Unused leather goods with protective hardware stickers and dust bag.',
        nonReturnableConditions: 'Belt holes punctured additionally, creased leather, or missing hardware wrap.',
        exchangeRules: 'Exchangeable within 7 days if unopened/unused.',
        refundConditions: '100% refund minus return courier fee unless defective.',
        returnShippingPayer: 'customer',
        formattedText:
          'Eligible for 7-day return provided all protective hardware films, tags, and the Diamond Market dust bag are untouched.',
      },
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'prod-dm-107',
      slug: 'veloce-monochrome-knit-athletic-trainers',
      name: 'Veloce Knit & Leather Sculpted Runners',
      sku: 'DM-SHU-107',
      brand: 'Diamond Sport',
      material: 'Engineered Charcoal Mesh Knit, Calfskin Overlays & Dual-Density Sole',
      shortDescription:
        'Featherlight monochrome knit runners with matte black leather heel support and sculpted ivory cushioning.',
      description:
        '<h3>Dynamic Performance Meets Luxury Form</h3><p>Engineered for long walks, travel days, and active city schedules. The breathable charcoal knit upper adapts to your foot shape while full leather panels add structure and durability.</p>',
      price: 78000,
      salePrice: 64500,
      categoryId: 'cat-shoes',
      categoryName: 'Shoes',
      categorySlug: 'shoes',
      subcategoryId: 'cat-sneakers',
      subcategoryName: 'Sneakers',
      tags: ['trainers', 'runners', 'sneakers', 'sport', 'shoes'],
      images: ['/src/assets/images/prod_running_trainers_1795178922046.jpg'],
      stockQuantity: 25,
      manageStock: true,
      lowStockThreshold: 5,
      inStock: true,
      status: 'publish',
      featured: false,
      isNewArrival: true,
      isBestSeller: true,
      salesCount: 0,
      averageRating: 0,
      reviewCount: 0,
      weightKg: 0.95,
      dimensions: '33 x 23 x 12 cm',
      specifications: [
        { label: 'Upper', value: 'Breathable Charcoal Knit + Matte Leather' },
        { label: 'Midsole', value: 'High-Rebound Sculpted EVA' },
        { label: 'Weight', value: '310g per shoe' },
      ],
      type: 'variable',
      variations: [
        {
          id: 'var-107-41',
          sku: 'DM-SHU-107-41',
          attributes: { Size: 'EU 41', Color: 'Charcoal / Black' },
          price: 78000,
          salePrice: 64500,
          stockQuantity: 8,
          inStock: true,
        },
        {
          id: 'var-107-42',
          sku: 'DM-SHU-107-42',
          attributes: { Size: 'EU 42', Color: 'Charcoal / Black' },
          price: 78000,
          salePrice: 64500,
          stockQuantity: 9,
          inStock: true,
        },
        {
          id: 'var-107-44',
          sku: 'DM-SHU-107-44',
          attributes: { Size: 'EU 44', Color: 'Charcoal / Black' },
          price: 78000,
          salePrice: 64500,
          stockQuantity: 8,
          inStock: true,
        },
      ],
      codAllowed: true,
      returnPolicy: {
        enabled: true,
        returnWindowDays: 7,
        eligibleConditions: 'Clean ivory outsoles and unworn knit uppers in original packaging.',
        nonReturnableConditions: 'Dirt on sculpted ivory outsole or stretched knit collar.',
        exchangeRules: 'Quick EU size swap within 7 days.',
        refundConditions: 'Refund within 3–5 business days upon clean return.',
        returnShippingPayer: 'customer',
        formattedText:
          'Returns accepted within 7 days of delivery when outsoles remain spotless and original packaging is complete.',
      },
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'prod-dm-108',
      slug: 'diamond-signature-capsule-wardrobe-edit',
      name: 'Diamond Signature Shoes & Blazer Edit',
      sku: 'DM-BND-108',
      brand: 'Diamond Atelier',
      material: 'Curated Capsule Bundle',
      shortDescription:
        'Complete luxury wardrobe pairing: charcoal tailored suit ensemble with your choice of loafers or leather sneakers.',
      description:
        '<h3>The Complete Diamond Market Look</h3><p>Curated by our Ogbomoso styling desk for weddings, executive engagements, and effortless wardrobe upgrades. Save ₦25,000 when ordering the tailored ensemble and signature footwear together.</p>',
      price: 215000,
      salePrice: 185000,
      categoryId: 'cat-wears',
      categoryName: 'Wears',
      categorySlug: 'wears',
      subcategoryId: 'cat-tailored',
      subcategoryName: 'Two-Piece & Tailored Suits',
      tags: ['bundle', 'capsule', 'shoes', 'wears', 'special offer'],
      images: [
        '/src/assets/images/hero_diamond_fashion_1795178919083.jpg',
        '/src/assets/images/prod_suede_loafers_1795178922817.jpg',
        '/src/assets/images/prod_tailored_two_piece_1795178922245.jpg',
      ],
      stockQuantity: 10,
      manageStock: true,
      lowStockThreshold: 3,
      inStock: true,
      status: 'publish',
      featured: true,
      isNewArrival: false,
      isBestSeller: false,
      salesCount: 0,
      averageRating: 0,
      reviewCount: 0,
      weightKg: 2.1,
      dimensions: 'Presentation Wardrobe Box',
      specifications: [
        { label: 'Includes', value: 'Tailored Ensemble + Signature Footwear' },
        { label: 'Bundle Savings', value: '₦30,000 Off Individual Retail' },
        { label: 'Packaging', value: 'Diamond Market Presentation Box' },
      ],
      type: 'variable',
      variations: [
        {
          id: 'var-108-mloaf',
          sku: 'DM-BND-108-M42',
          attributes: { Apparel: 'Size M', Footwear: 'Loafers EU 42' },
          price: 215000,
          salePrice: 185000,
          stockQuantity: 5,
          inStock: true,
        },
        {
          id: 'var-108-lsnk',
          sku: 'DM-BND-108-L43',
          attributes: { Apparel: 'Size L', Footwear: 'Sneakers EU 43' },
          price: 215000,
          salePrice: 185000,
          stockQuantity: 5,
          inStock: true,
        },
      ],
      codAllowed: true,
      returnPolicy: {
        enabled: true,
        returnWindowDays: 7,
        eligibleConditions: 'Unworn full bundle with all tags, garment bag, and shoebox intact.',
        nonReturnableConditions: 'Partial returns are only eligible for size exchange on one piece.',
        exchangeRules: 'Free individual garment or shoe size swap within 7 days.',
        refundConditions: 'Full refund when entire capsule bundle is returned untouched.',
        returnShippingPayer: 'store',
        formattedText:
          'Individual footwear or garment size exchanges are available within 7 days. Full bundle refunds require all pieces returned unused with original presentation packaging.',
      },
      createdAt: now,
      updatedAt: now,
    },
  ];

  const shippingZones: ShippingZone[] = [
    {
      id: 'zone-ogbomoso-oyo',
      name: 'Ogbomoso & Oyo State Dispatch',
      states: ['Oyo'],
      flatRate: 2000,
      freeShippingMinOrder: 120000,
      pickupAvailable: true,
      pickupAddress: 'Diamond Market Pickup Desk, Ogbomoso, Oyo State',
      estimatedDays: 'Same-day / Next business day',
      enabled: true,
    },
    {
      id: 'zone-sw-abuja',
      name: 'Lagos, Abuja FCT & South-West',
      states: ['Lagos', 'FCT - Abuja', 'Ogun', 'Osun', 'Ondo', 'Ekiti', 'Kwara'],
      flatRate: 4000,
      freeShippingMinOrder: 200000,
      pickupAvailable: false,
      estimatedDays: '1–3 business days',
      enabled: true,
    },
    {
      id: 'zone-nationwide',
      name: 'Nationwide Insured Courier (36 States)',
      states: ['ALL'],
      flatRate: 6000,
      freeShippingMinOrder: 300000,
      pickupAvailable: false,
      estimatedDays: '2–5 business days',
      enabled: true,
    },
  ];

  const coupons: Coupon[] = [
    {
      id: 'coup-diamond10',
      code: 'DIAMOND10',
      type: 'percent',
      amount: 10,
      description: '10% off shoes & wears orders above ₦40,000',
      minSpend: 40000,
      maxSpend: null,
      usageLimit: 500,
      usageCount: 0,
      expiryDate: '2027-12-31',
      active: true,
    },
    {
      id: 'coup-ogbomoso5k',
      code: 'OGBOMOSO5K',
      type: 'fixed_cart',
      amount: 5000,
      description: '₦5,000 welcome savings on orders above ₦60,000',
      minSpend: 60000,
      maxSpend: null,
      usageLimit: 300,
      usageCount: 0,
      expiryDate: '2027-12-31',
      active: true,
    },
  ];

  const storeSettings: StoreSettings = {
    storeName: 'Diamond Market',
    tagline: 'Premium Shoes & Wears — Style That Defines You',
    storeEmail: 'orders@diamondmarket.ng',
    phone: '07051959290',
    whatsapp: '07051959290',
    address: 'Ogbomoso, Oyo State, Nigeria',
    businessHours: '',
    currency: 'NGN',
    announcementBar:
      'New Shoes & Tailored Wears Collection Now Live — Free Oyo State delivery above ₦120,000 (Code: DIAMOND10)',
    announcementEnabled: true,
    heroEyebrow: 'Ogbomoso, Oyo State · Shoes & Wears',
    heroTitle: 'Step Into Your Style.',
    heroSubtitle:
      'Explore footwear and fashion essentials carefully selected to bring style, comfort, and confidence to every occasion.',
    heroCtaLabel: 'Shop Shoes',
    heroSecondaryCtaLabel: 'Explore Wears',
    heroImage: '/src/assets/images/hero_diamond_fashion_1795178919083.jpg',
    promoBannerTitle: 'Curated Shoes & Wears Delivered Nationwide From Ogbomoso',
    promoBannerSubtitle:
      'Order directly online or inquire on WhatsApp (07051959290). Pay securely with Paystack, Flutterwave, Direct Bank Transfer, or Pay on Delivery.',
    aboutUsText:
      'Diamond Market is a modern Nigerian fashion retailer based in Ogbomoso, Oyo State, specializing in carefully curated shoes, contemporary wears, and signature leather accessories.',
    footerTagline: 'Classic footwear, tailored wears & timeless fashion essentials.',
    termsText:
      'All orders placed on Diamond Market are subject to stock verification and payment confirmation. Prices are denominated in Nigerian Naira (NGN).',
    privacyText:
      'Customer profiles, delivery addresses, and authentication records are protected via Firebase Authentication and strict server-side access controls. Payment card details are processed securely by Paystack or Flutterwave and never stored on our servers.',
    refundPolicyText:
      'Approved returns are refunded within 3–5 business days to your original Paystack/Flutterwave method or nominated Nigerian bank account.',
    returnPolicyText:
      'Unworn shoes and unworn garments with original tags and boxes may be returned or exchanged within 7 days of delivery unless specified otherwise on the product page. Message Diamond Market on WhatsApp or call 07051959290 prior to shipping a return.',
    shippingPolicyText:
      'Orders placed before 2:00 PM qualify for same-day or next-day dispatch across Ogbomoso and Oyo State. Lagos, Abuja, and interstate deliveries arrive within 1–5 business days with tracking.',
    socialLinks: {
      instagram: 'https://instagram.com',
      twitter: 'https://x.com',
      facebook: 'https://facebook.com',
    },
    notificationSettings: {
      notifyAdminNewOrder: true,
      notifyAdminLowStock: true,
      notifyCustomerStatusUpdates: true,
    },
  };

  const paymentGateways: StoreDatabase['paymentGateways'] = {
    paystack: {
      id: 'paystack',
      title: 'Paystack',
      description: 'Cards, Bank Transfer, USSD, and Apple Pay via Paystack Nigeria',
      enabled: true,
      testMode: true,
      publicKey: process.env.PAYSTACK_PUBLIC_KEY || '',
    },
    flutterwave: {
      id: 'flutterwave',
      title: 'Flutterwave',
      description: 'Verve, Visa, Mastercard, Mobile Money & Bank Checkout via Flutterwave',
      enabled: true,
      testMode: true,
      publicKey: process.env.FLUTTERWAVE_PUBLIC_KEY || '',
    },
    bacs: {
      id: 'bacs',
      title: 'Direct Bank Transfer',
      description: 'Transfer directly to Diamond Market’s bank account and upload your transfer receipt.',
      enabled: true,
      bankName: 'Providus Bank PLC',
      accountName: 'Diamond Market Fashion Store',
      accountNumber: '1304928174',
      instructions:
        'Please include your Order Reference in your transfer narration. Orders remain On Hold until confirmed.',
      paymentDeadlineHours: 24,
      requireProofUpload: true,
    },
    cod: {
      id: 'cod',
      title: 'Pay on Delivery',
      description: 'Pay via POS card terminal or cash when our courier delivers to your door.',
      enabled: true,
      minOrderAmount: 10000,
      maxOrderAmount: 350000,
      supportedStates: ['Oyo', 'Lagos', 'FCT - Abuja', 'Ogun', 'Osun'],
      additionalFee: 1500,
      instructions:
        'Please ensure your phone number (07051959290 support line) is reachable on delivery day.',
    },
  };

  const initialCms = createDefaultCmsData(storeSettings);
  const nowIso = new Date().toISOString();

  return {
    categories,
    products,
    orders: [],
    customers: [],
    coupons,
    reviews: [],
    shippingZones,
    paymentGateways,
    storeSettings,
    deliverySettings: createDefaultDeliverySettings(),
    riders: [],
    deliveries: [],
    complaints: [],
    riderReviews: [],
    emailLogs: [],
    notifications: [],
    auditLogs: [],
    newsletterSubscribers: [],
    cmsPublished: initialCms,
    cmsDraft: JSON.parse(JSON.stringify(initialCms)) as CmsData,
    cmsLastPublishedAt: nowIso,
    cmsLastDraftSavedAt: nowIso,
    cmsLastPublishedBy: 'system',
    mediaLibrary: createInitialMediaLibrary(),
  };
}

class StoreEngine {
  private db: StoreDatabase;

  constructor() {
    ensureDataDir();
    if (fs.existsSync(DB_FILE)) {
      try {
        this.db = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8')) as StoreDatabase;
        this.migrateLegacyBrandingIfNeeded();
        this.ensureDeliveryMigrations();
        this.ensureCmsMigrations();
      } catch {
        this.db = createInitialStoreData();
        this.persist();
      }
    } else {
      this.db = createInitialStoreData();
      this.persist();
    }
  }

  private migrateLegacyBrandingIfNeeded(): void {
    const isLegacyStore =
      this.db.storeSettings?.storeName === 'Zora Market' ||
      this.db.products.some((p) => p.sku?.startsWith('ZORA-'));

    if (!isLegacyStore) return;

    const fresh = createInitialStoreData();
    this.db.storeSettings = { ...fresh.storeSettings };
    this.db.shippingZones = fresh.shippingZones;
    this.db.coupons = fresh.coupons;
    this.db.paymentGateways.bacs.accountName = fresh.paymentGateways.bacs.accountName;
    this.db.paymentGateways.cod.supportedStates = fresh.paymentGateways.cod.supportedStates;

    if (this.db.orders.length === 0) {
      this.db.categories = fresh.categories;
      this.db.products = fresh.products;
    }
    this.persist();
  }

  private ensureDeliveryMigrations(): void {
    let dirty = false;
    if (!this.db.deliverySettings) {
      this.db.deliverySettings = createDefaultDeliverySettings();
      dirty = true;
    }
    if (!Array.isArray(this.db.riders)) {
      this.db.riders = [];
      dirty = true;
    }
    if (!Array.isArray(this.db.deliveries)) {
      this.db.deliveries = [];
      dirty = true;
    }
    if (!Array.isArray(this.db.complaints)) {
      this.db.complaints = [];
      dirty = true;
    }
    if (!Array.isArray(this.db.riderReviews)) {
      this.db.riderReviews = [];
      dirty = true;
    }
    if (!Array.isArray(this.db.emailLogs)) {
      this.db.emailLogs = [];
      dirty = true;
    }

    // Ensure every existing order has a synchronized DeliveryRecord
    for (const order of this.db.orders) {
      const existing = this.db.deliveries.find((d) => d.orderId === order.id);
      if (!existing) {
        const delivery = this.buildDeliveryRecordFromOrder(order);
        this.db.deliveries.push(delivery);
        order.delivery = {
          ...order.delivery,
          deliveryId: delivery.id,
          status: delivery.status,
          deliveryType: delivery.deliveryType,
          otpRequired: delivery.otpRequired,
          otpVerified: delivery.otpVerified,
          customerConfirmed: delivery.confirmation.confirmed,
        };
        dirty = true;
      }
    }

    if (dirty) {
      this.persist();
    }
  }

  private getAppBaseUrl(): string {
    const envUrl = process.env.APP_URL;
    if (envUrl && envUrl !== 'MY_APP_URL') {
      return envUrl.replace(/\/+$/, '');
    }
    return 'http://localhost:3000';
  }

  private getConfirmationSigningSecret(): string {
    const secrets = loadSecrets() as RuntimeSecrets & { confirmationSecret?: string };
    if (process.env.RIDER_SESSION_SECRET && process.env.RIDER_SESSION_SECRET.length >= 16) {
      return process.env.RIDER_SESSION_SECRET + ':confirm';
    }
    if (secrets.confirmationSecret) return secrets.confirmationSecret;
    const generated = crypto.randomBytes(32).toString('hex');
    saveRuntimeSecrets({ ...secrets, confirmationSecret: generated } as Partial<RuntimeSecrets>);
    return generated;
  }

  private signConfirmationToken(delivery: StoredDeliveryRecord): string {
    if (!delivery.confirmationNonce) {
      delivery.confirmationNonce = crypto.randomBytes(16).toString('hex');
    }
    const payload = Buffer.from(
      JSON.stringify({
        d: delivery.id,
        o: delivery.orderId,
        n: delivery.confirmationNonce,
      }),
      'utf-8'
    ).toString('base64url');
    const sig = crypto
      .createHmac('sha256', this.getConfirmationSigningSecret())
      .update(payload)
      .digest('base64url');
    return `${payload}.${sig}`;
  }

  private verifyConfirmationToken(rawToken: string): { deliveryId: string; orderId: string; nonce: string } | null {
    if (!rawToken || !rawToken.includes('.')) return null;
    const [payload, sig] = rawToken.split('.');
    if (!payload || !sig) return null;
    const expected = crypto
      .createHmac('sha256', this.getConfirmationSigningSecret())
      .update(payload)
      .digest('base64url');
    try {
      const a = Buffer.from(sig);
      const b = Buffer.from(expected);
      if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
      const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8')) as {
        d?: string;
        o?: string;
        n?: string;
      };
      if (!decoded.d || !decoded.o || !decoded.n) return null;
      return { deliveryId: decoded.d, orderId: decoded.o, nonce: decoded.n };
    } catch {
      return null;
    }
  }

  private toPublicRider(rider: StoredRider): Rider {
    const { passwordHash: _ph, passwordSalt: _ps, ...clean } = rider;
    return clean;
  }

  private toPublicDelivery(delivery: StoredDeliveryRecord): DeliveryRecord {
    const {
      otpHash: _oh,
      otpSalt: _os,
      confirmationNonce: _cn,
      sentEmailEvents: _se,
      ...clean
    } = delivery;
    return clean;
  }

  private inferDeliveryType(state: string, pickupAtHub = false, shippingZoneName = ''): DeliveryType {
    if (pickupAtHub || shippingZoneName.toLowerCase().includes('pickup')) return 'pickup';
    const cleanState = (state || '').trim().toLowerCase();
    if (cleanState === 'oyo') return 'local';
    if (['lagos', 'fct - abuja', 'abuja', 'ogun', 'osun', 'ondo', 'ekiti', 'kwara'].includes(cleanState)) {
      return 'interstate';
    }
    return 'nationwide';
  }

  private computeOtpRequiredForOrder(order: Order): boolean {
    const ds = this.db.deliverySettings;
    if (!ds.otpEnabled) return false;
    if (ds.otpScope === 'cod_only') return order.paymentMethod === 'cod';
    if (ds.otpScope === 'above_threshold') return order.total >= ds.otpThresholdAmount;
    return true;
  }

  private buildDeliveryRecordFromOrder(order: Order, pickupAtHub = false): StoredDeliveryRecord {
    const ds = this.db.deliverySettings;
    const deliveryType = this.inferDeliveryType(order.billing.state, pickupAtHub, order.shippingZoneName);
    const transitMap: Record<DeliveryType, string> = {
      local: ds.estimatedTimes.local,
      interstate: ds.estimatedTimes.interstate,
      nationwide: ds.estimatedTimes.nationwide,
      pickup: ds.estimatedTimes.pickup,
    };
    const status = normalizeDeliveryStatus(order.delivery?.status);
    return {
      id: order.delivery?.deliveryId || `del-${crypto.randomUUID().slice(0, 8)}`,
      orderId: order.id,
      orderNumber: order.orderNumber,
      deliveryType,
      zoneName: order.shippingZoneName || 'Standard Delivery',
      deliveryFee: Number(order.shippingTotal || 0),
      estimatedDeliveryDate: order.delivery?.estimatedDeliveryDate || '',
      estimatedTransitWindow: transitMap[deliveryType],
      status,
      riderId: order.delivery?.riderId || null,
      riderCode: order.delivery?.riderCode,
      riderName: order.delivery?.riderName,
      riderPhone: order.delivery?.riderPhone,
      riderWhatsapp: order.delivery?.riderWhatsapp,
      riderVehicle: order.delivery?.riderVehicle,
      recipientName: `${order.billing.firstName} ${order.billing.lastName}`.trim(),
      customerEmail: order.customerEmail,
      customerPhone: order.billing.phone,
      addressStreet: order.billing.street,
      addressCity: order.billing.city,
      addressState: order.billing.state,
      deliveryInstructions: order.deliveryInstructions || '',
      courier: order.delivery?.courier || '',
      trackingNumber: order.delivery?.trackingNumber || '',
      otpRequired: this.computeOtpRequiredForOrder(order),
      otpVerified: Boolean(order.delivery?.otpVerified),
      otpAttemptsRemaining: ds.otpMaxAttempts,
      confirmationNonce: crypto.randomBytes(16).toString('hex'),
      confirmation: {
        confirmed: Boolean(order.delivery?.customerConfirmed),
        confirmedAt: order.delivery?.customerConfirmedAt,
        reminderCount: 0,
      },
      codAmountToCollect: order.paymentMethod === 'cod' && order.paymentStatus !== 'paid' ? order.total : 0,
      codCollected: false,
      history: [
        {
          id: `dh-${crypto.randomUUID().slice(0, 6)}`,
          fromStatus: null,
          toStatus: status,
          timestamp: order.createdAt || new Date().toISOString(),
          actorType: 'system',
          actorId: 'system',
          actorName: 'Diamond Market System',
          note: 'Delivery record initialized alongside order.',
        },
      ],
      sentEmailEvents: [],
      createdAt: order.createdAt || new Date().toISOString(),
      updatedAt: order.updatedAt || new Date().toISOString(),
    };
  }

  private syncDeliverySummaryOntoOrder(order: Order, delivery: StoredDeliveryRecord): void {
    order.delivery = {
      ...order.delivery,
      deliveryId: delivery.id,
      status: delivery.status,
      deliveryType: delivery.deliveryType,
      riderId: delivery.riderId || null,
      riderCode: delivery.riderCode,
      riderName: delivery.riderName,
      riderPhone: delivery.riderPhone,
      riderWhatsapp: delivery.riderWhatsapp,
      riderVehicle: delivery.riderVehicle,
      courier: delivery.courier,
      trackingNumber: delivery.trackingNumber,
      estimatedDeliveryDate: delivery.estimatedDeliveryDate,
      otpRequired: delivery.otpRequired,
      otpVerified: delivery.otpVerified,
      customerConfirmed: delivery.confirmation.confirmed,
      customerConfirmedAt: delivery.confirmation.confirmedAt,
      notes: delivery.history[0]?.note || order.delivery?.notes || '',
      updatedAt: delivery.updatedAt,
    };
    order.updatedAt = delivery.updatedAt;
  }

  private async triggerOrderEmail(params: {
    eventKey: EmailEventKey;
    order: Order;
    delivery?: StoredDeliveryRecord;
    otpCode?: string;
    complaint?: DeliveryComplaint;
    extraNote?: string;
    dedupeKey?: string;
    appBaseUrl?: string;
  }): Promise<{ sent: boolean; log: EmailLogEntry | null }> {
    const ds = this.db.deliverySettings;
    if (!ds.enableAutomatedEmails || !this.db.storeSettings.notificationSettings.notifyCustomerStatusUpdates) {
      return { sent: false, log: null };
    }
    const dedupe = params.dedupeKey || `${params.eventKey}:${params.order.id}`;
    if (params.delivery) {
      if (!Array.isArray(params.delivery.sentEmailEvents)) params.delivery.sentEmailEvents = [];
      if (params.dedupeKey !== '__allow_repeat__' && params.delivery.sentEmailEvents.includes(dedupe)) {
        return { sent: false, log: null };
      }
    }

    const baseUrl = params.appBaseUrl || this.getAppBaseUrl();
    const confirmToken = params.delivery ? this.signConfirmationToken(params.delivery) : undefined;
    const rendered = buildOrderEmail({
      eventKey: params.eventKey,
      settings: this.db.storeSettings,
      order: params.order,
      delivery: params.delivery ? this.toPublicDelivery(params.delivery) : undefined,
      appBaseUrl: baseUrl,
      confirmToken,
      otpCode: params.otpCode,
      complaint: params.complaint,
      extraNote: params.extraNote,
    });

    const dispatchRes = await dispatchTransactionalEmail({
      to: params.order.customerEmail,
      subject: rendered.subject,
      html: rendered.html,
      settings: this.db.storeSettings,
    });

    if (params.delivery && params.dedupeKey !== '__allow_repeat__') {
      params.delivery.sentEmailEvents!.push(dedupe);
    }

    const log: EmailLogEntry = {
      id: `mail-${crypto.randomUUID().slice(0, 8)}`,
      eventKey: params.eventKey,
      to: params.order.customerEmail,
      subject: rendered.subject,
      orderId: params.order.id,
      orderNumber: params.order.orderNumber,
      deliveryStatus: params.delivery?.status,
      transport: dispatchRes.transport,
      delivered: dispatchRes.delivered,
      error: dispatchRes.error,
      htmlPreview: rendered.html,
      createdAt: new Date().toISOString(),
    };
    this.db.emailLogs.unshift(log);
    this.db.emailLogs = this.db.emailLogs.slice(0, 150);
    this.persist();
    return { sent: dispatchRes.delivered, log };
  }

  private persist(): void {
    ensureDataDir();
    fs.writeFileSync(DB_FILE, JSON.stringify(this.db, null, 2));
  }

  private getWooClient(): WooCommerceClient | null {
    const secrets = loadSecrets();
    if (secrets.woocommerceUrl && secrets.wcConsumerKey && secrets.wcConsumerSecret) {
      return new WooCommerceClient({
        url: secrets.woocommerceUrl,
        consumerKey: secrets.wcConsumerKey,
        consumerSecret: secrets.wcConsumerSecret,
        bridgeSecret: secrets.wpBridgeSecret,
      });
    }
    return null;
  }

  getSecretsForServer(): RuntimeSecrets {
    return loadSecrets();
  }

  async getConnectionStatus(): Promise<ConnectionStatus> {
    const secrets = loadSecrets();
    const firebaseConfig = JSON.parse(
      fs.readFileSync(path.resolve(process.cwd(), 'firebase-applet-config.json'), 'utf-8')
    ) as { projectId: string };

    if (!secrets.woocommerceUrl || !secrets.wcConsumerKey || !secrets.wcConsumerSecret) {
      return {
        mode: 'sandbox',
        connected: false,
        woocommerceUrl: null,
        firebaseProjectId: firebaseConfig.projectId,
        message:
          'Development Sandbox Active — WordPress/WooCommerce URL & REST keys are not configured yet. Configure them in Admin -> Store Settings or .env to switch to live WooCommerce sync.',
      };
    }

    const client = this.getWooClient();
    const test = client ? await client.testConnection() : { ok: false, error: 'Missing client' };
    return {
      mode: test.ok ? 'woocommerce' : 'sandbox',
      connected: test.ok,
      woocommerceUrl: secrets.woocommerceUrl,
      firebaseProjectId: firebaseConfig.projectId,
      message: test.ok
        ? `Connected to live WooCommerce (${test.storeVersion})`
        : `WooCommerce configured (${secrets.woocommerceUrl}) but unreachable: ${test.error}`,
    };
  }

  async configureWooCommerceConnection(
    actorEmail: string,
    payload: {
      woocommerceUrl: string;
      consumerKey?: string;
      consumerSecret?: string;
      bridgeSecret?: string;
    }
  ): Promise<ConnectionStatus> {
    const patch: Partial<RuntimeSecrets> = {
      woocommerceUrl: payload.woocommerceUrl.trim(),
    };
    if (payload.consumerKey?.trim()) patch.wcConsumerKey = payload.consumerKey.trim();
    if (payload.consumerSecret?.trim()) patch.wcConsumerSecret = payload.consumerSecret.trim();
    if (payload.bridgeSecret?.trim()) patch.wpBridgeSecret = payload.bridgeSecret.trim();

    saveRuntimeSecrets(patch);
    this.recordAudit(actorEmail, 'UPDATE_WOOCOMMERCE_CONNECTION', 'store_connection', payload.woocommerceUrl);
    return this.getConnectionStatus();
  }

  // --- Categories ---
  async getCategories(includeHidden = false): Promise<Category[]> {
    const wc = this.getWooClient();
    if (wc) {
      try {
        return await wc.getCategories();
      } catch (err) {
        console.error('WooCommerce getCategories fallback:', err);
      }
    }
    const list = this.db.categories
      .filter((c) => includeHidden || c.visible !== false)
      .map((c, idx) => ({
        ...c,
        visible: c.visible ?? true,
        sortOrder: c.sortOrder ?? idx + 1,
        productCount: this.db.products.filter(
          (p) => (p.categoryId === c.id || p.subcategoryId === c.id) && p.status === 'publish'
        ).length,
      }));
    list.sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999));
    return list;
  }

  async createCategory(actorEmail: string, input: Partial<Category>): Promise<Category> {
    const wc = this.getWooClient();
    if (wc) {
      const created = await wc.createCategory({
        name: input.name || 'New Category',
        slug: input.slug,
        description: input.description,
        parentId: input.parentId,
        image: input.image,
      });
      this.recordAudit(actorEmail, 'CREATE_CATEGORY', `category:${created.id}`, created.name);
      return created;
    }

    const name = (input.name || 'New Category').trim();
    const slug = input.slug?.trim() ? slugify(input.slug) : slugify(name);
    const maxSort = this.db.categories.reduce((acc, c) => Math.max(acc, c.sortOrder ?? 0), 0);

    const category: Category = {
      id: `cat-${crypto.randomUUID().slice(0, 8)}`,
      name,
      slug: slug || `cat-${Date.now().toString().slice(-4)}`,
      description: input.description || '',
      parentId: input.parentId || null,
      image: input.image || '',
      bannerImage: input.bannerImage || '',
      featured: Boolean(input.featured),
      visible: input.visible ?? true,
      sortOrder: input.sortOrder ?? maxSort + 1,
      createdAt: new Date().toISOString(),
    };
    this.db.categories.push(category);
    this.recordAudit(actorEmail, 'CREATE_CATEGORY', `category:${category.id}`, category.name);
    this.persist();
    return category;
  }

  async updateCategory(actorEmail: string, id: string, patch: Partial<Category>): Promise<Category> {
    const wc = this.getWooClient();
    if (wc) {
      const updated = await wc.updateCategory(id, patch);
      this.recordAudit(actorEmail, 'UPDATE_CATEGORY', `category:${id}`, updated.name);
      return updated;
    }

    const idx = this.db.categories.findIndex((c) => c.id === id);
    if (idx === -1) throw new Error('Category not found');

    const current = this.db.categories[idx];
    const nextName = patch.name !== undefined ? patch.name.trim() : current.name;
    const nextSlug =
      patch.slug !== undefined && patch.slug.trim()
        ? slugify(patch.slug)
        : patch.name !== undefined && !patch.slug
        ? slugify(nextName)
        : current.slug;

    const updated: Category = {
      ...current,
      ...patch,
      id: current.id,
      name: nextName,
      slug: nextSlug || current.slug,
    };

    this.db.categories[idx] = updated;

    // Keep linked products synchronized with renamed category/slug
    for (let i = 0; i < this.db.products.length; i++) {
      if (this.db.products[i].categoryId === id) {
        this.db.products[i].categoryName = updated.name;
        this.db.products[i].categorySlug = updated.slug;
      }
      if (this.db.products[i].subcategoryId === id) {
        this.db.products[i].subcategoryName = updated.name;
      }
    }

    this.recordAudit(actorEmail, 'UPDATE_CATEGORY', `category:${id}`, updated.name);
    this.persist();
    return updated;
  }

  async reorderCategories(actorEmail: string, orderedIds: string[]): Promise<Category[]> {
    orderedIds.forEach((id, idx) => {
      const cat = this.db.categories.find((c) => c.id === id);
      if (cat) {
        cat.sortOrder = idx + 1;
      }
    });
    this.recordAudit(actorEmail, 'REORDER_CATEGORIES', 'categories', `Reordered ${orderedIds.length} categories`);
    this.persist();
    return this.getCategories(true);
  }

  async deleteCategory(actorEmail: string, id: string): Promise<void> {
    const wc = this.getWooClient();
    if (wc) {
      await wc.deleteCategory(id);
      this.recordAudit(actorEmail, 'DELETE_CATEGORY', `category:${id}`, 'Deleted WooCommerce category safely');
      return;
    }

    const fallback = this.db.categories.find((c) => c.id !== id && !c.parentId) || this.db.categories.find((c) => c.id !== id);
    // Safely preserve products: move orphaned products to fallback or uncategorized, and detach child subcategories
    for (const prod of this.db.products) {
      if (prod.categoryId === id) {
        prod.categoryId = fallback ? fallback.id : 'uncategorized';
        prod.categoryName = fallback ? fallback.name : 'Uncategorized';
        prod.categorySlug = fallback ? fallback.slug : 'uncategorized';
      }
      if (prod.subcategoryId === id) {
        prod.subcategoryId = null;
        prod.subcategoryName = undefined;
      }
    }
    for (const cat of this.db.categories) {
      if (cat.parentId === id) {
        cat.parentId = null;
      }
    }

    this.db.categories = this.db.categories.filter((c) => c.id !== id);
    this.recordAudit(actorEmail, 'DELETE_CATEGORY', `category:${id}`, 'Safely deleted category without losing products');
    this.persist();
  }

  // --- Products ---
  async getProducts(includeDrafts = false): Promise<Product[]> {
    const wc = this.getWooClient();
    if (wc) {
      try {
        const products = await wc.getProducts();
        return includeDrafts ? products : products.filter((p) => p.status === 'publish');
      } catch (err) {
        console.error('WooCommerce getProducts fallback:', err);
      }
    }
    return includeDrafts ? this.db.products : this.db.products.filter((p) => p.status === 'publish');
  }

  async getProductByIdOrSlug(idOrSlug: string): Promise<Product | null> {
    const products = await this.getProducts(true);
    return products.find((p) => p.id === idOrSlug || p.slug === idOrSlug) || null;
  }

  async createProduct(actorEmail: string, input: Partial<Product>): Promise<Product> {
    const wc = this.getWooClient();
    if (wc) {
      const created = await wc.createProduct(input);
      this.recordAudit(actorEmail, 'CREATE_PRODUCT', `product:${created.id}`, created.name);
      return created;
    }

    const now = new Date().toISOString();
    const id = `prod-dm-${crypto.randomUUID().slice(0, 6)}`;
    const cat = this.db.categories.find((c) => c.id === input.categoryId) || this.db.categories[0];
    const subCat = input.subcategoryId
      ? this.db.categories.find((c) => c.id === input.subcategoryId)
      : undefined;

    const name = (input.name || 'Untitled Fashion Item').trim();
    const slug =
      input.slug?.trim()
        ? slugify(input.slug)
        : `${slugify(name)}-${id.slice(-4)}`;

    const stockQty = Number(input.stockQuantity ?? 0);
    const product: Product = {
      id,
      slug,
      name,
      sku: input.sku?.trim() || `DM-${id.slice(-4).toUpperCase()}`,
      brand: input.brand || 'Diamond Market',
      material: input.material || '',
      careInstructions: input.careInstructions || '',
      sizeGuide: input.sizeGuide || '',
      shortDescription: input.shortDescription || '',
      description: input.description || '',
      price: Number(input.price || 0),
      salePrice: input.salePrice ? Number(input.salePrice) : null,
      saleStartDate: input.saleStartDate || null,
      saleEndDate: input.saleEndDate || null,
      categoryId: cat?.id || 'cat-shoes',
      categoryName: cat?.name || 'General',
      categorySlug: cat?.slug || 'general',
      subcategoryId: subCat ? subCat.id : input.subcategoryId || null,
      subcategoryName: subCat?.name,
      tags: Array.isArray(input.tags) ? input.tags : [],
      images: Array.isArray(input.images) && input.images.length > 0 ? input.images : [],
      stockQuantity: stockQty,
      manageStock: input.manageStock ?? true,
      lowStockThreshold: Number(input.lowStockThreshold ?? 5),
      inStock: (input.manageStock ?? true) ? stockQty > 0 : true,
      status: input.status || 'publish',
      featured: Boolean(input.featured),
      isNewArrival: input.isNewArrival ?? true,
      isBestSeller: Boolean(input.isBestSeller),
      salesCount: 0,
      averageRating: 0,
      reviewCount: 0,
      weightKg: input.weightKg,
      dimensions: input.dimensions,
      specifications: Array.isArray(input.specifications) ? input.specifications : [],
      type: input.type || 'simple',
      variations: Array.isArray(input.variations) ? input.variations : [],
      codAllowed: input.codAllowed ?? true,
      seoTitle: input.seoTitle || '',
      seoDescription: input.seoDescription || '',
      returnPolicy: input.returnPolicy ?? null,
      createdAt: now,
      updatedAt: now,
    };

    this.db.products.unshift(product);
    this.recordAudit(actorEmail, 'CREATE_PRODUCT', `product:${product.id}`, product.name);
    this.persist();
    return product;
  }

  async updateProduct(actorEmail: string, id: string, patch: Partial<Product>): Promise<Product> {
    const wc = this.getWooClient();
    if (wc) {
      const updated = await wc.updateProduct(id, patch);
      this.recordAudit(actorEmail, 'UPDATE_PRODUCT', `product:${id}`, updated.name);
      return updated;
    }

    const idx = this.db.products.findIndex((p) => p.id === id);
    if (idx === -1) throw new Error('Product not found');
    const current = this.db.products[idx];
    const nextCat = patch.categoryId
      ? this.db.categories.find((c) => c.id === patch.categoryId)
      : undefined;
    const nextSubCat =
      patch.subcategoryId !== undefined
        ? this.db.categories.find((c) => c.id === patch.subcategoryId)
        : undefined;

    const nextStock =
      patch.stockQuantity !== undefined ? Number(patch.stockQuantity) : current.stockQuantity;
    const nextManage = patch.manageStock !== undefined ? patch.manageStock : current.manageStock;

    const updated: Product = {
      ...current,
      ...patch,
      id: current.id,
      slug: patch.slug ? slugify(patch.slug) : current.slug,
      categoryName: nextCat ? nextCat.name : current.categoryName,
      categorySlug: nextCat ? nextCat.slug : current.categorySlug,
      subcategoryId: patch.subcategoryId !== undefined ? patch.subcategoryId : current.subcategoryId,
      subcategoryName:
        patch.subcategoryId !== undefined
          ? nextSubCat?.name || undefined
          : current.subcategoryName,
      stockQuantity: nextStock,
      manageStock: nextManage,
      inStock: nextManage ? nextStock > 0 : patch.inStock ?? current.inStock,
      updatedAt: new Date().toISOString(),
    };

    this.db.products[idx] = updated;
    this.checkStockNotification(updated);
    this.recordAudit(actorEmail, 'UPDATE_PRODUCT', `product:${id}`, updated.name);
    this.persist();
    return updated;
  }

  async duplicateProduct(actorEmail: string, id: string): Promise<Product> {
    const source = this.db.products.find((p) => p.id === id);
    if (!source) throw new Error('Product not found');

    const now = new Date().toISOString();
    const newId = `prod-dm-${crypto.randomUUID().slice(0, 6)}`;
    const copy: Product = {
      ...JSON.parse(JSON.stringify(source)),
      id: newId,
      name: `${source.name} (Copy)`,
      slug: `${source.slug}-copy-${newId.slice(-4)}`,
      sku: `${source.sku}-COPY-${newId.slice(-3).toUpperCase()}`,
      status: 'draft',
      salesCount: 0,
      averageRating: 0,
      reviewCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    this.db.products.unshift(copy);
    this.recordAudit(actorEmail, 'DUPLICATE_PRODUCT', `product:${copy.id}`, `Cloned from ${source.sku}`);
    this.persist();
    return copy;
  }

  async deleteProduct(actorEmail: string, id: string, archiveOnly = false): Promise<void> {
    const wc = this.getWooClient();
    if (wc && !archiveOnly) {
      await wc.deleteProduct(id);
      this.recordAudit(actorEmail, 'DELETE_PRODUCT', `product:${id}`, 'Deleted from WooCommerce');
      return;
    }

    if (archiveOnly) {
      await this.updateProduct(actorEmail, id, { status: 'archived' });
      return;
    }

    this.db.products = this.db.products.filter((p) => p.id !== id);
    this.recordAudit(actorEmail, 'DELETE_PRODUCT', `product:${id}`, 'Deleted product');
    this.persist();
  }

  // --- Payment Gateways ---
  getPublicPaymentGateways() {
    const g = this.db.paymentGateways;
    const list: {
      id: PaymentMethodId;
      title: string;
      description: string;
      enabled: boolean;
      testMode?: boolean;
      instructions?: string;
      bankDetails?: {
        bankName: string;
        accountName: string;
        accountNumber: string;
        paymentDeadlineHours: number;
        requireProofUpload: boolean;
      };
      codRules?: {
        minOrderAmount: number;
        maxOrderAmount: number;
        supportedStates: string[];
        additionalFee: number;
      };
    }[] = [];

    if (g.paystack.enabled) {
      list.push({
        id: 'paystack',
        title: g.paystack.title,
        description: g.paystack.description,
        enabled: true,
        testMode: g.paystack.testMode,
      });
    }
    if (g.flutterwave.enabled) {
      list.push({
        id: 'flutterwave',
        title: g.flutterwave.title,
        description: g.flutterwave.description,
        enabled: true,
        testMode: g.flutterwave.testMode,
      });
    }
    if (g.bacs.enabled) {
      list.push({
        id: 'bacs',
        title: g.bacs.title,
        description: g.bacs.description,
        enabled: true,
        instructions: g.bacs.instructions,
        bankDetails: {
          bankName: g.bacs.bankName,
          accountName: g.bacs.accountName,
          accountNumber: g.bacs.accountNumber,
          paymentDeadlineHours: g.bacs.paymentDeadlineHours,
          requireProofUpload: g.bacs.requireProofUpload,
        },
      });
    }
    if (g.cod.enabled) {
      list.push({
        id: 'cod',
        title: g.cod.title,
        description: g.cod.description,
        enabled: true,
        instructions: g.cod.instructions,
        codRules: {
          minOrderAmount: g.cod.minOrderAmount,
          maxOrderAmount: g.cod.maxOrderAmount,
          supportedStates: g.cod.supportedStates,
          additionalFee: g.cod.additionalFee,
        },
      });
    }
    return list;
  }

  getAdminPaymentGateways(): PaymentGatewaysSettings {
    const secrets = loadSecrets();
    const g = this.db.paymentGateways;
    return {
      paystack: {
        ...g.paystack,
        hasSecretKey: Boolean(secrets.paystackSecretKey),
        secretKeyMasked: maskSecret(secrets.paystackSecretKey),
      },
      flutterwave: {
        ...g.flutterwave,
        hasSecretKey: Boolean(secrets.flutterwaveSecretKey),
        secretKeyMasked: maskSecret(secrets.flutterwaveSecretKey),
        hasWebhookHash: Boolean(secrets.flutterwaveWebhookHash),
      },
      bacs: { ...g.bacs },
      cod: { ...g.cod },
    };
  }

  async updatePaymentGatewayConfig(
    actorEmail: string,
    gatewayId: PaymentMethodId,
    payload: Record<string, unknown>
  ): Promise<PaymentGatewaysSettings> {
    const wc = this.getWooClient();

    if (gatewayId === 'paystack') {
      const curr = this.db.paymentGateways.paystack;
      this.db.paymentGateways.paystack = {
        ...curr,
        enabled: payload.enabled !== undefined ? Boolean(payload.enabled) : curr.enabled,
        testMode: payload.testMode !== undefined ? Boolean(payload.testMode) : curr.testMode,
        publicKey: typeof payload.publicKey === 'string' ? payload.publicKey.trim() : curr.publicKey,
        title: typeof payload.title === 'string' ? payload.title.trim() : curr.title,
        description:
          typeof payload.description === 'string' ? payload.description.trim() : curr.description,
      };
      if (typeof payload.secretKey === 'string' && payload.secretKey.trim()) {
        saveRuntimeSecrets({ paystackSecretKey: payload.secretKey.trim() });
      }
      if (wc) {
        await wc.updatePaymentGateway('paystack', this.db.paymentGateways.paystack.enabled).catch(() => {});
      }
    } else if (gatewayId === 'flutterwave') {
      const curr = this.db.paymentGateways.flutterwave;
      this.db.paymentGateways.flutterwave = {
        ...curr,
        enabled: payload.enabled !== undefined ? Boolean(payload.enabled) : curr.enabled,
        testMode: payload.testMode !== undefined ? Boolean(payload.testMode) : curr.testMode,
        publicKey: typeof payload.publicKey === 'string' ? payload.publicKey.trim() : curr.publicKey,
        title: typeof payload.title === 'string' ? payload.title.trim() : curr.title,
        description:
          typeof payload.description === 'string' ? payload.description.trim() : curr.description,
      };
      if (typeof payload.secretKey === 'string' && payload.secretKey.trim()) {
        saveRuntimeSecrets({ flutterwaveSecretKey: payload.secretKey.trim() });
      }
      if (typeof payload.webhookHash === 'string' && payload.webhookHash.trim()) {
        saveRuntimeSecrets({ flutterwaveWebhookHash: payload.webhookHash.trim() });
      }
      if (wc) {
        await wc.updatePaymentGateway('rave', this.db.paymentGateways.flutterwave.enabled).catch(() => {});
      }
    } else if (gatewayId === 'bacs') {
      const curr = this.db.paymentGateways.bacs;
      this.db.paymentGateways.bacs = {
        ...curr,
        enabled: payload.enabled !== undefined ? Boolean(payload.enabled) : curr.enabled,
        bankName: typeof payload.bankName === 'string' ? payload.bankName.trim() : curr.bankName,
        accountName:
          typeof payload.accountName === 'string' ? payload.accountName.trim() : curr.accountName,
        accountNumber:
          typeof payload.accountNumber === 'string' ? payload.accountNumber.trim() : curr.accountNumber,
        instructions:
          typeof payload.instructions === 'string' ? payload.instructions.trim() : curr.instructions,
        paymentDeadlineHours:
          payload.paymentDeadlineHours !== undefined
            ? Math.max(1, Number(payload.paymentDeadlineHours))
            : curr.paymentDeadlineHours,
        requireProofUpload:
          payload.requireProofUpload !== undefined
            ? Boolean(payload.requireProofUpload)
            : curr.requireProofUpload,
      };
      if (wc) {
        await wc.updatePaymentGateway('bacs', this.db.paymentGateways.bacs.enabled).catch(() => {});
      }
    } else if (gatewayId === 'cod') {
      const curr = this.db.paymentGateways.cod;
      this.db.paymentGateways.cod = {
        ...curr,
        enabled: payload.enabled !== undefined ? Boolean(payload.enabled) : curr.enabled,
        minOrderAmount:
          payload.minOrderAmount !== undefined
            ? Math.max(0, Number(payload.minOrderAmount))
            : curr.minOrderAmount,
        maxOrderAmount:
          payload.maxOrderAmount !== undefined
            ? Math.max(0, Number(payload.maxOrderAmount))
            : curr.maxOrderAmount,
        additionalFee:
          payload.additionalFee !== undefined
            ? Math.max(0, Number(payload.additionalFee))
            : curr.additionalFee,
        supportedStates: Array.isArray(payload.supportedStates)
          ? (payload.supportedStates as string[])
          : curr.supportedStates,
        instructions:
          typeof payload.instructions === 'string' ? payload.instructions.trim() : curr.instructions,
      };
      if (wc) {
        await wc.updatePaymentGateway('cod', this.db.paymentGateways.cod.enabled).catch(() => {});
      }
    }

    this.recordAudit(
      actorEmail,
      'UPDATE_PAYMENT_GATEWAY',
      `gateway:${gatewayId}`,
      `Enabled=${this.db.paymentGateways[gatewayId].enabled}`
    );
    this.persist();
    return this.getAdminPaymentGateways();
  }

  // --- Shipping Zones ---
  getShippingZones(includeDisabled = false): ShippingZone[] {
    return includeDisabled
      ? this.db.shippingZones
      : this.db.shippingZones.filter((z) => z.enabled);
  }

  resolveShippingForState(state: string, subtotal: number, pickup = false): {
    zone: ShippingZone | null;
    shippingTotal: number;
  } {
    const ds = this.db.deliverySettings;
    const enabled = this.getShippingZones(false);
    const exact = enabled.find((z) => z.states.includes(state));
    const fallback = enabled.find((z) => z.states.includes('ALL'));
    const zone = exact || fallback || null;
    if (!zone) return { zone: null, shippingTotal: 0 };
    if (pickup && ds.pickupEnabled && zone.pickupAvailable) {
      return { zone, shippingTotal: 0 };
    }
    const freeThreshold =
      zone.freeShippingMinOrder && zone.freeShippingMinOrder > 0
        ? zone.freeShippingMinOrder
        : ds.freeDeliveryThreshold;
    if (freeThreshold && subtotal >= freeThreshold) {
      return { zone, shippingTotal: 0 };
    }
    return { zone, shippingTotal: zone.flatRate };
  }

  saveShippingZone(actorEmail: string, zone: ShippingZone): ShippingZone[] {
    const idx = this.db.shippingZones.findIndex((z) => z.id === zone.id);
    if (idx === -1) {
      this.db.shippingZones.push({
        ...zone,
        id: zone.id || `zone-${crypto.randomUUID().slice(0, 6)}`,
      });
    } else {
      this.db.shippingZones[idx] = zone;
    }
    this.recordAudit(actorEmail, 'SAVE_SHIPPING_ZONE', `zone:${zone.id}`, zone.name);
    this.persist();
    return this.db.shippingZones;
  }

  deleteShippingZone(actorEmail: string, id: string): ShippingZone[] {
    this.db.shippingZones = this.db.shippingZones.filter((z) => z.id !== id);
    this.recordAudit(actorEmail, 'DELETE_SHIPPING_ZONE', `zone:${id}`, 'Deleted shipping zone');
    this.persist();
    return this.db.shippingZones;
  }

  // --- Coupons ---
  getCoupons(): Coupon[] {
    return this.db.coupons;
  }

  validateCoupon(code: string, subtotal: number): { valid: boolean; discount: number; message: string; coupon?: Coupon } {
    const normalized = code.trim().toUpperCase();
    const coupon = this.db.coupons.find((c) => c.code.toUpperCase() === normalized && c.active);
    if (!coupon) {
      return { valid: false, discount: 0, message: 'Coupon code is invalid or inactive.' };
    }
    if (coupon.expiryDate && new Date(coupon.expiryDate).getTime() < Date.now()) {
      return { valid: false, discount: 0, message: 'This coupon has expired.' };
    }
    if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
      return { valid: false, discount: 0, message: 'This coupon has reached its usage limit.' };
    }
    if (subtotal < coupon.minSpend) {
      return {
        valid: false,
        discount: 0,
        message: `Minimum spend of ₦${coupon.minSpend.toLocaleString()} required for ${coupon.code}.`,
      };
    }
    if (coupon.maxSpend && subtotal > coupon.maxSpend) {
      return {
        valid: false,
        discount: 0,
        message: `Maximum spend for ${coupon.code} is ₦${coupon.maxSpend.toLocaleString()}.`,
      };
    }

    let discount = 0;
    if (coupon.type === 'percent') {
      discount = Math.round((subtotal * coupon.amount) / 100);
    } else {
      discount = Math.min(subtotal, Math.round(coupon.amount));
    }

    return {
      valid: true,
      discount,
      message: `${coupon.code} applied (-₦${discount.toLocaleString()})`,
      coupon,
    };
  }

  saveCoupon(actorEmail: string, coupon: Omit<Coupon, 'id' | 'usageCount'> & { id?: string }): Coupon[] {
    const code = coupon.code.trim().toUpperCase();
    if (coupon.id) {
      const idx = this.db.coupons.findIndex((c) => c.id === coupon.id);
      if (idx !== -1) {
        this.db.coupons[idx] = { ...this.db.coupons[idx], ...coupon, code };
      }
    } else {
      this.db.coupons.unshift({
        ...coupon,
        id: `coup-${crypto.randomUUID().slice(0, 6)}`,
        code,
        usageCount: 0,
      });
    }
    this.recordAudit(actorEmail, 'SAVE_COUPON', `coupon:${code}`, coupon.description);
    this.persist();
    return this.db.coupons;
  }

  deleteCoupon(actorEmail: string, id: string): Coupon[] {
    this.db.coupons = this.db.coupons.filter((c) => c.id !== id);
    this.recordAudit(actorEmail, 'DELETE_COUPON', `coupon:${id}`, 'Removed coupon');
    this.persist();
    return this.db.coupons;
  }

  // --- Authoritative Checkout & Order Creation ---
  async createAuthoritativeOrder(input: {
    customerUid?: string | null;
    billing: Order['billing'];
    deliveryInstructions?: string;
    items: { productId: string; variationId?: string; quantity: number }[];
    couponCode?: string | null;
    paymentMethod: PaymentMethodId;
    pickupAtHub?: boolean;
  }): Promise<Order> {
    if (!input.items || input.items.length === 0) {
      throw new Error('Your cart is empty.');
    }

    const catalog = await this.getProducts(true);
    const resolvedItems: OrderLineItem[] = [];
    let subtotal = 0;
    let allCodAllowed = true;

    for (const reqItem of input.items) {
      const qty = Math.max(1, Math.floor(Number(reqItem.quantity || 1)));
      const product = catalog.find((p) => p.id === reqItem.productId);
      if (!product || product.status !== 'publish') {
        throw new Error(`Product ${reqItem.productId} is no longer available.`);
      }
      if (!product.codAllowed) {
        allCodAllowed = false;
      }
      if (product.type === 'variable' && product.variations.length > 0 && !reqItem.variationId) {
        throw new Error(`Please select a size/option for ${product.name} before checkout.`);
      }

      let unitPrice =
        product.salePrice && product.salePrice < product.price ? product.salePrice : product.price;
      let sku = product.sku;
      let availableStock = product.stockQuantity;
      let attributes: Record<string, string> | undefined;

      if (reqItem.variationId && product.variations.length > 0) {
        const variation = product.variations.find((v) => v.id === reqItem.variationId);
        if (!variation) {
          throw new Error(`Selected variation for ${product.name} is unavailable.`);
        }
        unitPrice =
          variation.salePrice && variation.salePrice < variation.price
            ? variation.salePrice
            : variation.price;
        sku = variation.sku;
        availableStock = variation.stockQuantity;
        attributes = variation.attributes;
      }

      if (product.manageStock && availableStock < qty) {
        throw new Error(`Insufficient stock for ${product.name}. Only ${availableStock} left.`);
      }

      const lineTotal = unitPrice * qty;
      subtotal += lineTotal;
      resolvedItems.push({
        productId: product.id,
        variationId: reqItem.variationId,
        name: product.name,
        sku,
        image: product.images[0] || '',
        quantity: qty,
        unitPrice,
        total: lineTotal,
        attributes,
      });
    }

    const gateways = this.db.paymentGateways;
    if (!gateways[input.paymentMethod].enabled) {
      throw new Error(`Selected payment method (${input.paymentMethod}) is currently disabled.`);
    }

    let discountTotal = 0;
    let appliedCouponCode: string | null = null;
    if (input.couponCode) {
      const check = this.validateCoupon(input.couponCode, subtotal);
      if (!check.valid) {
        throw new Error(check.message);
      }
      discountTotal = check.discount;
      appliedCouponCode = check.coupon?.code || null;
      const cIdx = this.db.coupons.findIndex((c) => c.code === appliedCouponCode);
      if (cIdx !== -1) {
        this.db.coupons[cIdx].usageCount += 1;
      }
    }

    const { zone, shippingTotal } = this.resolveShippingForState(
      input.billing.state,
      Math.max(0, subtotal - discountTotal),
      Boolean(input.pickupAtHub)
    );

    let codFee = 0;
    if (input.paymentMethod === 'cod') {
      const cod = gateways.cod;
      if (!allCodAllowed) {
        throw new Error('One or more items in your cart are not eligible for Pay on Delivery.');
      }
      if (subtotal < cod.minOrderAmount) {
        throw new Error(`Pay on Delivery requires a minimum order of ₦${cod.minOrderAmount.toLocaleString()}.`);
      }
      if (cod.maxOrderAmount > 0 && subtotal > cod.maxOrderAmount) {
        throw new Error(
          `Pay on Delivery is capped at ₦${cod.maxOrderAmount.toLocaleString()}. Please use Paystack, Flutterwave, or Bank Transfer.`
        );
      }
      if (!cod.supportedStates.includes('ALL') && !cod.supportedStates.includes(input.billing.state)) {
        throw new Error(`Pay on Delivery is not available in ${input.billing.state}.`);
      }
      codFee = cod.additionalFee;
    }

    const total = Math.max(0, subtotal - discountTotal + shippingTotal + codFee);
    const now = new Date().toISOString();
    const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
    const orderNumber = `DM-${new Date().getFullYear().toString().slice(-2)}${rand}`;
    const paymentReference = `DM-PAY-${rand}-${Date.now().toString().slice(-6)}`;

    const initialStatus: OrderStatus =
      input.paymentMethod === 'bacs'
        ? 'on-hold'
        : input.paymentMethod === 'cod'
        ? 'processing'
        : 'pending';

    const order: Order = {
      id: `ord-${crypto.randomUUID().slice(0, 10)}`,
      orderNumber,
      customerUid: input.customerUid || null,
      customerEmail: input.billing.email.trim().toLowerCase(),
      billing: {
        ...input.billing,
        email: input.billing.email.trim().toLowerCase(),
        country: 'NG',
      },
      deliveryInstructions: input.deliveryInstructions?.trim() || '',
      items: resolvedItems,
      subtotal,
      discountTotal,
      couponCode: appliedCouponCode,
      shippingTotal,
      shippingZoneName:
        input.pickupAtHub && zone?.pickupAvailable
          ? `${zone.name} (Pickup)`
          : zone?.name || 'Standard Delivery',
      codFee,
      total,
      currency: 'NGN',
      paymentMethod: input.paymentMethod,
      paymentMethodTitle: gateways[input.paymentMethod].title,
      paymentStatus: input.paymentMethod === 'bacs' ? 'awaiting_verification' : 'unpaid',
      paymentReference,
      transferReceiptUrl: null,
      status: initialStatus,
      delivery: {
        status: 'pending_delivery',
        courier: '',
        trackingNumber: '',
        notes: '',
        updatedAt: now,
      },
      notes: [
        {
          id: `note-${crypto.randomUUID().slice(0, 6)}`,
          author: 'Diamond Market System',
          note: `Order created via ${gateways[input.paymentMethod].title}. Ref: ${paymentReference}`,
          isCustomerVisible: true,
          createdAt: now,
        },
      ],
      createdAt: now,
      updatedAt: now,
    };

    const delivery = this.buildDeliveryRecordFromOrder(order, Boolean(input.pickupAtHub));

    // Optional real operational round-robin rider assignment if enabled & active riders exist
    if (this.db.deliverySettings.autoAssignMode === 'round_robin') {
      const activeRiders = this.db.riders.filter((r) => r.status === 'active');
      if (activeRiders.length > 0) {
        const pickedRider = [...activeRiders].sort((a, b) => {
          const aCount = this.db.deliveries.filter(
            (d) =>
              d.riderId === a.id &&
              ['rider_assigned', 'picked_up', 'out_for_delivery', 'arrived_at_destination'].includes(d.status)
          ).length;
          const bCount = this.db.deliveries.filter(
            (d) =>
              d.riderId === b.id &&
              ['rider_assigned', 'picked_up', 'out_for_delivery', 'arrived_at_destination'].includes(d.status)
          ).length;
          return aCount - bCount;
        })[0];

        if (pickedRider) {
          delivery.riderId = pickedRider.id;
          delivery.riderCode = pickedRider.riderCode;
          delivery.riderName = pickedRider.fullName;
          delivery.riderPhone = pickedRider.phone;
          delivery.riderWhatsapp = pickedRider.whatsapp;
          delivery.riderVehicle = `${pickedRider.vehicleType}${
            pickedRider.vehicleRegistration ? ` (${pickedRider.vehicleRegistration})` : ''
          }`;
          delivery.status = 'rider_assigned';
          delivery.assignedAt = now;
          delivery.history.unshift({
            id: `dh-${crypto.randomUUID().slice(0, 6)}`,
            fromStatus: 'pending_delivery',
            toStatus: 'rider_assigned',
            timestamp: now,
            actorType: 'system',
            actorId: 'round_robin',
            actorName: 'Diamond Market Dispatch',
            note: `Auto-assigned to rider ${pickedRider.fullName} (${pickedRider.riderCode}).`,
          });
        }
      }
    }

    this.syncDeliverySummaryOntoOrder(order, delivery);

    for (const item of resolvedItems) {
      const pIdx = this.db.products.findIndex((p) => p.id === item.productId);
      if (pIdx !== -1 && this.db.products[pIdx].manageStock) {
        this.db.products[pIdx].stockQuantity = Math.max(
          0,
          this.db.products[pIdx].stockQuantity - item.quantity
        );
        this.db.products[pIdx].inStock = this.db.products[pIdx].stockQuantity > 0;
        if (item.variationId) {
          const vIdx = this.db.products[pIdx].variations.findIndex((v) => v.id === item.variationId);
          if (vIdx !== -1) {
            this.db.products[pIdx].variations[vIdx].stockQuantity = Math.max(
              0,
              this.db.products[pIdx].variations[vIdx].stockQuantity - item.quantity
            );
            this.db.products[pIdx].variations[vIdx].inStock =
              this.db.products[pIdx].variations[vIdx].stockQuantity > 0;
          }
        }
        this.checkStockNotification(this.db.products[pIdx]);
      }
    }

    const wc = this.getWooClient();
    if (wc) {
      try {
        const synced = await wc.createOrder(order);
        order.wooOrderId = synced.wooOrderId;
        order.orderNumber = synced.orderNumber;
        delivery.orderNumber = synced.orderNumber;
      } catch (err) {
        console.error('WooCommerce order sync failed:', err);
        throw new Error('Failed to create order in WooCommerce. Please verify store API connection.');
      }
    }

    this.upsertCustomerFromOrder(order);

    if (input.paymentMethod === 'bacs') {
      this.pushNotification({
        type: 'bank_transfer_pending',
        title: `Bank Transfer Pending: ${order.orderNumber}`,
        message: `${order.billing.firstName} ${order.billing.lastName} placed an order for ₦${order.total.toLocaleString()} via Bank Transfer.`,
        orderId: order.id,
      });
    } else if (input.paymentMethod === 'cod') {
      this.pushNotification({
        type: 'cod_order',
        title: `Pay on Delivery Order: ${order.orderNumber}`,
        message: `New COD order (₦${order.total.toLocaleString()}) to ${order.billing.city}, ${order.billing.state}.`,
        orderId: order.id,
      });
    } else {
      this.pushNotification({
        type: 'new_order',
        title: `New Checkout Initiated: ${order.orderNumber}`,
        message: `Awaiting ${order.paymentMethodTitle} verification for ₦${order.total.toLocaleString()}.`,
        orderId: order.id,
      });
    }

    this.db.orders.unshift(order);
    this.db.deliveries.unshift(delivery);
    this.persist();

    // Non-blocking customer confirmation email
    await this.triggerOrderEmail({
      eventKey: 'order_placed',
      order,
      delivery,
      dedupeKey: `order_placed:${order.id}`,
    }).catch(() => {});

    if (delivery.riderId) {
      const otpPlain = this.issueOtpForDeliveryInternal(delivery);
      await this.triggerOrderEmail({
        eventKey: 'rider_assigned',
        order,
        delivery,
        otpCode: otpPlain || undefined,
        dedupeKey: `rider_assigned:${delivery.id}:${delivery.riderId}`,
      }).catch(() => {});
    }

    return order;
  }

  private upsertCustomerFromOrder(order: Order): void {
    const email = order.customerEmail;
    const idx = this.db.customers.findIndex((c) => c.email === email);
    if (idx === -1) {
      this.db.customers.unshift({
        id: `cust-${crypto.randomUUID().slice(0, 8)}`,
        uid: order.customerUid || null,
        email,
        firstName: order.billing.firstName,
        lastName: order.billing.lastName,
        phone: order.billing.phone,
        city: order.billing.city,
        state: order.billing.state,
        ordersCount: 1,
        totalSpent: order.paymentStatus === 'paid' ? order.total : 0,
        createdAt: order.createdAt,
        lastOrderAt: order.createdAt,
      });
      this.pushNotification({
        type: 'new_customer',
        title: 'New Customer Registered via Checkout',
        message: `${order.billing.firstName} ${order.billing.lastName} (${email})`,
      });
    } else {
      this.db.customers[idx].ordersCount += 1;
      this.db.customers[idx].lastOrderAt = order.createdAt;
      if (order.customerUid && !this.db.customers[idx].uid) {
        this.db.customers[idx].uid = order.customerUid;
      }
    }
  }

  async syncAuthenticatedCustomer(user: {
    uid: string;
    email: string;
    displayName: string;
    phone?: string;
  }): Promise<{ wooCustomerId?: number }> {
    const email = user.email.trim().toLowerCase();
    const parts = user.displayName.trim().split(/\s+/);
    const idx = this.db.customers.findIndex((c) => c.email === email || c.uid === user.uid);
    let wooCustomerId: number | undefined;

    const wc = this.getWooClient();
    if (wc) {
      try {
        const res = await wc.syncFirebaseCustomer(user);
        wooCustomerId = res.wooCustomerId;
      } catch (err) {
        console.error('WP Customer sync error:', err);
      }
    }

    if (idx === -1) {
      this.db.customers.unshift({
        id: `cust-${crypto.randomUUID().slice(0, 8)}`,
        uid: user.uid,
        wooCustomerId,
        email,
        firstName: parts[0] || 'Customer',
        lastName: parts.slice(1).join(' ') || '',
        phone: user.phone || '',
        ordersCount: 0,
        totalSpent: 0,
        createdAt: new Date().toISOString(),
        lastOrderAt: null,
      });
      this.persist();
    } else {
      this.db.customers[idx].uid = user.uid;
      if (wooCustomerId) this.db.customers[idx].wooCustomerId = wooCustomerId;
      if (user.phone) this.db.customers[idx].phone = user.phone;
      this.persist();
    }

    return { wooCustomerId };
  }

  // --- Orders ---
  async getAllOrders(): Promise<Order[]> {
    const wc = this.getWooClient();
    if (wc) {
      try {
        return await wc.getOrders();
      } catch (err) {
        console.error('WooCommerce getOrders fallback:', err);
      }
    }
    return this.db.orders;
  }

  getOrderByIdOrRef(idOrRef: string): Order | null {
    return (
      this.db.orders.find(
        (o) =>
          o.id === idOrRef ||
          o.orderNumber.toLowerCase() === idOrRef.toLowerCase() ||
          o.paymentReference === idOrRef
      ) || null
    );
  }

  getOrdersForCustomer(uid: string, email: string): Order[] {
    const normalizedEmail = email.trim().toLowerCase();
    return this.db.orders.filter(
      (o) => (o.customerUid && o.customerUid === uid) || o.customerEmail === normalizedEmail
    );
  }

  async markOrderPaymentResult(
    orderIdOrRef: string,
    result: {
      paid: boolean;
      failed?: boolean;
      transactionId?: string;
      verifiedAmountNgn?: number;
      note: string;
      actorEmail?: string;
    }
  ): Promise<Order> {
    const idx = this.db.orders.findIndex(
      (o) => o.id === orderIdOrRef || o.paymentReference === orderIdOrRef || o.orderNumber === orderIdOrRef
    );
    if (idx === -1) throw new Error('Order not found');
    const order = this.db.orders[idx];

    if (order.paymentStatus === 'paid' && result.paid) {
      return order;
    }

    if (result.paid && result.verifiedAmountNgn !== undefined && result.verifiedAmountNgn < order.total) {
      throw new Error(
        `Payment amount mismatch: expected ₦${order.total}, verified ₦${result.verifiedAmountNgn}.`
      );
    }

    const now = new Date().toISOString();
    if (result.paid) {
      order.paymentStatus = 'paid';
      order.status = order.status === 'pending' || order.status === 'on-hold' ? 'processing' : order.status;
      order.gatewayTransactionId = result.transactionId || order.gatewayTransactionId;

      for (const item of order.items) {
        const pIdx = this.db.products.findIndex((p) => p.id === item.productId);
        if (pIdx !== -1) {
          this.db.products[pIdx].salesCount += item.quantity;
        }
      }
      const cIdx = this.db.customers.findIndex((c) => c.email === order.customerEmail);
      if (cIdx !== -1) {
        this.db.customers[cIdx].totalSpent += order.total;
      }

      this.pushNotification({
        type: 'payment_received',
        title: `Payment Confirmed: ${order.orderNumber}`,
        message: `₦${order.total.toLocaleString()} confirmed via ${order.paymentMethodTitle}.`,
        orderId: order.id,
      });
    } else if (result.failed) {
      order.paymentStatus = 'failed';
      order.status = 'failed';
      this.pushNotification({
        type: 'payment_failed',
        title: `Payment Failed: ${order.orderNumber}`,
        message: result.note,
        orderId: order.id,
      });
    }

    order.notes.unshift({
      id: `note-${crypto.randomUUID().slice(0, 6)}`,
      author: result.actorEmail || 'Payment Gateway',
      note: result.note,
      isCustomerVisible: true,
      createdAt: now,
    });
    order.updatedAt = now;

    const wc = this.getWooClient();
    if (wc && order.wooOrderId) {
      await wc.updateOrderStatus(order.wooOrderId, order.status, order.paymentStatus === 'paid').catch(() => {});
    }

    const delivery = this.db.deliveries.find((d) => d.orderId === order.id);
    if (result.paid && delivery) {
      delivery.codAmountToCollect = 0;
      if (delivery.status === 'pending_delivery') {
        delivery.status = 'preparing_order';
        delivery.updatedAt = now;
        delivery.history.unshift({
          id: `dh-${crypto.randomUUID().slice(0, 6)}`,
          fromStatus: 'pending_delivery',
          toStatus: 'preparing_order',
          timestamp: now,
          actorType: 'system',
          actorId: result.actorEmail || 'payment_gateway',
          actorName: result.actorEmail || 'Payment Gateway',
          note: 'Payment confirmed; delivery moved to Preparing Order.',
        });
        this.syncDeliverySummaryOntoOrder(order, delivery);
      }
    }

    if (result.actorEmail) {
      this.recordAudit(result.actorEmail, 'CONFIRM_ORDER_PAYMENT', `order:${order.orderNumber}`, result.note);
    }
    this.persist();

    if (result.paid) {
      await this.triggerOrderEmail({
        eventKey: 'payment_verified',
        order,
        delivery,
        dedupeKey: `payment_verified:${order.id}`,
      }).catch(() => {});
    }

    return order;
  }

  attachTransferReceipt(orderId: string, receiptUrl: string, transferNote?: string): Order {
    const idx = this.db.orders.findIndex((o) => o.id === orderId);
    if (idx === -1) throw new Error('Order not found');
    const order = this.db.orders[idx];
    const now = new Date().toISOString();
    order.transferReceiptUrl = receiptUrl;
    if (transferNote) order.transferNote = transferNote;
    order.paymentStatus = 'awaiting_verification';
    order.notes.unshift({
      id: `note-${crypto.randomUUID().slice(0, 6)}`,
      author: 'Customer',
      note: `Bank transfer proof uploaded.${transferNote ? ` Note: ${transferNote}` : ''}`,
      isCustomerVisible: true,
      createdAt: now,
    });
    order.updatedAt = now;

    this.pushNotification({
      type: 'bank_transfer_pending',
      title: `Transfer Proof Uploaded: ${order.orderNumber}`,
      message: `Customer uploaded payment receipt for ₦${order.total.toLocaleString()}. Verify in Orders.`,
      orderId: order.id,
    });
    this.persist();
    return order;
  }

  async adminUpdateOrder(
    actorEmail: string,
    orderId: string,
    patch: {
      status?: OrderStatus;
      delivery?: Partial<Order['delivery']>;
      note?: string;
      isCustomerVisible?: boolean;
    }
  ): Promise<Order> {
    const idx = this.db.orders.findIndex((o) => o.id === orderId);
    if (idx === -1) throw new Error('Order not found');
    const order = this.db.orders[idx];
    const now = new Date().toISOString();
    const delivery = this.db.deliveries.find((d) => d.orderId === order.id);

    const prevStatus = order.status;
    if (patch.status && patch.status !== prevStatus) {
      if (
        (patch.status === 'cancelled' || patch.status === 'refunded') &&
        prevStatus !== 'cancelled' &&
        prevStatus !== 'refunded'
      ) {
        for (const item of order.items) {
          const pIdx = this.db.products.findIndex((p) => p.id === item.productId);
          if (pIdx !== -1 && this.db.products[pIdx].manageStock) {
            this.db.products[pIdx].stockQuantity += item.quantity;
            this.db.products[pIdx].inStock = this.db.products[pIdx].stockQuantity > 0;
          }
        }
      }
      if (patch.status === 'refunded') {
        order.paymentStatus = 'refunded';
      }
      if (patch.status === 'cancelled' && delivery && delivery.status !== 'cancelled') {
        const oldDelStatus = delivery.status;
        delivery.status = 'cancelled';
        delivery.updatedAt = now;
        delivery.history.unshift({
          id: `dh-${crypto.randomUUID().slice(0, 6)}`,
          fromStatus: oldDelStatus,
          toStatus: 'cancelled',
          timestamp: now,
          actorType: 'admin',
          actorId: actorEmail,
          actorName: actorEmail,
          note: 'Delivery cancelled alongside order status update.',
        });
      }
      order.status = patch.status;
      order.notes.unshift({
        id: `note-${crypto.randomUUID().slice(0, 6)}`,
        author: actorEmail,
        note: `Order status changed from ${prevStatus} to ${patch.status}.`,
        isCustomerVisible: true,
        createdAt: now,
      });
    }

    if (patch.delivery) {
      const normalizedDelStatus = patch.delivery.status
        ? normalizeDeliveryStatus(patch.delivery.status)
        : order.delivery.status;
      if (delivery) {
        const prevDelStatus = delivery.status;
        if (patch.delivery.courier !== undefined) delivery.courier = sanitizeText(patch.delivery.courier, 120);
        if (patch.delivery.trackingNumber !== undefined)
          delivery.trackingNumber = sanitizeText(patch.delivery.trackingNumber, 120);
        if (patch.delivery.estimatedDeliveryDate !== undefined)
          delivery.estimatedDeliveryDate = sanitizeText(patch.delivery.estimatedDeliveryDate, 60);
        delivery.status = normalizedDelStatus;
        delivery.updatedAt = now;
        if (normalizedDelStatus !== prevDelStatus) {
          delivery.history.unshift({
            id: `dh-${crypto.randomUUID().slice(0, 6)}`,
            fromStatus: prevDelStatus,
            toStatus: normalizedDelStatus,
            timestamp: now,
            actorType: 'admin',
            actorId: actorEmail,
            actorName: actorEmail,
            note: sanitizeText(patch.delivery.notes || patch.note || `Updated to ${DELIVERY_STATUS_LABELS[normalizedDelStatus]}`, 240),
          });
        }
        this.syncDeliverySummaryOntoOrder(order, delivery);
      } else {
        order.delivery = {
          ...order.delivery,
          ...patch.delivery,
          status: normalizedDelStatus,
          updatedAt: now,
        };
      }
    } else if (delivery) {
      this.syncDeliverySummaryOntoOrder(order, delivery);
    }

    if (patch.note?.trim()) {
      order.notes.unshift({
        id: `note-${crypto.randomUUID().slice(0, 6)}`,
        author: actorEmail,
        note: patch.note.trim(),
        isCustomerVisible: patch.isCustomerVisible ?? true,
        createdAt: now,
      });
    }

    order.updatedAt = now;

    const wc = this.getWooClient();
    if (wc && order.wooOrderId) {
      if (patch.status) {
        await wc.updateOrderStatus(order.wooOrderId, order.status).catch(() => {});
      }
      if (patch.delivery) {
        await wc
          .updateOrderDelivery(order.wooOrderId, {
            courier: order.delivery.courier,
            trackingNumber: order.delivery.trackingNumber,
            status: order.delivery.status,
            notes: order.delivery.notes,
            riderName: order.delivery.riderName,
            riderCode: order.delivery.riderCode,
            estimatedDeliveryDate: order.delivery.estimatedDeliveryDate,
            customerConfirmed: order.delivery.customerConfirmed,
          })
          .catch(() => {});
      }
    }

    this.recordAudit(actorEmail, 'UPDATE_ORDER', `order:${order.orderNumber}`, `Status=${order.status}`);
    this.persist();

    if (patch.status === 'cancelled') {
      await this.triggerOrderEmail({
        eventKey: 'order_cancelled',
        order,
        delivery,
        extraNote: patch.note,
        dedupeKey: `order_cancelled:${order.id}`,
      }).catch(() => {});
    } else if (patch.status === 'refunded') {
      await this.triggerOrderEmail({
        eventKey: 'refund_status',
        order,
        delivery,
        extraNote: patch.note,
        dedupeKey: `refund_status:${order.id}`,
      }).catch(() => {});
    } else if (patch.status === 'processing' && prevStatus !== 'processing') {
      await this.triggerOrderEmail({
        eventKey: 'order_processing',
        order,
        delivery,
        extraNote: patch.note,
        dedupeKey: `order_processing:${order.id}`,
      }).catch(() => {});
    }

    return order;
  }

  // --- Reviews & Verified Testimonials ---
  getReviews(productId?: string, includeUnapproved = false): ProductReview[] {
    return this.db.reviews.filter((r) => {
      if (productId && r.productId !== productId) return false;
      if (!includeUnapproved && r.status !== 'approved') return false;
      return true;
    });
  }

  submitReview(input: {
    productId: string;
    reviewerName: string;
    reviewerEmail: string;
    userId?: string;
    orderId?: string;
    rating: number;
    title?: string;
    qualityRating?: number;
    accuracyRating?: number;
    sizeFitFeedback?: ProductReview['sizeFitFeedback'];
    comment: string;
    photos?: string[];
  }): ProductReview {
    const product = this.db.products.find((p) => p.id === input.productId);
    if (!product) throw new Error('Product not found');

    const cleanEmail = input.reviewerEmail.trim().toLowerCase();
    const matchingOrder = this.db.orders.find((o) => {
      if (input.orderId && o.id !== input.orderId) return false;
      const belongs = (input.userId && o.customerUid === input.userId) || o.customerEmail === cleanEmail;
      if (!belongs) return false;
      const containsItem = o.items.some((i) => i.productId === input.productId);
      if (!containsItem) return false;
      return (
        o.paymentStatus === 'paid' ||
        o.delivery?.customerConfirmed === true ||
        o.delivery?.status === 'delivered_customer_confirmed'
      );
    });

    const clampScore = (val: unknown, fallback: number) => {
      const n = Number(val);
      return Number.isFinite(n) && n >= 1 && n <= 5 ? Math.round(n) : fallback;
    };
    const rating = clampScore(input.rating, 5);

    const review: ProductReview = {
      id: `rev-${crypto.randomUUID().slice(0, 8)}`,
      productId: product.id,
      productName: product.name,
      orderId: matchingOrder?.id || input.orderId,
      orderNumber: matchingOrder?.orderNumber,
      reviewerName: sanitizeText(input.reviewerName, 100),
      reviewerEmail: cleanEmail,
      userId: input.userId,
      rating,
      title: sanitizeText(input.title, 120),
      qualityRating: clampScore(input.qualityRating, rating),
      accuracyRating: clampScore(input.accuracyRating, rating),
      sizeFitFeedback: input.sizeFitFeedback || '',
      comment: sanitizeText(input.comment, 1200),
      photos: Array.isArray(input.photos) ? input.photos.filter((u) => typeof u === 'string').slice(0, 4) : [],
      verifiedPurchase: Boolean(matchingOrder),
      featuredTestimonial: false,
      reported: false,
      status: matchingOrder?.delivery?.customerConfirmed ? 'approved' : 'hold',
      createdAt: new Date().toISOString(),
    };

    this.db.reviews.unshift(review);
    if (review.status === 'approved') {
      this.recomputeProductRating(product.id);
    }
    this.persist();
    return review;
  }

  moderateReview(actorEmail: string, reviewId: string, status: ProductReview['status']): ProductReview[] {
    const idx = this.db.reviews.findIndex((r) => r.id === reviewId);
    if (idx === -1) throw new Error('Review not found');
    this.db.reviews[idx].status = status;
    this.recomputeProductRating(this.db.reviews[idx].productId);
    this.recordAudit(actorEmail, 'MODERATE_REVIEW', `review:${reviewId}`, `Status=${status}`);
    this.persist();
    return this.db.reviews;
  }

  featureProductReview(actorEmail: string, reviewId: string, featured: boolean): ProductReview[] {
    const idx = this.db.reviews.findIndex((r) => r.id === reviewId);
    if (idx === -1) throw new Error('Review not found');
    this.db.reviews[idx].featuredTestimonial = featured;
    if (featured && this.db.reviews[idx].status !== 'approved') {
      this.db.reviews[idx].status = 'approved';
      this.recomputeProductRating(this.db.reviews[idx].productId);
    }
    this.recordAudit(actorEmail, 'FEATURE_TESTIMONIAL', `review:${reviewId}`, `Featured=${featured}`);
    this.persist();
    return this.db.reviews;
  }

  reportReview(reviewId: string, reason: string, actorEmail?: string): ProductReview {
    const idx = this.db.reviews.findIndex((r) => r.id === reviewId);
    if (idx === -1) throw new Error('Review not found');
    this.db.reviews[idx].reported = true;
    this.db.reviews[idx].reportReason = sanitizeText(reason || 'Flagged for administrator review', 240);
    if (actorEmail) {
      this.recordAudit(actorEmail, 'REPORT_REVIEW', `review:${reviewId}`, this.db.reviews[idx].reportReason || '');
    }
    this.persist();
    return this.db.reviews[idx];
  }

  deleteReview(actorEmail: string, reviewId: string): ProductReview[] {
    const rev = this.db.reviews.find((r) => r.id === reviewId);
    this.db.reviews = this.db.reviews.filter((r) => r.id !== reviewId);
    if (rev) this.recomputeProductRating(rev.productId);
    this.recordAudit(actorEmail, 'DELETE_REVIEW', `review:${reviewId}`, 'Deleted review');
    this.persist();
    return this.db.reviews;
  }

  private recomputeProductRating(productId: string): void {
    const approved = this.db.reviews.filter((r) => r.productId === productId && r.status === 'approved');
    const pIdx = this.db.products.findIndex((p) => p.id === productId);
    if (pIdx === -1) return;
    this.db.products[pIdx].reviewCount = approved.length;
    this.db.products[pIdx].averageRating =
      approved.length > 0
        ? Number((approved.reduce((acc, r) => acc + r.rating, 0) / approved.length).toFixed(1))
        : 0;
  }

  // --- Rider Management & Authentication ---
  listRiders(): Rider[] {
    return this.db.riders.map((r) => this.toPublicRider(r));
  }

  getRiderById(riderId: string): Rider | null {
    const r = this.db.riders.find((item) => item.id === riderId);
    return r ? this.toPublicRider(r) : null;
  }

  authenticateRider(identifier: string, passcode: string): Rider {
    const cleanId = identifier.trim().toLowerCase();
    const rider = this.db.riders.find(
      (r) =>
        r.riderCode.toLowerCase() === cleanId ||
        r.email.toLowerCase() === cleanId ||
        r.phone.toLowerCase() === cleanId
    );
    if (!rider || !verifyPassword(passcode, rider.passwordSalt, rider.passwordHash)) {
      throw new Error('Invalid Rider ID/Email or passcode.');
    }
    if (rider.status !== 'active') {
      throw new Error(`Rider account is currently ${rider.status}. Contact Diamond Market Administration.`);
    }
    return this.toPublicRider(rider);
  }

  registerRider(
    actorEmail: string,
    input: {
      fullName: string;
      email: string;
      phone: string;
      whatsapp?: string;
      photoUrl?: string;
      vehicleType: VehicleType;
      vehicleRegistration?: string;
      emergencyContactName?: string;
      emergencyContactPhone?: string;
      zoneCoverage?: string[];
      passcode: string;
    }
  ): Rider {
    if (!input.fullName?.trim() || !input.phone?.trim() || !input.passcode || input.passcode.trim().length < 6) {
      throw new Error('Full name, phone number, and a rider passcode (minimum 6 characters) are required.');
    }
    const cleanEmail = (input.email || '').trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      throw new Error('A valid rider email address is required.');
    }
    if (this.db.riders.some((r) => r.email.toLowerCase() === cleanEmail)) {
      throw new Error('A rider with that email address already exists.');
    }

    const now = new Date().toISOString();
    const num = String(this.db.riders.length + 101).padStart(3, '0');
    const riderCode = `DMR-${num}`;
    const { salt, hash } = hashPassword(input.passcode.trim());

    const stored: StoredRider = {
      id: `rid-${crypto.randomUUID().slice(0, 8)}`,
      riderCode,
      fullName: sanitizeText(input.fullName, 120),
      email: cleanEmail,
      phone: sanitizeText(input.phone, 40),
      whatsapp: sanitizeText(input.whatsapp || input.phone, 40),
      photoUrl: sanitizeText(input.photoUrl || '', 300),
      vehicleType: input.vehicleType || 'motorcycle',
      vehicleRegistration: sanitizeText(input.vehicleRegistration || '', 60),
      emergencyContactName: sanitizeText(input.emergencyContactName || '', 120),
      emergencyContactPhone: sanitizeText(input.emergencyContactPhone || '', 40),
      zoneCoverage: Array.isArray(input.zoneCoverage)
        ? input.zoneCoverage.map((z) => sanitizeText(z, 60)).filter(Boolean)
        : ['Ogbomoso'],
      status: 'active',
      registeredAt: now,
      updatedAt: now,
      passwordHash: hash,
      passwordSalt: salt,
    };

    this.db.riders.unshift(stored);
    this.recordAudit(actorEmail, 'REGISTER_RIDER', `rider:${riderCode}`, stored.fullName);
    this.persist();
    return this.toPublicRider(stored);
  }

  updateRider(
    actorEmail: string,
    riderId: string,
    patch: {
      fullName?: string;
      email?: string;
      phone?: string;
      whatsapp?: string;
      photoUrl?: string;
      vehicleType?: VehicleType;
      vehicleRegistration?: string;
      emergencyContactName?: string;
      emergencyContactPhone?: string;
      zoneCoverage?: string[];
      status?: RiderStatus;
      passcode?: string;
    }
  ): Rider {
    const idx = this.db.riders.findIndex((r) => r.id === riderId);
    if (idx === -1) throw new Error('Rider not found');
    const current = this.db.riders[idx];
    const now = new Date().toISOString();

    if (patch.email && patch.email.trim().toLowerCase() !== current.email) {
      const candidate = patch.email.trim().toLowerCase();
      if (this.db.riders.some((r) => r.id !== riderId && r.email === candidate)) {
        throw new Error('Another rider is already using this email.');
      }
      current.email = candidate;
    }
    if (patch.fullName !== undefined) current.fullName = sanitizeText(patch.fullName, 120);
    if (patch.phone !== undefined) current.phone = sanitizeText(patch.phone, 40);
    if (patch.whatsapp !== undefined) current.whatsapp = sanitizeText(patch.whatsapp, 40);
    if (patch.photoUrl !== undefined) current.photoUrl = sanitizeText(patch.photoUrl, 300);
    if (patch.vehicleType !== undefined) current.vehicleType = patch.vehicleType;
    if (patch.vehicleRegistration !== undefined)
      current.vehicleRegistration = sanitizeText(patch.vehicleRegistration, 60);
    if (patch.emergencyContactName !== undefined)
      current.emergencyContactName = sanitizeText(patch.emergencyContactName, 120);
    if (patch.emergencyContactPhone !== undefined)
      current.emergencyContactPhone = sanitizeText(patch.emergencyContactPhone, 40);
    if (Array.isArray(patch.zoneCoverage)) {
      current.zoneCoverage = patch.zoneCoverage.map((z) => sanitizeText(z, 60)).filter(Boolean);
    }
    if (patch.status !== undefined) current.status = patch.status;
    if (patch.passcode && patch.passcode.trim().length >= 6) {
      const { salt, hash } = hashPassword(patch.passcode.trim());
      current.passwordHash = hash;
      current.passwordSalt = salt;
    }
    current.updatedAt = now;

    // Keep rider display info synchronized on active/uncompleted deliveries
    for (const del of this.db.deliveries) {
      if (del.riderId === riderId && !del.confirmation.confirmed) {
        del.riderName = current.fullName;
        del.riderPhone = current.phone;
        del.riderWhatsapp = current.whatsapp;
        del.riderVehicle = `${current.vehicleType}${
          current.vehicleRegistration ? ` (${current.vehicleRegistration})` : ''
        }`;
        const linkedOrder = this.db.orders.find((o) => o.id === del.orderId);
        if (linkedOrder) this.syncDeliverySummaryOntoOrder(linkedOrder, del);
      }
    }

    this.recordAudit(actorEmail, 'UPDATE_RIDER', `rider:${current.riderCode}`, `Status=${current.status}`);
    this.persist();
    return this.toPublicRider(current);
  }

  // --- Delivery Management, OTP & Customer Confirmation ---
  private issueOtpForDeliveryInternal(delivery: StoredDeliveryRecord): string | null {
    if (!delivery.otpRequired || delivery.otpVerified) return null;
    const code = generateOtpCode();
    const { salt, hash } = hashOtpOrToken(code);
    const ds = this.db.deliverySettings;
    delivery.otpSalt = salt;
    delivery.otpHash = hash;
    delivery.otpExpiresAt = new Date(Date.now() + ds.otpExpiryMinutes * 60 * 1000).toISOString();
    delivery.otpAttemptsRemaining = ds.otpMaxAttempts;
    delivery.otpLastSentAt = new Date().toISOString();
    return code;
  }

  listDeliveries(): DeliveryRecord[] {
    return this.db.deliveries.map((d) => this.toPublicDelivery(d));
  }

  getDeliveriesForRider(riderId: string): { delivery: DeliveryRecord; items: OrderLineItem[]; paymentMethod: PaymentMethodId; paymentStatus: Order['paymentStatus']; orderTotal: number }[] {
    return this.db.deliveries
      .filter((d) => d.riderId === riderId)
      .map((d) => {
        const order = this.db.orders.find((o) => o.id === d.orderId);
        return {
          delivery: this.toPublicDelivery(d),
          items: order?.items || [],
          paymentMethod: order?.paymentMethod || 'paystack',
          paymentStatus: order?.paymentStatus || 'unpaid',
          orderTotal: order?.total || 0,
        };
      });
  }

  getDeliveryByOrderId(orderId: string): DeliveryRecord | null {
    const d = this.db.deliveries.find((item) => item.orderId === orderId || item.id === orderId);
    return d ? this.toPublicDelivery(d) : null;
  }

  async assignRiderToDelivery(
    actorEmail: string,
    deliveryOrOrderId: string,
    riderId: string,
    note?: string
  ): Promise<DeliveryRecord> {
    const delivery = this.db.deliveries.find(
      (d) => d.id === deliveryOrOrderId || d.orderId === deliveryOrOrderId
    );
    if (!delivery) throw new Error('Delivery record not found.');
    const order = this.db.orders.find((o) => o.id === delivery.orderId);
    if (!order) throw new Error('Linked order not found.');

    const rider = this.db.riders.find((r) => r.id === riderId);
    if (!rider) throw new Error('Selected rider not found.');
    if (rider.status !== 'active') throw new Error('Cannot assign an inactive or suspended rider.');

    const now = new Date().toISOString();
    const prevStatus = delivery.status;
    const isReassign = Boolean(delivery.riderId && delivery.riderId !== riderId);

    delivery.riderId = rider.id;
    delivery.riderCode = rider.riderCode;
    delivery.riderName = rider.fullName;
    delivery.riderPhone = rider.phone;
    delivery.riderWhatsapp = rider.whatsapp;
    delivery.riderVehicle = `${rider.vehicleType}${
      rider.vehicleRegistration ? ` (${rider.vehicleRegistration})` : ''
    }`;
    delivery.assignedAt = now;
    delivery.updatedAt = now;

    if (['pending_delivery', 'preparing_order', 'ready_for_pickup', 'delivery_failed'].includes(delivery.status)) {
      delivery.status = 'rider_assigned';
    }

    delivery.history.unshift({
      id: `dh-${crypto.randomUUID().slice(0, 6)}`,
      fromStatus: prevStatus,
      toStatus: delivery.status,
      timestamp: now,
      actorType: 'admin',
      actorId: actorEmail,
      actorName: actorEmail,
      note: sanitizeText(
        note ||
          (isReassign
            ? `Delivery reassigned to ${rider.fullName} (${rider.riderCode}).`
            : `Assigned to rider ${rider.fullName} (${rider.riderCode}).`),
        240
      ),
    });

    const otpPlain = delivery.otpRequired && !delivery.otpVerified ? this.issueOtpForDeliveryInternal(delivery) : null;
    this.syncDeliverySummaryOntoOrder(order, delivery);

    const wc = this.getWooClient();
    if (wc && order.wooOrderId) {
      await wc
        .updateOrderDelivery(order.wooOrderId, {
          courier: delivery.courier,
          trackingNumber: delivery.trackingNumber,
          status: delivery.status,
          riderName: delivery.riderName,
          riderCode: delivery.riderCode,
          estimatedDeliveryDate: delivery.estimatedDeliveryDate,
          customerConfirmed: delivery.confirmation.confirmed,
        })
        .catch(() => {});
    }

    this.pushNotification({
      type: 'delivery_update',
      title: `Rider Assigned: ${order.orderNumber}`,
      message: `${rider.fullName} (${rider.riderCode}) assigned to deliver to ${delivery.addressCity}, ${delivery.addressState}.`,
      orderId: order.id,
    });
    this.recordAudit(actorEmail, 'ASSIGN_RIDER', `delivery:${delivery.orderNumber}`, `${rider.fullName} (${rider.riderCode})`);
    this.persist();

    await this.triggerOrderEmail({
      eventKey: 'rider_assigned',
      order,
      delivery,
      otpCode: otpPlain || undefined,
      dedupeKey: `rider_assigned:${delivery.id}:${rider.id}`,
    }).catch(() => {});

    return this.toPublicDelivery(delivery);
  }

  async adminUpdateDelivery(
    actorEmail: string,
    deliveryOrOrderId: string,
    patch: {
      status?: DeliveryStatus;
      deliveryFee?: number;
      estimatedDeliveryDate?: string;
      courier?: string;
      trackingNumber?: string;
      deliveryType?: DeliveryType;
      zoneName?: string;
      otpRequired?: boolean;
      note?: string;
    }
  ): Promise<DeliveryRecord> {
    const delivery = this.db.deliveries.find(
      (d) => d.id === deliveryOrOrderId || d.orderId === deliveryOrOrderId
    );
    if (!delivery) throw new Error('Delivery record not found.');
    const order = this.db.orders.find((o) => o.id === delivery.orderId);
    if (!order) throw new Error('Linked order not found.');

    const now = new Date().toISOString();
    const prevStatus = delivery.status;

    if (patch.deliveryFee !== undefined && Number(patch.deliveryFee) >= 0) {
      delivery.deliveryFee = Math.round(Number(patch.deliveryFee));
    }
    if (patch.estimatedDeliveryDate !== undefined) {
      delivery.estimatedDeliveryDate = sanitizeText(patch.estimatedDeliveryDate, 60);
    }
    if (patch.courier !== undefined) delivery.courier = sanitizeText(patch.courier, 120);
    if (patch.trackingNumber !== undefined) delivery.trackingNumber = sanitizeText(patch.trackingNumber, 120);
    if (patch.deliveryType !== undefined) delivery.deliveryType = patch.deliveryType;
    if (patch.zoneName !== undefined) delivery.zoneName = sanitizeText(patch.zoneName, 120);
    if (patch.otpRequired !== undefined) delivery.otpRequired = Boolean(patch.otpRequired);

    if (patch.status && patch.status !== prevStatus) {
      delivery.status = patch.status;
      if (patch.status === 'picked_up') delivery.pickedUpAt = now;
      if (patch.status === 'out_for_delivery') delivery.outForDeliveryAt = now;
      if (patch.status === 'arrived_at_destination') delivery.arrivedAt = now;
      if (patch.status === 'awaiting_customer_confirmation') {
        delivery.deliveredAt = delivery.deliveredAt || now;
        const firstHours = this.db.deliverySettings.reminderFirstAfterHours || 24;
        delivery.confirmation.nextReminderDueAt = new Date(Date.now() + firstHours * 3600 * 1000).toISOString();
      }
      if (patch.status === 'delivered_customer_confirmed') {
        delivery.deliveredAt = delivery.deliveredAt || now;
        delivery.confirmation.confirmed = true;
        delivery.confirmation.confirmedAt = delivery.confirmation.confirmedAt || now;
        delivery.confirmation.confirmedBy = delivery.confirmation.confirmedBy || 'admin_manual_resolution';
        if (order.paymentStatus === 'paid') {
          order.status = 'completed';
        }
      }
      if (patch.status === 'cancelled') {
        order.status = 'cancelled';
      }
    }

    delivery.updatedAt = now;
    delivery.history.unshift({
      id: `dh-${crypto.randomUUID().slice(0, 6)}`,
      fromStatus: prevStatus,
      toStatus: delivery.status,
      timestamp: now,
      actorType: 'admin',
      actorId: actorEmail,
      actorName: actorEmail,
      note: sanitizeText(patch.note || `Admin updated delivery (${DELIVERY_STATUS_LABELS[delivery.status]}).`, 240),
    });

    this.syncDeliverySummaryOntoOrder(order, delivery);

    const wc = this.getWooClient();
    if (wc && order.wooOrderId) {
      await wc
        .updateOrderDelivery(order.wooOrderId, {
          courier: delivery.courier,
          trackingNumber: delivery.trackingNumber,
          status: delivery.status,
          riderName: delivery.riderName,
          riderCode: delivery.riderCode,
          estimatedDeliveryDate: delivery.estimatedDeliveryDate,
          customerConfirmed: delivery.confirmation.confirmed,
        })
        .catch(() => {});
    }

    this.recordAudit(
      actorEmail,
      'UPDATE_DELIVERY',
      `delivery:${delivery.orderNumber}`,
      `Status=${delivery.status}`
    );
    this.persist();

    // Emit milestone emails cleanly
    if (patch.status && patch.status !== prevStatus) {
      if (patch.status === 'preparing_order') {
        await this.triggerOrderEmail({
          eventKey: 'order_processing',
          order,
          delivery,
          extraNote: patch.note,
          dedupeKey: `order_processing:${delivery.id}`,
        }).catch(() => {});
      } else if (patch.status === 'ready_for_pickup') {
        await this.triggerOrderEmail({
          eventKey: 'order_packed',
          order,
          delivery,
          dedupeKey: `order_packed:${delivery.id}`,
        }).catch(() => {});
      } else if (patch.status === 'out_for_delivery') {
        await this.triggerOrderEmail({
          eventKey: 'out_for_delivery',
          order,
          delivery,
          dedupeKey: `out_for_delivery:${delivery.id}`,
        }).catch(() => {});
      } else if (patch.status === 'awaiting_customer_confirmation') {
        await this.triggerOrderEmail({
          eventKey: 'confirm_receipt_request',
          order,
          delivery,
          dedupeKey: `confirm_receipt:${delivery.id}`,
        }).catch(() => {});
      } else if (patch.status === 'delivered_customer_confirmed') {
        await this.triggerOrderEmail({
          eventKey: 'receipt_confirmed',
          order,
          delivery,
          dedupeKey: `receipt_confirmed:${delivery.id}`,
        }).catch(() => {});
      }
    }

    return this.toPublicDelivery(delivery);
  }

  async recordCodCollection(actorEmail: string, deliveryOrOrderId: string, collected: boolean, confirmPaymentPaid = false): Promise<DeliveryRecord> {
    const delivery = this.db.deliveries.find(
      (d) => d.id === deliveryOrOrderId || d.orderId === deliveryOrOrderId
    );
    if (!delivery) throw new Error('Delivery record not found.');
    const order = this.db.orders.find((o) => o.id === delivery.orderId);
    if (!order) throw new Error('Linked order not found.');

    const now = new Date().toISOString();
    delivery.codCollected = collected;
    delivery.codCollectedAt = collected ? now : undefined;
    delivery.codConfirmedByAdmin = collected ? actorEmail : undefined;
    delivery.updatedAt = now;
    delivery.history.unshift({
      id: `dh-${crypto.randomUUID().slice(0, 6)}`,
      fromStatus: delivery.status,
      toStatus: delivery.status,
      timestamp: now,
      actorType: 'admin',
      actorId: actorEmail,
      actorName: actorEmail,
      note: collected
        ? `Admin confirmed COD collection of ₦${order.total.toLocaleString()} from rider.`
        : 'Admin marked COD settlement as pending.',
    });
    this.syncDeliverySummaryOntoOrder(order, delivery);
    this.recordAudit(actorEmail, 'COD_SETTLEMENT', `delivery:${delivery.orderNumber}`, `Collected=${collected}`);
    this.persist();

    if (collected && confirmPaymentPaid && order.paymentStatus !== 'paid') {
      await this.markOrderPaymentResult(order.id, {
        paid: true,
        verifiedAmountNgn: order.total,
        transactionId: `COD-${Date.now().toString().slice(-6)}`,
        note: `Pay on Delivery cash/POS remitted and settled by admin (${actorEmail}).`,
        actorEmail,
      });
    }
    return this.toPublicDelivery(delivery);
  }

  verifyDeliveryOtpByRider(
    riderId: string,
    deliveryId: string,
    otpCode: string
  ): { verified: boolean; delivery: DeliveryRecord } {
    const rider = this.db.riders.find((r) => r.id === riderId && r.status === 'active');
    if (!rider) throw new Error('Rider account is inactive or not found.');

    const delivery = this.db.deliveries.find((d) => d.id === deliveryId);
    if (!delivery) throw new Error('Delivery record not found.');
    if (delivery.riderId !== riderId) {
      throw new Error('Access denied: this delivery is not assigned to your rider account.');
    }
    if (!delivery.otpRequired) {
      delivery.otpVerified = true;
      this.persist();
      return { verified: true, delivery: this.toPublicDelivery(delivery) };
    }
    if (delivery.otpVerified) {
      return { verified: true, delivery: this.toPublicDelivery(delivery) };
    }
    if (!delivery.otpHash || !delivery.otpSalt) {
      throw new Error('No active OTP exists for this delivery. Ask the customer to generate/resend their OTP.');
    }
    if (delivery.otpExpiresAt && new Date(delivery.otpExpiresAt).getTime() < Date.now()) {
      throw new Error('This OTP has expired. Ask the customer to resend a fresh OTP.');
    }
    const remaining = delivery.otpAttemptsRemaining ?? this.db.deliverySettings.otpMaxAttempts;
    if (remaining <= 0) {
      throw new Error('Maximum OTP attempts exceeded. The customer must request a fresh OTP or admin override.');
    }

    const cleanCode = (otpCode || '').trim();
    const ok = verifyHashedValue(cleanCode, delivery.otpSalt, delivery.otpHash);
    const now = new Date().toISOString();

    if (!ok) {
      delivery.otpAttemptsRemaining = Math.max(0, remaining - 1);
      delivery.updatedAt = now;
      delivery.history.unshift({
        id: `dh-${crypto.randomUUID().slice(0, 6)}`,
        fromStatus: delivery.status,
        toStatus: delivery.status,
        timestamp: now,
        actorType: 'rider',
        actorId: rider.id,
        actorName: rider.fullName,
        note: `Incorrect OTP attempt entered (${delivery.otpAttemptsRemaining} attempts left).`,
      });
      this.persist();
      throw new Error(
        delivery.otpAttemptsRemaining > 0
          ? `Invalid OTP code. ${delivery.otpAttemptsRemaining} attempt(s) remaining.`
          : 'Invalid OTP code. Maximum attempts reached; customer must request a new OTP.'
      );
    }

    delivery.otpVerified = true;
    delivery.otpVerifiedAt = now;
    delivery.otpVerifiedByRiderId = rider.id;
    delivery.otpVerifiedByRiderName = rider.fullName;
    delivery.otpHash = undefined;
    delivery.otpSalt = undefined;
    delivery.evidence = {
      ...(delivery.evidence || {}),
      otpVerified: true,
    };
    delivery.updatedAt = now;
    delivery.history.unshift({
      id: `dh-${crypto.randomUUID().slice(0, 6)}`,
      fromStatus: delivery.status,
      toStatus: delivery.status,
      timestamp: now,
      actorType: 'rider',
      actorId: rider.id,
      actorName: rider.fullName,
      note: 'Customer 6-digit OTP verified cleanly at handoff.',
    });

    const order = this.db.orders.find((o) => o.id === delivery.orderId);
    if (order) this.syncDeliverySummaryOntoOrder(order, delivery);
    this.persist();
    return { verified: true, delivery: this.toPublicDelivery(delivery) };
  }

  async riderUpdateDeliveryStatus(
    riderId: string,
    deliveryId: string,
    input: {
      toStatus: DeliveryStatus;
      note?: string;
      failureReason?: string;
      codCollected?: boolean;
      evidence?: Partial<DeliveryEvidence>;
    }
  ): Promise<DeliveryRecord> {
    const rider = this.db.riders.find((r) => r.id === riderId && r.status === 'active');
    if (!rider) throw new Error('Rider account is inactive or unauthorized.');

    const delivery = this.db.deliveries.find((d) => d.id === deliveryId);
    if (!delivery) throw new Error('Delivery record not found.');
    if (delivery.riderId !== riderId) {
      throw new Error('Access denied: you can only update deliveries assigned to you.');
    }
    if (!RIDER_ALLOWED_TARGET_STATUSES.includes(input.toStatus)) {
      throw new Error('Invalid delivery status action for rider role.');
    }

    const order = this.db.orders.find((o) => o.id === delivery.orderId);
    if (!order) throw new Error('Linked order not found.');

    const ds = this.db.deliverySettings;
    const now = new Date().toISOString();
    const prevStatus = delivery.status;

    if (input.toStatus === 'awaiting_customer_confirmation') {
      if (delivery.otpRequired && !delivery.otpVerified) {
        throw new Error('Customer OTP verification is required before completing this delivery.');
      }
      if (input.evidence) {
        delivery.evidence = {
          ...(delivery.evidence || {}),
          recipientName: sanitizeText(input.evidence.recipientName || delivery.recipientName, 120),
          notes: sanitizeText(input.evidence.notes || input.note || '', 300),
          photoUrl: ds.collectDeliveryPhoto ? sanitizeText(input.evidence.photoUrl || '', 300) : undefined,
          locationNote: ds.collectDeliveryLocation
            ? sanitizeText(input.evidence.locationNote || '', 200)
            : undefined,
          locationLat:
            ds.collectDeliveryLocation && input.evidence.locationConsentGranted
              ? Number(input.evidence.locationLat) || undefined
              : undefined,
          locationLng:
            ds.collectDeliveryLocation && input.evidence.locationConsentGranted
              ? Number(input.evidence.locationLng) || undefined
              : undefined,
          locationConsentGranted: Boolean(ds.collectDeliveryLocation && input.evidence.locationConsentGranted),
          submittedAt: now,
          submittedByRiderId: rider.id,
          submittedByRiderName: rider.fullName,
          otpVerified: delivery.otpVerified,
        };
      }
      delivery.deliveredAt = now;
      delivery.confirmation.nextReminderDueAt = new Date(
        Date.now() + (ds.reminderFirstAfterHours || 24) * 3600 * 1000
      ).toISOString();

      // Strictly separate COD handoff collection report from verified payment status
      if (order.paymentMethod === 'cod' && input.codCollected) {
        delivery.codCollected = true;
        delivery.codCollectedAt = now;
        order.notes.unshift({
          id: `note-${crypto.randomUUID().slice(0, 6)}`,
          author: `${rider.fullName} (${rider.riderCode})`,
          note: `Rider reported Pay on Delivery collection of ₦${order.total.toLocaleString()} — pending administrator payment confirmation.`,
          isCustomerVisible: false,
          createdAt: now,
        });
      }
    }

    if (input.toStatus === 'picked_up') delivery.pickedUpAt = now;
    if (input.toStatus === 'out_for_delivery') delivery.outForDeliveryAt = now;
    if (input.toStatus === 'arrived_at_destination') delivery.arrivedAt = now;
    if (input.toStatus === 'delivery_failed') {
      delivery.failureReason = sanitizeText(input.failureReason || input.note || 'Delivery attempt failed', 240);
    }

    delivery.status = input.toStatus;
    delivery.updatedAt = now;
    delivery.history.unshift({
      id: `dh-${crypto.randomUUID().slice(0, 6)}`,
      fromStatus: prevStatus,
      toStatus: input.toStatus,
      timestamp: now,
      actorType: 'rider',
      actorId: rider.id,
      actorName: `${rider.fullName} (${rider.riderCode})`,
      note: sanitizeText(
        input.failureReason || input.note || `Rider marked delivery as ${DELIVERY_STATUS_LABELS[input.toStatus]}.`,
        240
      ),
    });

    order.notes.unshift({
      id: `note-${crypto.randomUUID().slice(0, 6)}`,
      author: `Dispatch Rider (${rider.fullName})`,
      note: `Delivery status updated: ${DELIVERY_STATUS_LABELS[input.toStatus]}${
        input.note ? ` — ${sanitizeText(input.note, 200)}` : ''
      }`,
      isCustomerVisible: true,
      createdAt: now,
    });

    this.syncDeliverySummaryOntoOrder(order, delivery);

    const wc = this.getWooClient();
    if (wc && order.wooOrderId) {
      await wc
        .updateOrderDelivery(order.wooOrderId, {
          courier: delivery.courier,
          trackingNumber: delivery.trackingNumber,
          status: delivery.status,
          riderName: delivery.riderName,
          riderCode: delivery.riderCode,
          estimatedDeliveryDate: delivery.estimatedDeliveryDate,
          customerConfirmed: delivery.confirmation.confirmed,
        })
        .catch(() => {});
    }

    this.pushNotification({
      type: 'delivery_update',
      title: `Rider Update (${order.orderNumber}): ${DELIVERY_STATUS_LABELS[input.toStatus]}`,
      message: `${rider.fullName} updated delivery status to ${DELIVERY_STATUS_LABELS[input.toStatus]}.`,
      orderId: order.id,
    });
    this.persist();

    if (input.toStatus === 'picked_up') {
      await this.triggerOrderEmail({
        eventKey: 'rider_picked_up',
        order,
        delivery,
        dedupeKey: `rider_picked_up:${delivery.id}`,
      }).catch(() => {});
    } else if (input.toStatus === 'out_for_delivery') {
      await this.triggerOrderEmail({
        eventKey: 'out_for_delivery',
        order,
        delivery,
        dedupeKey: `out_for_delivery:${delivery.id}`,
      }).catch(() => {});
    } else if (input.toStatus === 'awaiting_customer_confirmation') {
      await this.triggerOrderEmail({
        eventKey: 'rider_delivered',
        order,
        delivery,
        dedupeKey: `rider_delivered:${delivery.id}`,
      }).catch(() => {});
    }

    return this.toPublicDelivery(delivery);
  }

  async resendOtpForCustomerOrder(
    orderId: string,
    customerUid: string,
    customerEmail: string
  ): Promise<{ sent: boolean; transport: string; sandboxOtpPreview?: string }> {
    const order = this.getOrderByIdOrRef(orderId);
    if (!order) throw new Error('Order not found.');
    const isOwner =
      (order.customerUid && order.customerUid === customerUid) ||
      order.customerEmail === customerEmail.trim().toLowerCase();
    if (!isOwner) throw new Error('Access denied: you can only request an OTP for your own order.');

    const delivery = this.db.deliveries.find((d) => d.orderId === order.id);
    if (!delivery) throw new Error('Delivery record not found.');
    if (!delivery.otpRequired) throw new Error('OTP verification is not enabled for this delivery.');
    if (delivery.otpVerified) throw new Error('Delivery OTP has already been verified.');

    // Enforce small cooldown (30s)
    if (delivery.otpLastSentAt && Date.now() - new Date(delivery.otpLastSentAt).getTime() < 30 * 1000) {
      throw new Error('Please wait 30 seconds before requesting a new OTP code.');
    }

    const code = this.issueOtpForDeliveryInternal(delivery);
    if (!code) throw new Error('Unable to generate OTP code.');
    this.persist();

    const emailRes = await this.triggerOrderEmail({
      eventKey: 'delivery_otp',
      order,
      delivery,
      otpCode: code,
      dedupeKey: '__allow_repeat__',
    });

    const isSandbox = emailRes.log?.transport === 'sandbox_log';
    return {
      sent: true,
      transport: emailRes.log?.transport || 'sandbox_log',
      sandboxOtpPreview: isSandbox ? code : undefined,
    };
  }

  getConfirmationPreviewByToken(rawToken: string): {
    orderId: string;
    orderNumber: string;
    deliveryStatus: DeliveryStatus;
    alreadyConfirmed: boolean;
    disputed: boolean;
    deliveredAt?: string;
    estimatedDeliveryDate?: string;
    riderName?: string;
    riderVehicle?: string;
    riderId?: string | null;
    items: {
      productId: string;
      name: string;
      quantity: number;
      image: string;
      attributes?: Record<string, string>;
    }[];
  } {
    const verified = this.verifyConfirmationToken(rawToken);
    if (!verified) throw new Error('Invalid or tampered delivery confirmation link.');

    const delivery = this.db.deliveries.find((d) => d.id === verified.deliveryId);
    if (!delivery || delivery.confirmationNonce !== verified.nonce) {
      throw new Error('This confirmation link is no longer valid.');
    }
    const order = this.db.orders.find((o) => o.id === delivery.orderId);
    if (!order) throw new Error('Order not found.');

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      deliveryStatus: delivery.status,
      alreadyConfirmed: delivery.confirmation.confirmed,
      disputed: delivery.status === 'delivery_disputed',
      deliveredAt: delivery.deliveredAt,
      estimatedDeliveryDate: delivery.estimatedDeliveryDate,
      riderId: delivery.riderId || null,
      riderName: delivery.riderName,
      riderVehicle: delivery.riderVehicle,
      items: order.items.map((item) => ({
        productId: item.productId,
        name: item.name,
        quantity: item.quantity,
        image: item.image,
        attributes: item.attributes,
      })),
    };
  }

  async confirmDeliveryByToken(rawToken: string): Promise<{ delivery: DeliveryRecord; orderNumber: string }> {
    const verified = this.verifyConfirmationToken(rawToken);
    if (!verified) throw new Error('Invalid or tampered delivery confirmation link.');
    const delivery = this.db.deliveries.find((d) => d.id === verified.deliveryId);
    if (!delivery || delivery.confirmationNonce !== verified.nonce) {
      throw new Error('This confirmation link has expired or is invalid.');
    }
    const order = this.db.orders.find((o) => o.id === delivery.orderId);
    if (!order) throw new Error('Order not found.');
    const updated = await this.finalizeCustomerConfirmation(delivery, order, 'customer_link', order.customerEmail);
    return { delivery: updated, orderNumber: order.orderNumber };
  }

  async customerConfirmDelivery(
    orderId: string,
    customerUid: string,
    customerEmail: string
  ): Promise<DeliveryRecord> {
    const order = this.getOrderByIdOrRef(orderId);
    if (!order) throw new Error('Order not found.');
    const isOwner =
      (order.customerUid && order.customerUid === customerUid) ||
      order.customerEmail === customerEmail.trim().toLowerCase();
    if (!isOwner) throw new Error('Access denied: you can only confirm your own orders.');

    const delivery = this.db.deliveries.find((d) => d.orderId === order.id);
    if (!delivery) throw new Error('Delivery record not found.');
    return this.finalizeCustomerConfirmation(delivery, order, 'customer_dashboard', customerEmail);
  }

  private async finalizeCustomerConfirmation(
    delivery: StoredDeliveryRecord,
    order: Order,
    method: 'customer_link' | 'customer_dashboard',
    actorLabel: string
  ): Promise<DeliveryRecord> {
    if (delivery.confirmation.confirmed) {
      return this.toPublicDelivery(delivery);
    }
    if (['cancelled', 'returned_to_store'].includes(delivery.status)) {
      throw new Error('Cannot confirm delivery on a cancelled or returned order.');
    }

    const now = new Date().toISOString();
    const prevStatus = delivery.status;
    delivery.status = 'delivered_customer_confirmed';
    delivery.deliveredAt = delivery.deliveredAt || now;
    delivery.updatedAt = now;
    delivery.confirmation.confirmed = true;
    delivery.confirmation.confirmedAt = now;
    delivery.confirmation.confirmedBy = method;
    delivery.confirmation.nextReminderDueAt = undefined;

    delivery.history.unshift({
      id: `dh-${crypto.randomUUID().slice(0, 6)}`,
      fromStatus: prevStatus,
      toStatus: 'delivered_customer_confirmed',
      timestamp: now,
      actorType: 'customer',
      actorId: order.customerUid || order.customerEmail,
      actorName: `${order.billing.firstName} ${order.billing.lastName}`.trim(),
      note: `Customer confirmed order receipt via ${method === 'customer_link' ? 'confirmation link' : 'customer dashboard'}.`,
    });

    // Only transition Woo/Store order to completed if payment is verified
    if (order.paymentStatus === 'paid') {
      order.status = 'completed';
    }
    order.notes.unshift({
      id: `note-${crypto.randomUUID().slice(0, 6)}`,
      author: actorLabel,
      note: 'Customer confirmed receipt of delivered items.',
      isCustomerVisible: true,
      createdAt: now,
    });

    this.syncDeliverySummaryOntoOrder(order, delivery);

    const wc = this.getWooClient();
    if (wc && order.wooOrderId) {
      await wc.updateOrderStatus(order.wooOrderId, order.status).catch(() => {});
      await wc
        .updateOrderDelivery(order.wooOrderId, {
          courier: delivery.courier,
          trackingNumber: delivery.trackingNumber,
          status: delivery.status,
          riderName: delivery.riderName,
          riderCode: delivery.riderCode,
          estimatedDeliveryDate: delivery.estimatedDeliveryDate,
          customerConfirmed: true,
        })
        .catch(() => {});
    }

    this.pushNotification({
      type: 'customer_confirmed',
      title: `Receipt Confirmed: ${order.orderNumber}`,
      message: `${order.billing.firstName} ${order.billing.lastName} confirmed safe delivery of order ${order.orderNumber}.`,
      orderId: order.id,
    });
    this.persist();

    await this.triggerOrderEmail({
      eventKey: 'receipt_confirmed',
      order,
      delivery,
      dedupeKey: `receipt_confirmed:${delivery.id}`,
    }).catch(() => {});

    return this.toPublicDelivery(delivery);
  }

  async sendManualConfirmationReminder(actorEmail: string, deliveryOrOrderId: string): Promise<DeliveryRecord> {
    const delivery = this.db.deliveries.find(
      (d) => d.id === deliveryOrOrderId || d.orderId === deliveryOrOrderId
    );
    if (!delivery) throw new Error('Delivery not found.');
    if (delivery.confirmation.confirmed) throw new Error('Customer already confirmed delivery.');
    const order = this.db.orders.find((o) => o.id === delivery.orderId);
    if (!order) throw new Error('Order not found.');

    const now = new Date().toISOString();
    delivery.confirmation.reminderCount += 1;
    delivery.confirmation.lastReminderAt = now;
    delivery.updatedAt = now;
    this.persist();

    await this.triggerOrderEmail({
      eventKey: 'confirmation_overdue',
      order,
      delivery,
      dedupeKey: '__allow_repeat__',
    });
    this.recordAudit(actorEmail, 'SEND_CONFIRMATION_REMINDER', `order:${order.orderNumber}`, `Reminder #${delivery.confirmation.reminderCount}`);
    return this.toPublicDelivery(delivery);
  }

  async runConfirmationReminders(): Promise<{ remindersSent: number }> {
    const ds = this.db.deliverySettings;
    if (!ds.requireCustomerConfirmation || !ds.enableAutomatedEmails) {
      return { remindersSent: 0 };
    }
    const nowMs = Date.now();
    let remindersSent = 0;

    for (const delivery of this.db.deliveries) {
      if (
        delivery.status !== 'awaiting_customer_confirmation' ||
        delivery.confirmation.confirmed ||
        delivery.confirmation.reminderCount >= 2
      ) {
        continue;
      }
      const dueMs = delivery.confirmation.nextReminderDueAt
        ? new Date(delivery.confirmation.nextReminderDueAt).getTime()
        : delivery.deliveredAt
        ? new Date(delivery.deliveredAt).getTime() + ds.reminderFirstAfterHours * 3600 * 1000
        : null;
      if (!dueMs || nowMs < dueMs) continue;

      const order = this.db.orders.find((o) => o.id === delivery.orderId);
      if (!order) continue;

      const countBefore = delivery.confirmation.reminderCount;
      delivery.confirmation.reminderCount = countBefore + 1;
      delivery.confirmation.lastReminderAt = new Date().toISOString();
      if (delivery.confirmation.reminderCount === 1 && delivery.deliveredAt) {
        delivery.confirmation.nextReminderDueAt = new Date(
          new Date(delivery.deliveredAt).getTime() + ds.reminderSecondAfterHours * 3600 * 1000
        ).toISOString();
      } else {
        delivery.confirmation.nextReminderDueAt = undefined;
      }

      await this.triggerOrderEmail({
        eventKey: 'confirmation_overdue',
        order,
        delivery,
        dedupeKey: `confirmation_overdue:${delivery.id}:${delivery.confirmation.reminderCount}`,
      }).catch(() => {});
      remindersSent += 1;
    }

    if (remindersSent > 0) this.persist();
    return { remindersSent };
  }

  // --- Delivery Complaints & Disputes ---
  async submitComplaint(input: {
    orderId?: string;
    confirmToken?: string;
    customerUid?: string | null;
    customerEmail?: string;
    category: ComplaintCategory;
    subject: string;
    description: string;
    evidenceUrls?: string[];
  }): Promise<DeliveryComplaint> {
    let order: Order | undefined;
    let delivery: StoredDeliveryRecord | undefined;

    if (input.confirmToken) {
      const verified = this.verifyConfirmationToken(input.confirmToken);
      if (!verified) throw new Error('Invalid confirmation token.');
      delivery = this.db.deliveries.find((d) => d.id === verified.deliveryId);
      if (!delivery || delivery.confirmationNonce !== verified.nonce) {
        throw new Error('Expired confirmation token.');
      }
      order = this.db.orders.find((o) => o.id === delivery!.orderId);
    } else if (input.orderId) {
      order = this.db.orders.find((o) => o.id === input.orderId);
      if (!order) throw new Error('Order not found.');
      const cleanEmail = (input.customerEmail || '').trim().toLowerCase();
      const isOwner =
        (input.customerUid && order.customerUid === input.customerUid) ||
        (cleanEmail && order.customerEmail === cleanEmail);
      if (!isOwner) throw new Error('Access denied: you can only report issues for your own order.');
      delivery = this.db.deliveries.find((d) => d.orderId === order!.id);
    }

    if (!order) throw new Error('Order is required to submit a delivery complaint.');
    if (!input.subject?.trim() || !input.description?.trim()) {
      throw new Error('Complaint subject and detailed description are required.');
    }

    const now = new Date().toISOString();
    const complaint: DeliveryComplaint = {
      id: `cmp-${crypto.randomUUID().slice(0, 8)}`,
      complaintNumber: `DM-CMP-${Date.now().toString().slice(-6)}`,
      orderId: order.id,
      orderNumber: order.orderNumber,
      deliveryId: delivery?.id,
      riderId: delivery?.riderId || null,
      riderName: delivery?.riderName,
      customerUid: order.customerUid,
      customerName: `${order.billing.firstName} ${order.billing.lastName}`.trim(),
      customerEmail: order.customerEmail,
      customerPhone: order.billing.phone,
      category: input.category || 'other',
      subject: sanitizeText(input.subject, 160),
      description: sanitizeText(input.description, 1500),
      evidenceUrls: Array.isArray(input.evidenceUrls)
        ? input.evidenceUrls.filter((u) => typeof u === 'string').slice(0, 4)
        : [],
      status: 'open',
      adminNotes: [],
      createdAt: now,
      updatedAt: now,
    };

    if (delivery && this.db.deliverySettings.enableDisputeWorkflow) {
      const prevStatus = delivery.status;
      delivery.status = 'delivery_disputed';
      delivery.confirmation.disputeReason = complaint.subject;
      delivery.confirmation.nextReminderDueAt = undefined;
      delivery.updatedAt = now;
      delivery.history.unshift({
        id: `dh-${crypto.randomUUID().slice(0, 6)}`,
        fromStatus: prevStatus,
        toStatus: 'delivery_disputed',
        timestamp: now,
        actorType: 'customer',
        actorId: order.customerUid || order.customerEmail,
        actorName: complaint.customerName,
        note: `Customer reported delivery issue (${complaint.complaintNumber}): ${complaint.subject}`,
      });
      this.syncDeliverySummaryOntoOrder(order, delivery);
    }

    this.db.complaints.unshift(complaint);
    this.pushNotification({
      type: 'complaint_submitted',
      title: `Delivery Dispute: ${order.orderNumber} (${complaint.complaintNumber})`,
      message: `${complaint.customerName} reported: ${complaint.subject}`,
      orderId: order.id,
    });
    this.persist();

    await this.triggerOrderEmail({
      eventKey: 'complaint_submitted',
      order,
      delivery,
      complaint,
      dedupeKey: `complaint_submitted:${complaint.id}`,
    }).catch(() => {});

    return complaint;
  }

  listAllComplaints(): DeliveryComplaint[] {
    return this.db.complaints;
  }

  listCustomerComplaints(uid: string, email: string): DeliveryComplaint[] {
    const cleanEmail = email.trim().toLowerCase();
    return this.db.complaints.filter(
      (c) => (c.customerUid && c.customerUid === uid) || c.customerEmail === cleanEmail
    );
  }

  async adminUpdateComplaint(
    actorEmail: string,
    complaintId: string,
    patch: {
      status?: ComplaintStatus;
      adminNote?: string;
      resolutionSummary?: string;
      nextDeliveryStatus?: DeliveryStatus;
    }
  ): Promise<DeliveryComplaint> {
    const idx = this.db.complaints.findIndex((c) => c.id === complaintId);
    if (idx === -1) throw new Error('Complaint not found.');
    const complaint = this.db.complaints[idx];
    const now = new Date().toISOString();

    if (patch.status) complaint.status = patch.status;
    if (patch.resolutionSummary !== undefined) {
      complaint.resolutionSummary = sanitizeText(patch.resolutionSummary, 800);
    }
    if (patch.adminNote?.trim()) {
      complaint.adminNotes.unshift({
        id: `cn-${crypto.randomUUID().slice(0, 6)}`,
        author: actorEmail,
        note: sanitizeText(patch.adminNote, 800),
        createdAt: now,
      });
    }
    if (patch.status === 'resolved' || patch.status === 'closed') {
      complaint.resolvedAt = now;
      complaint.resolvedBy = actorEmail;
    }
    complaint.updatedAt = now;

    const delivery = complaint.deliveryId
      ? this.db.deliveries.find((d) => d.id === complaint.deliveryId)
      : this.db.deliveries.find((d) => d.orderId === complaint.orderId);
    const order = this.db.orders.find((o) => o.id === complaint.orderId);

    if (patch.nextDeliveryStatus && delivery && order) {
      await this.adminUpdateDelivery(actorEmail, delivery.id, {
        status: patch.nextDeliveryStatus,
        note: `Updated during complaint ${complaint.complaintNumber} resolution.`,
      });
    }

    this.recordAudit(
      actorEmail,
      'UPDATE_COMPLAINT',
      `complaint:${complaint.complaintNumber}`,
      `Status=${complaint.status}`
    );
    this.persist();

    if (order) {
      await this.triggerOrderEmail({
        eventKey: 'complaint_updated',
        order,
        delivery,
        complaint,
        extraNote: patch.adminNote,
        dedupeKey: '__allow_repeat__',
      }).catch(() => {});
    }

    return complaint;
  }

  // --- Rider Reviews & Public Verified Testimonials ---
  submitRiderReview(input: {
    orderId?: string;
    confirmToken?: string;
    customerUid?: string | null;
    customerEmail?: string;
    politenessRating: number;
    communicationRating: number;
    timelinessRating: number;
    handlingRating: number;
    comment: string;
  }): RiderReview {
    let order: Order | undefined;
    let delivery: StoredDeliveryRecord | undefined;

    if (input.confirmToken) {
      const verified = this.verifyConfirmationToken(input.confirmToken);
      if (!verified) throw new Error('Invalid confirmation token.');
      delivery = this.db.deliveries.find((d) => d.id === verified.deliveryId);
      if (!delivery || delivery.confirmationNonce !== verified.nonce) {
        throw new Error('Expired confirmation token.');
      }
      order = this.db.orders.find((o) => o.id === delivery!.orderId);
    } else if (input.orderId) {
      order = this.db.orders.find((o) => o.id === input.orderId);
      if (!order) throw new Error('Order not found.');
      const cleanEmail = (input.customerEmail || '').trim().toLowerCase();
      const isOwner =
        (input.customerUid && order.customerUid === input.customerUid) ||
        (cleanEmail && order.customerEmail === cleanEmail);
      if (!isOwner) throw new Error('Access denied: you can only rate riders for your own deliveries.');
      delivery = this.db.deliveries.find((d) => d.orderId === order!.id);
    }

    if (!order || !delivery) throw new Error('Delivery record not found.');
    if (!delivery.riderId || !delivery.riderName) {
      throw new Error('This delivery does not have an assigned Diamond Market rider to review.');
    }
    if (!['awaiting_customer_confirmation', 'delivered_customer_confirmed'].includes(delivery.status)) {
      throw new Error('Rider feedback can only be submitted once delivery is completed or awaiting confirmation.');
    }
    const alreadyReviewed = this.db.riderReviews.some(
      (r) => r.orderId === order!.id && r.riderId === delivery!.riderId
    );
    if (alreadyReviewed) {
      throw new Error('You have already submitted a rider review for this order.');
    }

    const clamp = (n: number) => Math.min(5, Math.max(1, Math.round(Number(n) || 5)));
    const p = clamp(input.politenessRating);
    const c = clamp(input.communicationRating);
    const t = clamp(input.timelinessRating);
    const h = clamp(input.handlingRating);
    const overall = Number(((p + c + t + h) / 4).toFixed(1));

    const review: RiderReview = {
      id: `rrev-${crypto.randomUUID().slice(0, 8)}`,
      orderId: order.id,
      orderNumber: order.orderNumber,
      deliveryId: delivery.id,
      riderId: delivery.riderId,
      riderName: delivery.riderName,
      customerUid: order.customerUid,
      customerEmail: order.customerEmail,
      customerDisplayName: `${order.billing.firstName} ${order.billing.lastName.slice(0, 1)}.`.trim(),
      politenessRating: p,
      communicationRating: c,
      timelinessRating: t,
      handlingRating: h,
      overallRating: overall,
      comment: sanitizeText(input.comment || '', 800),
      featuredTestimonial: false,
      status: 'approved',
      createdAt: new Date().toISOString(),
    };

    this.db.riderReviews.unshift(review);
    this.persist();
    return { ...review, customerEmail: undefined };
  }

  getRiderReviews(options?: { riderId?: string; includeAllStatuses?: boolean; stripPrivateEmail?: boolean }): RiderReview[] {
    return this.db.riderReviews
      .filter((r) => {
        if (options?.riderId && r.riderId !== options.riderId) return false;
        if (!options?.includeAllStatuses && r.status !== 'approved') return false;
        return true;
      })
      .map((r) => (options?.stripPrivateEmail ? { ...r, customerEmail: undefined } : r));
  }

  moderateRiderReview(
    actorEmail: string,
    reviewId: string,
    patch: { status?: RiderReview['status']; featuredTestimonial?: boolean }
  ): RiderReview[] {
    const idx = this.db.riderReviews.findIndex((r) => r.id === reviewId);
    if (idx === -1) throw new Error('Rider review not found.');
    if (patch.status) this.db.riderReviews[idx].status = patch.status;
    if (patch.featuredTestimonial !== undefined) {
      this.db.riderReviews[idx].featuredTestimonial = patch.featuredTestimonial;
      if (patch.featuredTestimonial) this.db.riderReviews[idx].status = 'approved';
    }
    this.recordAudit(actorEmail, 'MODERATE_RIDER_REVIEW', `rider_review:${reviewId}`, JSON.stringify(patch));
    this.persist();
    return this.db.riderReviews;
  }

  getPublicTestimonials(): {
    productTestimonials: Omit<ProductReview, 'reviewerEmail'>[];
    riderTestimonials: RiderReview[];
  } {
    const approvedProducts = this.db.reviews.filter((r) => r.status === 'approved' && r.verifiedPurchase);
    const featuredProducts = approvedProducts.filter((r) => r.featuredTestimonial);
    const productList = (featuredProducts.length > 0 ? featuredProducts : approvedProducts).slice(0, 6);

    const approvedRiders = this.db.riderReviews.filter((r) => r.status === 'approved');
    const featuredRiders = approvedRiders.filter((r) => r.featuredTestimonial);
    const riderList = (featuredRiders.length > 0 ? featuredRiders : approvedRiders).slice(0, 4);

    return {
      productTestimonials: productList.map(({ reviewerEmail: _re, ...clean }) => clean),
      riderTestimonials: riderList.map(({ customerEmail: _ce, ...clean }) => clean),
    };
  }

  // --- Delivery Settings, Analytics & Email Logs ---
  getDeliverySettings(): DeliverySettings {
    return this.db.deliverySettings;
  }

  updateDeliverySettings(actorEmail: string, patch: Partial<DeliverySettings>): DeliverySettings {
    this.db.deliverySettings = {
      ...this.db.deliverySettings,
      ...patch,
      estimatedTimes: {
        ...this.db.deliverySettings.estimatedTimes,
        ...(patch.estimatedTimes || {}),
      },
    };

    // Synchronize default shipping zone flat rates if updated
    const syncZone = (zoneId: string, fee: number, est: string, enabled: boolean, pickup?: boolean) => {
      const z = this.db.shippingZones.find((item) => item.id === zoneId);
      if (z) {
        z.flatRate = fee;
        z.estimatedDays = est;
        z.enabled = enabled;
        if (pickup !== undefined) {
          z.pickupAvailable = pickup;
          z.pickupAddress = this.db.deliverySettings.pickupAddress;
        }
      }
    };
    const ds = this.db.deliverySettings;
    syncZone('zone-ogbomoso-oyo', ds.ogbomosoLocalFee, ds.estimatedTimes.local, ds.localDeliveryEnabled, ds.pickupEnabled);
    syncZone('zone-sw-abuja', ds.interstateDefaultFee, ds.estimatedTimes.interstate, ds.interstateDeliveryEnabled);
    syncZone('zone-nationwide', ds.nationwideDefaultFee, ds.estimatedTimes.nationwide, ds.nationwideDeliveryEnabled);

    this.recordAudit(actorEmail, 'UPDATE_DELIVERY_SETTINGS', 'delivery_settings', 'Updated delivery & OTP rules');
    this.persist();
    return this.db.deliverySettings;
  }

  getDeliveryAnalytics(): DeliveryAnalytics {
    return computeDeliveryAnalytics({
      deliveries: this.listDeliveries(),
      riders: this.listRiders(),
      riderReviews: this.db.riderReviews,
      complaints: this.db.complaints,
      orders: this.db.orders,
    });
  }

  getEmailLogs(): EmailLogEntry[] {
    return this.db.emailLogs;
  }

  // --- Store Settings, Customers, Notifications, Audit Logs, Analytics ---
  getStoreSettings(): StoreSettings {
    return this.db.storeSettings;
  }

  updateStoreSettings(actorEmail: string, patch: Partial<StoreSettings>): StoreSettings {
    this.db.storeSettings = {
      ...this.db.storeSettings,
      ...patch,
      socialLinks: {
        ...this.db.storeSettings.socialLinks,
        ...(patch.socialLinks || {}),
      },
      notificationSettings: {
        ...this.db.storeSettings.notificationSettings,
        ...(patch.notificationSettings || {}),
      },
    };
    this.syncStoreSettingsIntoCms(this.db.cmsPublished);
    this.syncStoreSettingsIntoCms(this.db.cmsDraft);
    this.recordAudit(actorEmail, 'UPDATE_STORE_SETTINGS', 'store_settings', 'Updated store preferences');
    this.persist();
    return this.db.storeSettings;
  }

  // --- Dynamic Website Editor (CMS) & Media Library ---
  private ensureCmsMigrations(): void {
    let dirty = false;
    const defaultCms = createDefaultCmsData(this.db.storeSettings);
    if (!this.db.cmsPublished) {
      this.db.cmsPublished = defaultCms;
      this.db.cmsLastPublishedAt = new Date().toISOString();
      dirty = true;
    } else {
      this.db.cmsPublished = sanitizeCmsData(this.db.cmsPublished, defaultCms);
    }
    if (!this.db.cmsDraft) {
      this.db.cmsDraft = JSON.parse(JSON.stringify(this.db.cmsPublished)) as CmsData;
      this.db.cmsLastDraftSavedAt = this.db.cmsLastPublishedAt || new Date().toISOString();
      dirty = true;
    } else {
      this.db.cmsDraft = sanitizeCmsData(this.db.cmsDraft, this.db.cmsPublished);
    }
    if (!Array.isArray(this.db.mediaLibrary) || this.db.mediaLibrary.length === 0) {
      this.db.mediaLibrary = createInitialMediaLibrary();
      dirty = true;
    }
    if (dirty) {
      this.persist();
    }
  }

  private syncStoreSettingsIntoCms(targetCms: CmsData): void {
    if (!targetCms) return;
    const s = this.db.storeSettings;
    targetCms.header.storeNameDisplay = s.storeName || targetCms.header.storeNameDisplay;
    targetCms.header.announcementEnabled = s.announcementEnabled;
    targetCms.header.announcementText = s.announcementBar;
    targetCms.footer.phone = s.phone;
    targetCms.footer.email = s.storeEmail;
    targetCms.footer.address = s.address;
    if (s.footerTagline) targetCms.footer.aboutText = s.footerTagline;
    targetCms.footer.socialLinks = {
      ...targetCms.footer.socialLinks,
      instagram: s.socialLinks.instagram,
      twitter: s.socialLinks.twitter,
      facebook: s.socialLinks.facebook,
      whatsapp: s.whatsapp,
    };
    const heroSec = targetCms.homepageSections.find((sec) => sec.type === 'hero');
    if (heroSec) {
      heroSec.eyebrow = s.heroEyebrow;
      heroSec.title = s.heroTitle;
      heroSec.subtitle = s.heroSubtitle;
      heroSec.primaryCtaText = s.heroCtaLabel;
      heroSec.secondaryCtaText = s.heroSecondaryCtaLabel || heroSec.secondaryCtaText;
      heroSec.imageUrl = s.heroImage || heroSec.imageUrl;
    }
    const promoSec = targetCms.homepageSections.find((sec) => sec.type === 'promo_banner');
    if (promoSec) {
      promoSec.title = s.promoBannerTitle;
      promoSec.subtitle = s.promoBannerSubtitle;
    }
  }

  private syncPublishedCmsToStoreSettings(cms: CmsData): void {
    const s = this.db.storeSettings;
    s.storeName = cms.header.storeNameDisplay || s.storeName;
    s.announcementEnabled = Boolean(cms.header.announcementEnabled);
    s.announcementBar = cms.header.announcementText || s.announcementBar;
    s.phone = cms.footer.phone || s.phone;
    s.storeEmail = cms.footer.email || s.storeEmail;
    s.address = cms.footer.address || s.address;
    s.whatsapp = cms.footer.socialLinks.whatsapp || s.whatsapp;
    s.footerTagline = cms.footer.aboutText || s.footerTagline;
    s.socialLinks = {
      instagram: cms.footer.socialLinks.instagram || s.socialLinks.instagram,
      twitter: cms.footer.socialLinks.twitter || s.socialLinks.twitter,
      facebook: cms.footer.socialLinks.facebook || s.socialLinks.facebook,
    };
    const heroSec = cms.homepageSections.find((sec) => sec.type === 'hero' && sec.enabled);
    if (heroSec) {
      s.heroEyebrow = heroSec.eyebrow || s.heroEyebrow;
      s.heroTitle = heroSec.title || s.heroTitle;
      s.heroSubtitle = heroSec.subtitle || s.heroSubtitle;
      s.heroCtaLabel = heroSec.primaryCtaText || s.heroCtaLabel;
      s.heroSecondaryCtaLabel = heroSec.secondaryCtaText || s.heroSecondaryCtaLabel;
      s.heroImage = heroSec.imageUrl || s.heroImage;
    }
    const promoSec = cms.homepageSections.find((sec) => sec.type === 'promo_banner' && sec.enabled);
    if (promoSec) {
      s.promoBannerTitle = promoSec.title || s.promoBannerTitle;
      s.promoBannerSubtitle = promoSec.subtitle || s.promoBannerSubtitle;
    }
  }

  getPublicCms(): { cms: CmsData; pages: CmsPage[] } {
    this.ensureCmsMigrations();
    const published = this.db.cmsPublished;
    const publicPages = published.pages.filter((p) => p.status === 'published' && p.visible);
    return {
      cms: {
        ...published,
        pages: publicPages,
      },
      pages: publicPages,
    };
  }

  getPublicPageBySlug(rawSlug: string): CmsPage | null {
    this.ensureCmsMigrations();
    const slug = normalizePageSlug(rawSlug);
    if (!slug) return null;
    const found = this.db.cmsPublished.pages.find(
      (p) => normalizePageSlug(p.slug) === slug && p.status === 'published' && p.visible
    );
    return found || null;
  }

  getAdminCmsState(): CmsAdminState {
    this.ensureCmsMigrations();
    const hasUnpublishedChanges =
      JSON.stringify(this.db.cmsDraft) !== JSON.stringify(this.db.cmsPublished);
    return {
      draft: this.db.cmsDraft,
      published: this.db.cmsPublished,
      mediaLibrary: this.db.mediaLibrary,
      lastPublishedAt: this.db.cmsLastPublishedAt || null,
      lastDraftSavedAt: this.db.cmsLastDraftSavedAt || null,
      lastPublishedBy: this.db.cmsLastPublishedBy || null,
      hasUnpublishedChanges,
    };
  }

  saveCmsDraft(actorEmail: string, patchOrFull: Partial<CmsData>): CmsAdminState {
    this.ensureCmsMigrations();
    const merged = sanitizeCmsData(
      {
        ...this.db.cmsDraft,
        ...patchOrFull,
        header: patchOrFull.header
          ? { ...this.db.cmsDraft.header, ...patchOrFull.header }
          : this.db.cmsDraft.header,
        footer: patchOrFull.footer
          ? {
              ...this.db.cmsDraft.footer,
              ...patchOrFull.footer,
              socialLinks: {
                ...this.db.cmsDraft.footer.socialLinks,
                ...(patchOrFull.footer.socialLinks || {}),
              },
            }
          : this.db.cmsDraft.footer,
        theme: patchOrFull.theme
          ? { ...this.db.cmsDraft.theme, ...patchOrFull.theme }
          : this.db.cmsDraft.theme,
        seo: patchOrFull.seo
          ? { ...this.db.cmsDraft.seo, ...patchOrFull.seo }
          : this.db.cmsDraft.seo,
      },
      this.db.cmsDraft
    );

    this.db.cmsDraft = merged;
    this.db.cmsLastDraftSavedAt = new Date().toISOString();
    this.recordAudit(actorEmail, 'SAVE_CMS_DRAFT', 'cms_draft', 'Saved website editor draft changes');
    this.persist();
    return this.getAdminCmsState();
  }

  publishCms(actorEmail: string, optionalFullCms?: Partial<CmsData>): CmsAdminState {
    this.ensureCmsMigrations();
    if (optionalFullCms && Object.keys(optionalFullCms).length > 0) {
      this.saveCmsDraft(actorEmail, optionalFullCms);
    }
    const now = new Date().toISOString();
    const snapshot = JSON.parse(JSON.stringify(this.db.cmsDraft)) as CmsData;
    this.db.cmsPublished = snapshot;
    this.db.cmsLastPublishedAt = now;
    this.db.cmsLastPublishedBy = actorEmail;
    this.syncPublishedCmsToStoreSettings(snapshot);
    this.recordAudit(actorEmail, 'PUBLISH_CMS', 'cms_published', 'Published live website changes');
    this.persist();
    return this.getAdminCmsState();
  }

  resetCmsDraftToPublished(actorEmail: string): CmsAdminState {
    this.ensureCmsMigrations();
    this.db.cmsDraft = JSON.parse(JSON.stringify(this.db.cmsPublished)) as CmsData;
    this.db.cmsLastDraftSavedAt = new Date().toISOString();
    this.recordAudit(actorEmail, 'RESET_CMS_DRAFT', 'cms_draft', 'Discarded draft edits and restored published state');
    this.persist();
    return this.getAdminCmsState();
  }

  saveCmsPage(
    actorEmail: string,
    input: Partial<CmsPage> & { publishImmediately?: boolean }
  ): { page: CmsPage; cmsState: CmsAdminState } {
    this.ensureCmsMigrations();
    const now = new Date().toISOString();
    const desiredSlug = normalizePageSlug(input.slug || input.title || '');
    if (!desiredSlug) {
      throw new Error('A valid URL slug (e.g. size-guide or our-story) is required.');
    }
    if (isReservedRouteSlug(desiredSlug)) {
      throw new Error(`Slug "/${desiredSlug}" is reserved for core storefront functionality.`);
    }

    const pages = [...this.db.cmsDraft.pages];
    const existingIdx = input.id ? pages.findIndex((p) => p.id === input.id) : -1;
    const slugConflict = pages.find(
      (p, idx) => normalizePageSlug(p.slug) === desiredSlug && idx !== existingIdx
    );
    if (slugConflict) {
      throw new Error(`Another page already uses the slug "/${desiredSlug}".`);
    }

    let savedPage: CmsPage;
    if (existingIdx !== -1) {
      const prev = pages[existingIdx];
      savedPage = {
        ...prev,
        ...input,
        id: prev.id,
        slug: prev.isSystemPage ? prev.slug : desiredSlug,
        title: String(input.title ?? prev.title).trim(),
        subtitle: String(input.subtitle ?? prev.subtitle),
        eyebrow: String(input.eyebrow ?? prev.eyebrow ?? ''),
        contentHtml: String(input.contentHtml ?? prev.contentHtml),
        heroImageUrl: String(input.heroImageUrl ?? prev.heroImageUrl),
        seoTitle: String(input.seoTitle ?? prev.seoTitle),
        seoDescription: String(input.seoDescription ?? prev.seoDescription),
        status: input.status || prev.status,
        visible: input.visible ?? prev.visible,
        isSystemPage: prev.isSystemPage,
        faqItems: Array.isArray(input.faqItems) ? input.faqItems : prev.faqItems,
        updatedAt: now,
      };
      pages[existingIdx] = savedPage;
    } else {
      savedPage = {
        id: `page-${crypto.randomUUID().slice(0, 8)}`,
        slug: desiredSlug,
        title: String(input.title || 'New Page').trim(),
        subtitle: String(input.subtitle || ''),
        eyebrow: String(input.eyebrow || ''),
        contentHtml: String(input.contentHtml || '<p>Edit this page content in the Website Editor.</p>'),
        heroImageUrl: String(input.heroImageUrl || ''),
        seoTitle: String(input.seoTitle || input.title || ''),
        seoDescription: String(input.seoDescription || input.subtitle || ''),
        status: input.status || 'draft',
        visible: input.visible ?? true,
        isSystemPage: false,
        faqItems: Array.isArray(input.faqItems) ? input.faqItems : [],
        createdAt: now,
        updatedAt: now,
      };
      pages.push(savedPage);
    }

    this.db.cmsDraft = { ...this.db.cmsDraft, pages };
    this.db.cmsLastDraftSavedAt = now;

    if (input.publishImmediately) {
      const pubPages = [...this.db.cmsPublished.pages];
      const pubIdx = pubPages.findIndex((p) => p.id === savedPage.id);
      const publishedCopy: CmsPage = { ...savedPage, status: 'published' };
      pages[pages.findIndex((p) => p.id === savedPage.id)] = publishedCopy;
      if (pubIdx !== -1) {
        pubPages[pubIdx] = publishedCopy;
      } else {
        pubPages.push(publishedCopy);
      }
      this.db.cmsDraft = { ...this.db.cmsDraft, pages };
      this.db.cmsPublished = { ...this.db.cmsPublished, pages: pubPages };
      this.db.cmsLastPublishedAt = now;
      this.db.cmsLastPublishedBy = actorEmail;
      savedPage = publishedCopy;
    }

    this.recordAudit(actorEmail, 'SAVE_CMS_PAGE', `page:${savedPage.id}`, `/${savedPage.slug} (${savedPage.status})`);
    this.persist();
    return { page: savedPage, cmsState: this.getAdminCmsState() };
  }

  deleteCmsPage(actorEmail: string, pageId: string): CmsAdminState {
    this.ensureCmsMigrations();
    const target = this.db.cmsDraft.pages.find((p) => p.id === pageId);
    if (!target) throw new Error('Page not found.');
    if (target.isSystemPage) {
      throw new Error('Core system pages cannot be deleted, but you can hide or edit them.');
    }
    this.db.cmsDraft.pages = this.db.cmsDraft.pages.filter((p) => p.id !== pageId);
    this.db.cmsPublished.pages = this.db.cmsPublished.pages.filter((p) => p.id !== pageId);
    this.db.cmsLastDraftSavedAt = new Date().toISOString();
    this.recordAudit(actorEmail, 'DELETE_CMS_PAGE', `page:${pageId}`, `Deleted page /${target.slug}`);
    this.persist();
    return this.getAdminCmsState();
  }

  listMediaAssets(): MediaAsset[] {
    this.ensureCmsMigrations();
    return this.db.mediaLibrary;
  }

  addMediaAsset(
    actorEmail: string,
    input: { name: string; url: string; folder?: MediaFolder; mimeType?: string; sizeBytes?: number }
  ): { asset: MediaAsset; mediaLibrary: MediaAsset[] } {
    this.ensureCmsMigrations();
    const asset: MediaAsset = {
      id: `media-${crypto.randomUUID().slice(0, 8)}`,
      name: String(input.name || 'Uploaded Image').trim(),
      url: String(input.url).trim(),
      folder: input.folder || 'general',
      mimeType: input.mimeType || 'image/jpeg',
      sizeBytes: input.sizeBytes,
      isSystemAsset: false,
      createdAt: new Date().toISOString(),
    };
    this.db.mediaLibrary.unshift(asset);
    this.recordAudit(actorEmail, 'ADD_MEDIA_ASSET', `media:${asset.id}`, asset.name);
    this.persist();
    return { asset, mediaLibrary: this.db.mediaLibrary };
  }

  updateMediaAsset(
    actorEmail: string,
    id: string,
    patch: Partial<Pick<MediaAsset, 'name' | 'folder' | 'url' | 'mimeType' | 'sizeBytes'>>
  ): { asset: MediaAsset; mediaLibrary: MediaAsset[] } {
    this.ensureCmsMigrations();
    const idx = this.db.mediaLibrary.findIndex((m) => m.id === id);
    if (idx === -1) throw new Error('Media asset not found.');
    const updated: MediaAsset = {
      ...this.db.mediaLibrary[idx],
      ...patch,
      name: patch.name !== undefined ? String(patch.name).trim() : this.db.mediaLibrary[idx].name,
    };
    this.db.mediaLibrary[idx] = updated;
    this.recordAudit(actorEmail, 'UPDATE_MEDIA_ASSET', `media:${id}`, updated.name);
    this.persist();
    return { asset: updated, mediaLibrary: this.db.mediaLibrary };
  }

  deleteMediaAsset(actorEmail: string, id: string): MediaAsset[] {
    this.ensureCmsMigrations();
    const target = this.db.mediaLibrary.find((m) => m.id === id);
    if (!target) throw new Error('Media asset not found.');
    if (target.isSystemAsset) {
      throw new Error('Built-in starter assets cannot be deleted, though you can upload replacements.');
    }
    if (target.url.startsWith('/uploads/cms/')) {
      const safeFilename = path.basename(target.url);
      const fullPath = path.resolve(process.cwd(), 'uploads', 'cms', safeFilename);
      if (fs.existsSync(fullPath)) {
        try {
          fs.unlinkSync(fullPath);
        } catch {
          // ignore filesystem unlink errors
        }
      }
    }
    this.db.mediaLibrary = this.db.mediaLibrary.filter((m) => m.id !== id);
    this.recordAudit(actorEmail, 'DELETE_MEDIA_ASSET', `media:${id}`, target.name);
    this.persist();
    return this.db.mediaLibrary;
  }

  getCustomers(): CustomerRecord[] {
    return this.db.customers;
  }

  getNotifications(): StoreNotification[] {
    return this.db.notifications;
  }

  markNotificationsRead(id?: string): StoreNotification[] {
    this.db.notifications = this.db.notifications.map((n) =>
      !id || n.id === id ? { ...n, read: true } : n
    );
    this.persist();
    return this.db.notifications;
  }

  getAuditLogs(): AuditLogEntry[] {
    return this.db.auditLogs;
  }

  subscribeNewsletter(email: string): { subscribed: boolean } {
    const clean = email.trim().toLowerCase();
    if (!this.db.newsletterSubscribers.some((s) => s.email === clean)) {
      this.db.newsletterSubscribers.push({ email: clean, subscribedAt: new Date().toISOString() });
      this.persist();
    }
    return { subscribed: true };
  }

  getAnalytics(): AdminAnalytics {
    const orders = this.db.orders;
    const paidOrders = orders.filter((o) => o.paymentStatus === 'paid');

    const now = new Date();
    const todayPrefix = now.toISOString().slice(0, 10);
    const monthPrefix = now.toISOString().slice(0, 7);

    const totalRevenue = paidOrders.reduce((acc, o) => acc + o.total, 0);
    const todayRevenue = paidOrders
      .filter((o) => o.createdAt.startsWith(todayPrefix))
      .reduce((acc, o) => acc + o.total, 0);
    const monthRevenue = paidOrders
      .filter((o) => o.createdAt.startsWith(monthPrefix))
      .reduce((acc, o) => acc + o.total, 0);

    const revenueMap = new Map<string, { revenue: number; orders: number }>();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      revenueMap.set(key, { revenue: 0, orders: 0 });
    }
    for (const o of orders) {
      const key = o.createdAt.slice(0, 10);
      if (revenueMap.has(key)) {
        const entry = revenueMap.get(key)!;
        entry.orders += 1;
        if (o.paymentStatus === 'paid') {
          entry.revenue += o.total;
        }
      }
    }

    const productStats = new Map<string, { id: string; name: string; salesCount: number; revenue: number }>();
    for (const o of paidOrders) {
      for (const item of o.items) {
        const existing = productStats.get(item.productId) || {
          id: item.productId,
          name: item.name,
          salesCount: 0,
          revenue: 0,
        };
        existing.salesCount += item.quantity;
        existing.revenue += item.total;
        productStats.set(item.productId, existing);
      }
    }

    const categoryMap = new Map<string, { category: string; revenue: number; orders: number }>();
    for (const o of paidOrders) {
      for (const item of o.items) {
        const prod = this.db.products.find((p) => p.id === item.productId);
        const catName = prod?.categoryName || 'General';
        const existing = categoryMap.get(catName) || { category: catName, revenue: 0, orders: 0 };
        existing.revenue += item.total;
        existing.orders += item.quantity;
        categoryMap.set(catName, existing);
      }
    }

    const methodMap = new Map<string, { method: string; label: string; count: number; revenue: number }>();
    for (const o of orders) {
      const existing = methodMap.get(o.paymentMethod) || {
        method: o.paymentMethod,
        label: o.paymentMethodTitle,
        count: 0,
        revenue: 0,
      };
      existing.count += 1;
      if (o.paymentStatus === 'paid') {
        existing.revenue += o.total;
      }
      methodMap.set(o.paymentMethod, existing);
    }

    return {
      totalRevenue,
      todayRevenue,
      monthRevenue,
      totalOrders: orders.length,
      pendingOrders: orders.filter((o) => o.status === 'pending' || o.status === 'on-hold').length,
      processingOrders: orders.filter((o) => o.status === 'processing').length,
      completedOrders: orders.filter((o) => o.status === 'completed').length,
      cancelledOrders: orders.filter((o) => o.status === 'cancelled' || o.status === 'failed').length,
      totalProducts: this.db.products.length,
      totalCustomers: this.db.customers.length,
      lowStockProducts: this.db.products.filter(
        (p) => p.manageStock && p.stockQuantity <= p.lowStockThreshold
      ).length,
      revenueSeries: Array.from(revenueMap.entries()).map(([date, val]) => ({
        date,
        revenue: val.revenue,
        orders: val.orders,
      })),
      bestSellingProducts: Array.from(productStats.values())
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5),
      salesByCategory: Array.from(categoryMap.values()).sort((a, b) => b.revenue - a.revenue),
      paymentMethodUsage: Array.from(methodMap.values()),
    };
  }

  private checkStockNotification(product: Product): void {
    if (!product.manageStock) return;
    if (product.stockQuantity === 0) {
      this.pushNotification({
        type: 'out_of_stock',
        title: `Out of Stock: ${product.name}`,
        message: `SKU ${product.sku} has reached 0 units.`,
        productId: product.id,
      });
    } else if (product.stockQuantity <= product.lowStockThreshold) {
      this.pushNotification({
        type: 'low_stock',
        title: `Low Stock Alert: ${product.name}`,
        message: `Only ${product.stockQuantity} units remaining (threshold ${product.lowStockThreshold}).`,
        productId: product.id,
      });
    }
  }

  private pushNotification(input: Omit<StoreNotification, 'id' | 'read' | 'createdAt'>): void {
    this.db.notifications.unshift({
      ...input,
      id: `notif-${crypto.randomUUID().slice(0, 8)}`,
      read: false,
      createdAt: new Date().toISOString(),
    });
    this.db.notifications = this.db.notifications.slice(0, 100);
  }

  private recordAudit(actorEmail: string, action: string, resource: string, details: string): void {
    this.db.auditLogs.unshift({
      id: `audit-${crypto.randomUUID().slice(0, 8)}`,
      actorEmail,
      action,
      resource,
      details,
      createdAt: new Date().toISOString(),
    });
    this.db.auditLogs = this.db.auditLogs.slice(0, 200);
  }
}

export const storeEngine = new StoreEngine();
