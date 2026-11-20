import type {
  Category,
  Coupon,
  Order,
  Product,
  ProductReturnPolicy,
  ProductReview,
  ShippingZone,
} from '../src/types/commerce.ts';

export interface WooCredentials {
  url: string;
  consumerKey: string;
  consumerSecret: string;
  bridgeSecret?: string;
}

interface WcProductRaw {
  id: number;
  name: string;
  slug: string;
  sku: string;
  type: string;
  status: string;
  featured: boolean;
  description: string;
  short_description: string;
  price: string;
  regular_price: string;
  sale_price: string;
  manage_stock: boolean;
  stock_quantity: number | null;
  low_stock_amount?: number | null;
  stock_status: string;
  total_sales: number;
  average_rating: string;
  rating_count: number;
  weight?: string;
  dimensions?: { length?: string; width?: string; height?: string };
  categories: { id: number; name: string; slug: string }[];
  tags: { id: number; name: string; slug: string }[];
  images: { id: number; src: string; alt: string }[];
  attributes: { id: number; name: string; options: string[] }[];
  meta_data?: { key: string; value: unknown }[];
  date_created: string;
  date_modified: string;
}

interface WcCategoryRaw {
  id: number;
  name: string;
  slug: string;
  description: string;
  parent: number;
  count: number;
  menu_order?: number;
  image?: { src: string } | null;
}

interface WcOrderRaw {
  id: number;
  number: string;
  status: string;
  currency: string;
  total: string;
  discount_total: string;
  shipping_total: string;
  payment_method: string;
  payment_method_title: string;
  transaction_id: string;
  date_created: string;
  date_modified: string;
  date_paid?: string | null;
  customer_id: number;
  customer_note?: string;
  billing: {
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    address_1: string;
    city: string;
    state: string;
    country: string;
  };
  line_items: {
    id: number;
    product_id: number;
    variation_id: number;
    name: string;
    sku: string;
    quantity: number;
    price: number;
    total: string;
    image?: { src: string };
  }[];
  meta_data?: { key: string; value: unknown }[];
}

export class WooCommerceClient {
  private creds: WooCredentials;

  constructor(creds: WooCredentials) {
    this.creds = {
      ...creds,
      url: creds.url.replace(/\/+$/, ''),
    };
  }

  private getAuthHeader(): string {
    const token = Buffer.from(`${this.creds.consumerKey}:${this.creds.consumerSecret}`).toString('base64');
    return `Basic ${token}`;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.creds.url}/wp-json/wc/v3${endpoint}`;
    const headers: Record<string, string> = {
      Authorization: this.getAuthHeader(),
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> | undefined),
    };

    const res = await fetch(url, {
      ...options,
      headers,
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new Error(`WooCommerce API error (${res.status}): ${text.slice(0, 300)}`);
    }

    return (await res.json()) as T;
  }

  private async bridgeRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.creds.url}/wp-json/diamond/v1${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(this.creds.bridgeSecret
        ? {
            'X-Diamond-Bridge-Secret': this.creds.bridgeSecret,
            'X-Zora-Bridge-Secret': this.creds.bridgeSecret,
          }
        : {}),
      ...(options.headers as Record<string, string> | undefined),
    };

    const res = await fetch(url, {
      ...options,
      headers,
      signal: AbortSignal.timeout(12000),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new Error(`WordPress Bridge error (${res.status}): ${text.slice(0, 300)}`);
    }

    return (await res.json()) as T;
  }

  async testConnection(): Promise<{ ok: boolean; storeVersion?: string; error?: string }> {
    try {
      const status = await this.request<{ environment?: { version?: string } }>('/system_status');
      return { ok: true, storeVersion: status.environment?.version || 'WooCommerce Connected' };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async syncFirebaseCustomer(payload: {
    uid: string;
    email: string;
    displayName: string;
    phone?: string;
  }): Promise<{ wooCustomerId?: number }> {
    try {
      return await this.bridgeRequest<{ wooCustomerId: number }>('/auth/sync-customer', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    } catch {
      const existing = await this.request<{ id: number }[]>(
        `/customers?email=${encodeURIComponent(payload.email)}`
      );
      if (existing.length > 0) {
        return { wooCustomerId: existing[0].id };
      }
      const parts = payload.displayName.trim().split(/\s+/);
      const created = await this.request<{ id: number }>('/customers', {
        method: 'POST',
        body: JSON.stringify({
          email: payload.email,
          first_name: parts[0] || 'Customer',
          last_name: parts.slice(1).join(' ') || '',
          username: payload.email.split('@')[0] + '_' + payload.uid.slice(0, 6),
          billing: {
            email: payload.email,
            phone: payload.phone || '',
            country: 'NG',
          },
        }),
      });
      return { wooCustomerId: created.id };
    }
  }

  async getProducts(): Promise<Product[]> {
    const raw = await this.request<WcProductRaw[]>('/products?per_page=100&status=any');
    return raw.map((p) => this.mapProduct(p));
  }

  private buildProductMeta(input: Partial<Product>): { key: string; value: string }[] {
    const meta: { key: string; value: string }[] = [];
    if (input.returnPolicy !== undefined) {
      meta.push({
        key: '_diamond_return_policy',
        value: input.returnPolicy ? JSON.stringify(input.returnPolicy) : '',
      });
    }
    if (input.brand !== undefined) meta.push({ key: '_diamond_brand', value: input.brand });
    if (input.material !== undefined) meta.push({ key: '_diamond_material', value: input.material });
    if (input.careInstructions !== undefined) {
      meta.push({ key: '_diamond_care', value: input.careInstructions });
    }
    if (input.seoTitle !== undefined) meta.push({ key: '_diamond_seo_title', value: input.seoTitle });
    if (input.seoDescription !== undefined) {
      meta.push({ key: '_diamond_seo_description', value: input.seoDescription });
    }
    return meta;
  }

  async createProduct(input: Partial<Product>): Promise<Product> {
    const categoriesPayload: { id: number }[] = [];
    if (input.categoryId && !Number.isNaN(Number(input.categoryId))) {
      categoriesPayload.push({ id: Number(input.categoryId) });
    }
    if (input.subcategoryId && !Number.isNaN(Number(input.subcategoryId))) {
      categoriesPayload.push({ id: Number(input.subcategoryId) });
    }

    const body = {
      name: input.name,
      slug: input.slug,
      type: input.type || 'simple',
      regular_price: String(input.price || 0),
      sale_price: input.salePrice ? String(input.salePrice) : '',
      description: input.description || '',
      short_description: input.shortDescription || '',
      sku: input.sku || '',
      manage_stock: input.manageStock ?? true,
      stock_quantity: input.stockQuantity ?? 0,
      low_stock_amount: input.lowStockThreshold ?? 5,
      status: input.status === 'archived' ? 'draft' : input.status || 'publish',
      featured: Boolean(input.featured),
      weight: input.weightKg ? String(input.weightKg) : '',
      categories: categoriesPayload,
      images: (input.images || []).filter((u) => u.startsWith('http')).map((src) => ({ src })),
      meta_data: this.buildProductMeta(input),
    };

    const created = await this.request<WcProductRaw>('/products', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return this.mapProduct(created);
  }

  async updateProduct(id: string, input: Partial<Product>): Promise<Product> {
    const body: Record<string, unknown> = {};
    if (input.name !== undefined) body.name = input.name;
    if (input.slug !== undefined) body.slug = input.slug;
    if (input.price !== undefined) body.regular_price = String(input.price);
    if (input.salePrice !== undefined) body.sale_price = input.salePrice ? String(input.salePrice) : '';
    if (input.description !== undefined) body.description = input.description;
    if (input.shortDescription !== undefined) body.short_description = input.shortDescription;
    if (input.sku !== undefined) body.sku = input.sku;
    if (input.manageStock !== undefined) body.manage_stock = input.manageStock;
    if (input.stockQuantity !== undefined) body.stock_quantity = input.stockQuantity;
    if (input.lowStockThreshold !== undefined) body.low_stock_amount = input.lowStockThreshold;
    if (input.featured !== undefined) body.featured = input.featured;
    if (input.status !== undefined) body.status = input.status === 'archived' ? 'draft' : input.status;
    if (input.weightKg !== undefined) body.weight = String(input.weightKg);

    const metaData = this.buildProductMeta(input);
    if (metaData.length > 0) {
      body.meta_data = metaData;
    }

    const updated = await this.request<WcProductRaw>(`/products/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
    return this.mapProduct(updated);
  }

  async deleteProduct(id: string): Promise<void> {
    await this.request(`/products/${encodeURIComponent(id)}?force=true`, { method: 'DELETE' });
  }

  async getCategories(): Promise<Category[]> {
    const raw = await this.request<WcCategoryRaw[]>('/products/categories?per_page=100');
    return raw
      .filter((c) => c.slug !== 'uncategorized')
      .map((c, idx) => ({
        id: String(c.id),
        name: c.name,
        slug: c.slug,
        description: c.description || '',
        parentId: c.parent ? String(c.parent) : null,
        image: c.image?.src,
        productCount: c.count,
        featured: c.count > 0,
        visible: true,
        sortOrder: c.menu_order ?? idx + 1,
      }));
  }

  async createCategory(input: {
    name: string;
    slug?: string;
    description?: string;
    parentId?: string | null;
    image?: string;
  }): Promise<Category> {
    const raw = await this.request<WcCategoryRaw>('/products/categories', {
      method: 'POST',
      body: JSON.stringify({
        name: input.name,
        ...(input.slug ? { slug: input.slug } : {}),
        description: input.description || '',
        parent: input.parentId ? Number(input.parentId) : 0,
        ...(input.image && input.image.startsWith('http') ? { image: { src: input.image } } : {}),
      }),
    });
    return {
      id: String(raw.id),
      name: raw.name,
      slug: raw.slug,
      description: raw.description || '',
      parentId: raw.parent ? String(raw.parent) : null,
      image: raw.image?.src || input.image,
      productCount: raw.count,
      featured: true,
      visible: true,
    };
  }

  async updateCategory(
    id: string,
    input: Partial<Pick<Category, 'name' | 'slug' | 'description' | 'parentId' | 'image'>>
  ): Promise<Category> {
    const body: Record<string, unknown> = {};
    if (input.name !== undefined) body.name = input.name;
    if (input.slug !== undefined) body.slug = input.slug;
    if (input.description !== undefined) body.description = input.description;
    if (input.parentId !== undefined) body.parent = input.parentId ? Number(input.parentId) : 0;
    if (input.image && input.image.startsWith('http')) body.image = { src: input.image };

    const raw = await this.request<WcCategoryRaw>(`/products/categories/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
    return {
      id: String(raw.id),
      name: raw.name,
      slug: raw.slug,
      description: raw.description || '',
      parentId: raw.parent ? String(raw.parent) : null,
      image: raw.image?.src || input.image,
      productCount: raw.count,
      featured: true,
      visible: true,
    };
  }

  async deleteCategory(id: string): Promise<void> {
    await this.request(`/products/categories/${encodeURIComponent(id)}?force=true`, {
      method: 'DELETE',
    });
  }

  async getOrders(): Promise<Order[]> {
    const raw = await this.request<WcOrderRaw[]>('/orders?per_page=100');
    return raw.map((o) => this.mapOrder(o));
  }

  async createOrder(order: Order): Promise<Order> {
    const raw = await this.request<WcOrderRaw>('/orders', {
      method: 'POST',
      body: JSON.stringify({
        payment_method: order.paymentMethod,
        payment_method_title: order.paymentMethodTitle,
        set_paid: order.paymentStatus === 'paid',
        status: order.status,
        customer_note: order.deliveryInstructions || '',
        billing: {
          first_name: order.billing.firstName,
          last_name: order.billing.lastName,
          address_1: order.billing.street,
          city: order.billing.city,
          state: order.billing.state,
          country: 'NG',
          email: order.billing.email,
          phone: order.billing.phone,
        },
        shipping: {
          first_name: order.billing.firstName,
          last_name: order.billing.lastName,
          address_1: order.billing.street,
          city: order.billing.city,
          state: order.billing.state,
          country: 'NG',
        },
        line_items: order.items.map((item) => ({
          product_id: Number(item.productId),
          variation_id: item.variationId ? Number(item.variationId) : 0,
          quantity: item.quantity,
        })),
        shipping_lines: [
          {
            method_id: 'flat_rate',
            method_title: order.shippingZoneName,
            total: String(order.shippingTotal),
          },
        ],
        coupon_lines: order.couponCode ? [{ code: order.couponCode }] : [],
        meta_data: [
          { key: '_diamond_payment_reference', value: order.paymentReference },
          { key: '_diamond_firebase_uid', value: order.customerUid || '' },
        ],
      }),
    });
    return { ...order, wooOrderId: raw.id, orderNumber: raw.number || order.orderNumber };
  }

  async updateOrderStatus(wooOrderId: number, status: string, setPaid?: boolean): Promise<void> {
    const body: Record<string, unknown> = { status };
    if (typeof setPaid === 'boolean') {
      body.set_paid = setPaid;
    }
    await this.request(`/orders/${wooOrderId}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  async updateOrderDelivery(
    wooOrderId: number,
    delivery: {
      courier?: string;
      trackingNumber?: string;
      status: string;
      notes?: string;
      riderName?: string;
      riderCode?: string;
      estimatedDeliveryDate?: string;
      customerConfirmed?: boolean;
    }
  ): Promise<void> {
    if (this.creds.bridgeSecret) {
      await this.bridgeRequest(`/orders/${wooOrderId}/delivery`, {
        method: 'PUT',
        body: JSON.stringify({
          courier: delivery.courier || '',
          trackingNumber: delivery.trackingNumber || '',
          deliveryStatus: delivery.status,
          notes: delivery.notes || '',
          riderName: delivery.riderName || '',
          riderCode: delivery.riderCode || '',
          estimatedDeliveryDate: delivery.estimatedDeliveryDate || '',
          customerConfirmed: delivery.customerConfirmed ? 'yes' : 'no',
        }),
      }).catch(() => {});
    }

    await this.request(`/orders/${wooOrderId}`, {
      method: 'PUT',
      body: JSON.stringify({
        meta_data: [
          { key: '_diamond_courier', value: delivery.courier || '' },
          { key: '_diamond_tracking_number', value: delivery.trackingNumber || '' },
          { key: '_diamond_delivery_status', value: delivery.status },
          { key: '_diamond_delivery_notes', value: delivery.notes || '' },
          { key: '_diamond_rider_name', value: delivery.riderName || '' },
          { key: '_diamond_rider_code', value: delivery.riderCode || '' },
          { key: '_diamond_estimated_delivery', value: delivery.estimatedDeliveryDate || '' },
          { key: '_diamond_customer_confirmed', value: delivery.customerConfirmed ? 'yes' : 'no' },
        ],
      }),
    });
  }

  async updatePaymentGateway(
    gatewayId: string,
    enabled: boolean,
    settings?: Record<string, string>
  ): Promise<void> {
    await this.request(`/payment_gateways/${encodeURIComponent(gatewayId)}`, {
      method: 'PUT',
      body: JSON.stringify({
        enabled,
        ...(settings ? { settings } : {}),
      }),
    });
  }

  async getCoupons(): Promise<Coupon[]> {
    const raw = await this.request<
      {
        id: number;
        code: string;
        discount_type: 'percent' | 'fixed_cart' | 'fixed_product';
        amount: string;
        description: string;
        minimum_amount: string;
        maximum_amount: string;
        usage_limit: number | null;
        usage_count: number;
        date_expires: string | null;
      }[]
    >('/coupons?per_page=100');

    return raw.map((c) => ({
      id: String(c.id),
      code: c.code.toUpperCase(),
      type: c.discount_type,
      amount: Number(c.amount || 0),
      description: c.description || '',
      minSpend: Number(c.minimum_amount || 0),
      maxSpend: c.maximum_amount ? Number(c.maximum_amount) : null,
      usageLimit: c.usage_limit,
      usageCount: c.usage_count || 0,
      expiryDate: c.date_expires,
      active: true,
    }));
  }

  async getReviews(): Promise<ProductReview[]> {
    const raw = await this.request<
      {
        id: number;
        product_id: number;
        product_name?: string;
        reviewer: string;
        reviewer_email: string;
        rating: number;
        review: string;
        verified: boolean;
        status: 'approved' | 'hold' | 'spam' | 'trash';
        date_created: string;
      }[]
    >('/products/reviews?per_page=100');

    return raw.map((r) => ({
      id: String(r.id),
      productId: String(r.product_id),
      productName: r.product_name,
      reviewerName: r.reviewer,
      reviewerEmail: r.reviewer_email,
      rating: r.rating,
      comment: r.review.replace(/<[^>]+>/g, ''),
      verifiedPurchase: r.verified,
      status: r.status === 'approved' ? 'approved' : r.status === 'hold' ? 'hold' : 'rejected',
      createdAt: r.date_created,
    }));
  }

  async getShippingZones(): Promise<ShippingZone[]> {
    const zones = await this.request<{ id: number; name: string }[]>('/shipping/zones');
    return zones.map((z) => ({
      id: String(z.id),
      name: z.name,
      states: ['ALL'],
      flatRate: 3500,
      freeShippingMinOrder: null,
      pickupAvailable: false,
      estimatedDays: '2-5 business days',
      enabled: true,
    }));
  }

  private mapProduct(p: WcProductRaw): Product {
    const regular = Number(p.regular_price || p.price || 0);
    const sale = p.sale_price ? Number(p.sale_price) : null;
    const primaryCat = p.categories[0];
    const subCat = p.categories[1];
    const meta = new Map((p.meta_data || []).map((m) => [m.key, m.value]));

    let returnPolicy: ProductReturnPolicy | null = null;
    const rawPolicy = meta.get('_diamond_return_policy');
    if (typeof rawPolicy === 'string' && rawPolicy.trim().startsWith('{')) {
      try {
        returnPolicy = JSON.parse(rawPolicy) as ProductReturnPolicy;
      } catch {
        returnPolicy = null;
      }
    }

    return {
      id: String(p.id),
      slug: p.slug,
      name: p.name,
      sku: p.sku || `DM-${p.id}`,
      shortDescription: (p.short_description || '').replace(/<[^>]+>/g, ''),
      description: p.description || '',
      price: regular,
      salePrice: sale,
      categoryId: primaryCat ? String(primaryCat.id) : '0',
      categoryName: primaryCat ? primaryCat.name : 'Uncategorized',
      categorySlug: primaryCat ? primaryCat.slug : 'uncategorized',
      subcategoryId: subCat ? String(subCat.id) : null,
      subcategoryName: subCat ? subCat.name : undefined,
      brand: meta.get('_diamond_brand') ? String(meta.get('_diamond_brand')) : undefined,
      material: meta.get('_diamond_material') ? String(meta.get('_diamond_material')) : undefined,
      careInstructions: meta.get('_diamond_care') ? String(meta.get('_diamond_care')) : undefined,
      seoTitle: meta.get('_diamond_seo_title') ? String(meta.get('_diamond_seo_title')) : undefined,
      seoDescription: meta.get('_diamond_seo_description')
        ? String(meta.get('_diamond_seo_description'))
        : undefined,
      returnPolicy,
      tags: (p.tags || []).map((t) => t.name),
      images: (p.images || []).map((img) => img.src),
      stockQuantity: p.stock_quantity ?? (p.stock_status === 'instock' ? 20 : 0),
      manageStock: p.manage_stock,
      lowStockThreshold: p.low_stock_amount ?? 5,
      inStock: p.stock_status === 'instock',
      status: p.status === 'publish' ? 'publish' : 'draft',
      featured: p.featured,
      salesCount: p.total_sales || 0,
      averageRating: Number(p.average_rating || 0),
      reviewCount: p.rating_count || 0,
      weightKg: p.weight ? Number(p.weight) : undefined,
      specifications: (p.attributes || []).map((a) => ({
        label: a.name,
        value: a.options.join(', '),
      })),
      type: p.type === 'variable' ? 'variable' : 'simple',
      variations: [],
      codAllowed: true,
      createdAt: p.date_created,
      updatedAt: p.date_modified,
    };
  }

  private mapOrder(o: WcOrderRaw): Order {
    const subtotal = o.line_items.reduce((acc, item) => acc + Number(item.total || 0), 0);
    const meta = new Map((o.meta_data || []).map((m) => [m.key, String(m.value || '')]));
    const method = (['paystack', 'flutterwave', 'bacs', 'cod'].includes(o.payment_method)
      ? o.payment_method
      : 'bacs') as Order['paymentMethod'];

    return {
      id: String(o.id),
      wooOrderId: o.id,
      orderNumber: `DM-${o.number || o.id}`,
      customerId: o.customer_id ? String(o.customer_id) : undefined,
      customerEmail: o.billing.email,
      customerUid: meta.get('_diamond_firebase_uid') || meta.get('_zora_firebase_uid') || null,
      billing: {
        firstName: o.billing.first_name,
        lastName: o.billing.last_name,
        email: o.billing.email,
        phone: o.billing.phone,
        street: o.billing.address_1,
        city: o.billing.city,
        state: o.billing.state,
        country: o.billing.country || 'NG',
      },
      deliveryInstructions: o.customer_note || '',
      items: o.line_items.map((item) => ({
        productId: String(item.product_id),
        variationId: item.variation_id ? String(item.variation_id) : undefined,
        name: item.name,
        sku: item.sku || '',
        image: item.image?.src || '',
        quantity: item.quantity,
        unitPrice: Number(item.price || 0),
        total: Number(item.total || 0),
      })),
      subtotal,
      discountTotal: Number(o.discount_total || 0),
      shippingTotal: Number(o.shipping_total || 0),
      shippingZoneName: 'WooCommerce Shipping',
      codFee: 0,
      total: Number(o.total || 0),
      currency: 'NGN',
      paymentMethod: method,
      paymentMethodTitle: o.payment_method_title || method.toUpperCase(),
      paymentStatus: o.date_paid ? 'paid' : method === 'bacs' ? 'awaiting_verification' : 'unpaid',
      paymentReference:
        meta.get('_diamond_payment_reference') ||
        meta.get('_zora_payment_reference') ||
        o.transaction_id ||
        `WC-${o.id}`,
      gatewayTransactionId: o.transaction_id || undefined,
      status: (o.status as Order['status']) || 'pending',
      delivery: {
        status:
          (meta.get('_diamond_delivery_status') as Order['delivery']['status']) ||
          (meta.get('_zora_delivery_status') as Order['delivery']['status']) ||
          'pending_delivery',
        courier: meta.get('_diamond_courier') || meta.get('_zora_courier') || '',
        trackingNumber: meta.get('_diamond_tracking_number') || meta.get('_zora_tracking_number') || '',
        riderName: meta.get('_diamond_rider_name') || '',
        riderCode: meta.get('_diamond_rider_code') || '',
        estimatedDeliveryDate: meta.get('_diamond_estimated_delivery') || '',
        customerConfirmed: meta.get('_diamond_customer_confirmed') === 'yes',
        notes: meta.get('_diamond_delivery_notes') || meta.get('_zora_delivery_notes') || '',
      },
      notes: [],
      createdAt: o.date_created,
      updatedAt: o.date_modified,
    };
  }
}
