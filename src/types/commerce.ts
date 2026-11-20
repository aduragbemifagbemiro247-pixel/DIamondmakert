export type OrderStatus =
  | 'pending'
  | 'processing'
  | 'on-hold'
  | 'completed'
  | 'cancelled'
  | 'failed'
  | 'refunded';

export type PaymentStatus = 'unpaid' | 'awaiting_verification' | 'paid' | 'failed' | 'refunded';

export type PaymentMethodId = 'paystack' | 'flutterwave' | 'bacs' | 'cod';

export type DeliveryStatus =
  | 'pending_delivery'
  | 'preparing_order'
  | 'ready_for_pickup'
  | 'rider_assigned'
  | 'picked_up'
  | 'out_for_delivery'
  | 'arrived_at_destination'
  | 'awaiting_customer_confirmation'
  | 'delivered_customer_confirmed'
  | 'delivery_failed'
  | 'delivery_disputed'
  | 'returned_to_store'
  | 'cancelled';

export type DeliveryType = 'local' | 'interstate' | 'nationwide' | 'pickup';

export type RiderStatus = 'active' | 'inactive' | 'suspended';

export type VehicleType = 'motorcycle' | 'van' | 'car' | 'bicycle' | 'dispatch_partner';

export type ComplaintCategory =
  | 'order_not_received'
  | 'wrong_item'
  | 'missing_item'
  | 'damaged_item'
  | 'rider_misconduct'
  | 'delivery_delay'
  | 'other';

export type ComplaintStatus =
  | 'open'
  | 'under_investigation'
  | 'awaiting_customer'
  | 'resolved'
  | 'closed';

export interface ProductVariation {
  id: string;
  sku: string;
  attributes: Record<string, string>;
  price: number;
  salePrice?: number | null;
  stockQuantity: number;
  inStock: boolean;
}

export interface ProductSpecification {
  label: string;
  value: string;
}

export interface ProductReturnPolicy {
  enabled: boolean;
  returnWindowDays?: number;
  eligibleConditions?: string;
  nonReturnableConditions?: string;
  exchangeRules?: string;
  refundConditions?: string;
  returnShippingPayer?: 'customer' | 'store' | 'depends' | '';
  formattedText?: string;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  sku: string;
  shortDescription: string;
  description: string;
  price: number;
  salePrice?: number | null;
  saleStartDate?: string | null;
  saleEndDate?: string | null;
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  subcategoryId?: string | null;
  subcategoryName?: string;
  brand?: string;
  material?: string;
  careInstructions?: string;
  sizeGuide?: string;
  tags: string[];
  images: string[];
  stockQuantity: number;
  manageStock: boolean;
  lowStockThreshold: number;
  inStock: boolean;
  status: 'publish' | 'draft' | 'archived';
  featured: boolean;
  isNewArrival?: boolean;
  isBestSeller?: boolean;
  salesCount: number;
  averageRating: number;
  reviewCount: number;
  weightKg?: number;
  dimensions?: string;
  specifications: ProductSpecification[];
  type: 'simple' | 'variable';
  variations: ProductVariation[];
  codAllowed: boolean;
  seoTitle?: string;
  seoDescription?: string;
  returnPolicy?: ProductReturnPolicy | null;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  parentId?: string | null;
  image?: string;
  bannerImage?: string;
  productCount?: number;
  featured: boolean;
  visible?: boolean;
  sortOrder?: number;
  createdAt?: string;
}

export interface CartItem {
  key: string;
  productId: string;
  variationId?: string;
  name: string;
  slug: string;
  sku: string;
  image: string;
  unitPrice: number;
  quantity: number;
  attributes?: Record<string, string>;
  maxStock: number;
  codAllowed: boolean;
}

export interface Coupon {
  id: string;
  code: string;
  type: 'percent' | 'fixed_cart' | 'fixed_product';
  amount: number;
  description: string;
  minSpend: number;
  maxSpend?: number | null;
  usageLimit?: number | null;
  usageCount: number;
  expiryDate?: string | null;
  categoryIds?: string[];
  productIds?: string[];
  active: boolean;
}

export interface ProductReview {
  id: string;
  productId: string;
  productName?: string;
  orderId?: string;
  orderNumber?: string;
  reviewerName: string;
  reviewerEmail: string;
  userId?: string;
  rating: number;
  title?: string;
  qualityRating?: number;
  accuracyRating?: number;
  sizeFitFeedback?: 'runs_small' | 'true_to_size' | 'runs_large' | 'comfortable' | '';
  comment: string;
  photos?: string[];
  verifiedPurchase: boolean;
  featuredTestimonial?: boolean;
  reported?: boolean;
  reportReason?: string;
  status: 'approved' | 'hold' | 'rejected';
  createdAt: string;
}

export interface Rider {
  id: string;
  riderCode: string;
  fullName: string;
  email: string;
  phone: string;
  whatsapp: string;
  photoUrl?: string;
  vehicleType: VehicleType;
  vehicleRegistration?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  zoneCoverage: string[];
  status: RiderStatus;
  registeredAt: string;
  updatedAt: string;
}

export interface RiderReview {
  id: string;
  orderId: string;
  orderNumber: string;
  deliveryId: string;
  riderId: string;
  riderName: string;
  customerUid?: string | null;
  customerEmail?: string; // omitted from public/rider payloads
  customerDisplayName: string;
  politenessRating: number;
  communicationRating: number;
  timelinessRating: number;
  handlingRating: number;
  overallRating: number;
  comment: string;
  featuredTestimonial?: boolean;
  status: 'approved' | 'hold' | 'rejected';
  createdAt: string;
}

export interface DeliveryHistoryEntry {
  id: string;
  fromStatus: DeliveryStatus | null;
  toStatus: DeliveryStatus;
  timestamp: string;
  actorType: 'system' | 'admin' | 'rider' | 'customer';
  actorId: string;
  actorName: string;
  note: string;
}

export interface DeliveryEvidence {
  recipientName?: string;
  notes?: string;
  photoUrl?: string;
  submittedAt?: string;
  submittedByRiderId?: string;
  submittedByRiderName?: string;
  locationNote?: string;
  locationLat?: number;
  locationLng?: number;
  locationConsentGranted?: boolean;
  otpVerified?: boolean;
}

export interface DeliveryRecord {
  id: string;
  orderId: string;
  orderNumber: string;
  deliveryType: DeliveryType;
  zoneName: string;
  deliveryFee: number;
  estimatedDeliveryDate?: string;
  estimatedTransitWindow?: string;
  status: DeliveryStatus;
  riderId?: string | null;
  riderCode?: string;
  riderName?: string;
  riderPhone?: string;
  riderWhatsapp?: string;
  riderVehicle?: string;
  recipientName: string;
  customerEmail: string;
  customerPhone: string;
  addressStreet: string;
  addressCity: string;
  addressState: string;
  deliveryInstructions: string;
  courier: string;
  trackingNumber: string;
  otpRequired: boolean;
  otpVerified: boolean;
  otpVerifiedAt?: string;
  otpVerifiedByRiderId?: string;
  otpVerifiedByRiderName?: string;
  otpExpiresAt?: string;
  otpAttemptsRemaining?: number;
  otpLastSentAt?: string;
  evidence?: DeliveryEvidence;
  confirmation: {
    confirmed: boolean;
    confirmedAt?: string;
    confirmedBy?: 'customer_link' | 'customer_dashboard' | 'admin_manual_resolution';
    reminderCount: number;
    lastReminderAt?: string;
    nextReminderDueAt?: string;
    disputeReason?: string;
  };
  codAmountToCollect: number;
  codCollected: boolean;
  codCollectedAt?: string;
  codConfirmedByAdmin?: string;
  assignedAt?: string;
  pickedUpAt?: string;
  outForDeliveryAt?: string;
  arrivedAt?: string;
  deliveredAt?: string;
  failureReason?: string;
  history: DeliveryHistoryEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface DeliveryComplaint {
  id: string;
  complaintNumber: string;
  orderId: string;
  orderNumber: string;
  deliveryId?: string;
  riderId?: string | null;
  riderName?: string;
  customerUid?: string | null;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  category: ComplaintCategory;
  subject: string;
  description: string;
  evidenceUrls: string[];
  status: ComplaintStatus;
  adminNotes: {
    id: string;
    author: string;
    note: string;
    createdAt: string;
  }[];
  resolutionSummary?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DeliverySettings {
  ogbomosoLocalFee: number;
  interstateDefaultFee: number;
  nationwideDefaultFee: number;
  freeDeliveryThreshold: number;
  estimatedTimes: {
    local: string;
    interstate: string;
    nationwide: string;
    pickup: string;
  };
  pickupEnabled: boolean;
  pickupAddress: string;
  pickupInstructions: string;
  localDeliveryEnabled: boolean;
  interstateDeliveryEnabled: boolean;
  nationwideDeliveryEnabled: boolean;
  autoAssignMode: 'manual' | 'round_robin';
  otpEnabled: boolean;
  otpScope: 'all' | 'cod_only' | 'above_threshold';
  otpThresholdAmount: number;
  otpExpiryMinutes: number;
  otpMaxAttempts: number;
  requireCustomerConfirmation: boolean;
  collectDeliveryPhoto: boolean;
  collectDeliveryLocation: boolean;
  reminderFirstAfterHours: number;
  reminderSecondAfterHours: number;
  enableAutomatedEmails: boolean;
  enableDisputeWorkflow: boolean;
}

export interface DeliveryAnalytics {
  totalDeliveries: number;
  pendingDeliveries: number;
  assignedDeliveries: number;
  outForDeliveryCount: number;
  completedDeliveries: number;
  customerConfirmedCount: number;
  failedDeliveries: number;
  disputedDeliveries: number;
  cancelledDeliveries: number;
  averageDeliveryHours: number | null;
  deliverySuccessRate: number | null;
  totalDeliveryFeesCollected: number;
  totalComplaints: number;
  openComplaints: number;
  averageRiderRating: number | null;
  riderPerformance: {
    riderId: string;
    riderCode: string;
    fullName: string;
    status: RiderStatus;
    totalAssigned: number;
    completed: number;
    confirmed: number;
    failed: number;
    pending: number;
    averageRating: number | null;
    reviewCount: number;
  }[];
}

export interface EmailLogEntry {
  id: string;
  eventKey: string;
  to: string;
  subject: string;
  orderId?: string;
  orderNumber?: string;
  deliveryStatus?: string;
  transport: 'smtp' | 'resend' | 'sandbox_log';
  delivered: boolean;
  error?: string;
  htmlPreview: string;
  createdAt: string;
}

export interface ShippingZone {
  id: string;
  name: string;
  states: string[];
  flatRate: number;
  freeShippingMinOrder?: number | null;
  pickupAvailable: boolean;
  pickupAddress?: string;
  estimatedDays: string;
  enabled: boolean;
}

export interface PaystackConfig {
  id: 'paystack';
  title: string;
  description: string;
  enabled: boolean;
  testMode: boolean;
  publicKey: string;
  hasSecretKey: boolean;
  secretKeyMasked: string;
}

export interface FlutterwaveConfig {
  id: 'flutterwave';
  title: string;
  description: string;
  enabled: boolean;
  testMode: boolean;
  publicKey: string;
  hasSecretKey: boolean;
  secretKeyMasked: string;
  hasWebhookHash: boolean;
}

export interface BankTransferConfig {
  id: 'bacs';
  title: string;
  description: string;
  enabled: boolean;
  bankName: string;
  accountName: string;
  accountNumber: string;
  instructions: string;
  paymentDeadlineHours: number;
  requireProofUpload: boolean;
}

export interface CodConfig {
  id: 'cod';
  title: string;
  description: string;
  enabled: boolean;
  minOrderAmount: number;
  maxOrderAmount: number;
  supportedStates: string[];
  additionalFee: number;
  instructions: string;
}

export interface PaymentGatewaysSettings {
  paystack: PaystackConfig;
  flutterwave: FlutterwaveConfig;
  bacs: BankTransferConfig;
  cod: CodConfig;
}

export interface OrderLineItem {
  productId: string;
  variationId?: string;
  name: string;
  sku: string;
  image: string;
  quantity: number;
  unitPrice: number;
  total: number;
  attributes?: Record<string, string>;
}

export interface OrderNote {
  id: string;
  author: string;
  note: string;
  isCustomerVisible: boolean;
  createdAt: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  wooOrderId?: number;
  customerId?: string;
  customerEmail: string;
  customerUid?: string | null;
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
  items: OrderLineItem[];
  subtotal: number;
  discountTotal: number;
  couponCode?: string | null;
  shippingTotal: number;
  shippingZoneName: string;
  codFee: number;
  total: number;
  currency: 'NGN';
  paymentMethod: PaymentMethodId;
  paymentMethodTitle: string;
  paymentStatus: PaymentStatus;
  paymentReference: string;
  gatewayTransactionId?: string;
  transferReceiptUrl?: string | null;
  transferNote?: string | null;
  status: OrderStatus;
  delivery: {
    deliveryId?: string;
    status: DeliveryStatus;
    deliveryType?: DeliveryType;
    riderId?: string | null;
    riderCode?: string;
    riderName?: string;
    riderPhone?: string;
    riderWhatsapp?: string;
    riderVehicle?: string;
    courier: string;
    trackingNumber: string;
    estimatedDeliveryDate?: string;
    otpRequired?: boolean;
    otpVerified?: boolean;
    customerConfirmed?: boolean;
    customerConfirmedAt?: string;
    notes: string;
    updatedAt?: string;
  };
  notes: OrderNote[];
  createdAt: string;
  updatedAt: string;
}

export interface CustomerRecord {
  id: string;
  uid?: string | null;
  wooCustomerId?: number;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  city?: string;
  state?: string;
  ordersCount: number;
  totalSpent: number;
  createdAt: string;
  lastOrderAt?: string | null;
}

export interface StoreSettings {
  storeName: string;
  tagline: string;
  storeEmail: string;
  phone: string;
  whatsapp: string;
  address: string;
  businessHours?: string;
  currency: 'NGN';
  announcementBar: string;
  announcementEnabled: boolean;
  heroEyebrow: string;
  heroTitle: string;
  heroSubtitle: string;
  heroCtaLabel: string;
  heroSecondaryCtaLabel?: string;
  heroImage: string;
  promoBannerTitle: string;
  promoBannerSubtitle: string;
  aboutUsText?: string;
  footerTagline?: string;
  termsText: string;
  privacyText: string;
  refundPolicyText: string;
  returnPolicyText: string;
  shippingPolicyText: string;
  socialLinks: {
    instagram: string;
    twitter: string;
    facebook: string;
  };
  notificationSettings: {
    notifyAdminNewOrder: boolean;
    notifyAdminLowStock: boolean;
    notifyCustomerStatusUpdates: boolean;
  };
}

export interface StoreNotification {
  id: string;
  type:
    | 'new_order'
    | 'payment_received'
    | 'payment_failed'
    | 'bank_transfer_pending'
    | 'cod_order'
    | 'low_stock'
    | 'out_of_stock'
    | 'new_customer'
    | 'delivery_update'
    | 'delivery_dispute'
    | 'complaint_submitted'
    | 'customer_confirmed';
  title: string;
  message: string;
  orderId?: string;
  productId?: string;
  read: boolean;
  createdAt: string;
}

export interface AuditLogEntry {
  id: string;
  actorEmail: string;
  action: string;
  resource: string;
  details: string;
  createdAt: string;
}

export interface ConnectionStatus {
  mode: 'woocommerce' | 'sandbox';
  connected: boolean;
  woocommerceUrl: string | null;
  firebaseProjectId: string;
  message: string;
}

export interface AdminAnalytics {
  totalRevenue: number;
  todayRevenue: number;
  monthRevenue: number;
  totalOrders: number;
  pendingOrders: number;
  processingOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  totalProducts: number;
  totalCustomers: number;
  lowStockProducts: number;
  revenueSeries: { date: string; revenue: number; orders: number }[];
  bestSellingProducts: { id: string; name: string; salesCount: number; revenue: number }[];
  salesByCategory: { category: string; revenue: number; orders: number }[];
  paymentMethodUsage: { method: string; label: string; count: number; revenue: number }[];
}

// --- Dynamic Website Editor (CMS) Types ---
export type HomepageSectionType =
  | 'announcement'
  | 'hero'
  | 'value_pillars'
  | 'category_showcase'
  | 'featured_products'
  | 'new_arrivals'
  | 'best_sellers'
  | 'product_collections'
  | 'promo_banner'
  | 'deals'
  | 'about'
  | 'testimonials'
  | 'newsletter'
  | 'contact'
  | 'custom_content';

export type CmsBackgroundTone = 'white' | 'ivory' | 'black' | 'gold_tint';
export type CmsSpacingSize = 'compact' | 'normal' | 'spacious';
export type CmsSectionLayout = 'default' | 'centered' | 'split_left' | 'split_right' | 'grid_3' | 'grid_4' | 'editorial_dark';

export interface HomepageCustomCard {
  id: string;
  title: string;
  description: string;
  imageUrl?: string;
  linkLabel?: string;
  linkUrl?: string;
}

export interface HomepageSection {
  id: string;
  type: HomepageSectionType;
  label: string;
  enabled: boolean;
  visible: boolean;
  sortOrder: number;
  eyebrow: string;
  title: string;
  subtitle: string;
  content: string;
  imageUrl: string;
  secondaryImageUrl?: string;
  primaryCtaText: string;
  primaryCtaUrl: string;
  secondaryCtaText: string;
  secondaryCtaUrl: string;
  layout: CmsSectionLayout;
  background: CmsBackgroundTone;
  spacing: CmsSpacingSize;
  maxItems?: number;
  categorySlug?: string;
  items?: HomepageCustomCard[];
}

export interface CmsNavLink {
  id: string;
  label: string;
  url: string;
  visible: boolean;
  sortOrder: number;
  openInNewTab?: boolean;
}

export interface CmsHeaderConfig {
  visible: boolean;
  sticky: boolean;
  layout: 'classic_luxury' | 'centered_brand' | 'minimal_bar';
  logoUrl: string;
  logoAlt: string;
  storeNameDisplay: string;
  subtext: string;
  showSubtext: boolean;
  announcementEnabled: boolean;
  announcementText: string;
  announcementLinkText: string;
  announcementLinkUrl: string;
  showSearch: boolean;
  showWishlist: boolean;
  showAccount: boolean;
  showCart: boolean;
  showWhatsappButton: boolean;
  showCategorySubBar: boolean;
  navLinks: CmsNavLink[];
}

export interface CmsFooterColumn {
  id: string;
  title: string;
  visible: boolean;
  links: CmsNavLink[];
}

export interface CmsFooterConfig {
  visible: boolean;
  style: 'obsidian_dark' | 'ivory_light' | 'charcoal_editorial';
  logoUrl: string;
  aboutText: string;
  showNewsletter: boolean;
  newsletterEyebrow: string;
  newsletterTitle: string;
  newsletterSubtitle: string;
  newsletterButtonText: string;
  showContactInfo: boolean;
  phone: string;
  email: string;
  address: string;
  socialLinks: {
    instagram: string;
    twitter: string;
    facebook: string;
    whatsapp: string;
  };
  columns: CmsFooterColumn[];
  showPaymentBadges: boolean;
  copyrightText: string;
}

export type CmsThemePresetId =
  | 'diamond_classic'
  | 'obsidian_gold'
  | 'warm_ivory'
  | 'editorial_minimal'
  | 'midnight_slate';

export type CmsAnimationStyle = 'luxury_smooth' | 'editorial_minimal' | 'dynamic_studio';
export type CmsAnimationIntensity = 'subtle' | 'balanced' | 'expressive';
export type CmsProductHoverStyle = 'tilt_3d' | 'lift_zoom' | 'minimal';

export interface CmsThemeConfig {
  presetId: CmsThemePresetId;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  surfaceColor: string;
  textColor: string;
  headingFont: string;
  bodyFont: string;
  fontSizeScale: 'compact' | 'standard' | 'large';
  buttonStyle: 'pill' | 'rounded' | 'square';
  cardStyle: 'bordered' | 'elevated' | 'flat';
  cardBorderRadius: 'none' | 'md' | 'xl' | '2xl';
  containerWidth: 'standard' | 'wide' | 'full';
  animationsEnabled?: boolean;
  animationStyle?: CmsAnimationStyle;
  animationIntensity?: CmsAnimationIntensity;
  heroEffects?: boolean;
  sectionReveal?: boolean;
  productHoverStyle?: CmsProductHoverStyle;
  backgroundEffects?: boolean;
}

export interface CmsSeoConfig {
  globalTitle: string;
  titleSeparator: string;
  metaDescription: string;
  metaKeywords: string;
  ogImageUrl: string;
  twitterHandle: string;
}

export interface CmsFaqItem {
  id: string;
  question: string;
  answer: string;
}

export interface CmsPage {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  eyebrow?: string;
  contentHtml: string;
  heroImageUrl: string;
  seoTitle: string;
  seoDescription: string;
  status: 'published' | 'draft';
  visible: boolean;
  isSystemPage: boolean;
  faqItems?: CmsFaqItem[];
  updatedAt: string;
  createdAt: string;
}

export type MediaFolder = 'hero' | 'banners' | 'logos' | 'pages' | 'products' | 'general';

export interface MediaAsset {
  id: string;
  name: string;
  url: string;
  folder: MediaFolder;
  mimeType: string;
  sizeBytes?: number;
  isSystemAsset?: boolean;
  createdAt: string;
}

export interface CmsData {
  homepageSections: HomepageSection[];
  pages: CmsPage[];
  header: CmsHeaderConfig;
  footer: CmsFooterConfig;
  theme: CmsThemeConfig;
  seo: CmsSeoConfig;
}

export interface CmsAdminState {
  draft: CmsData;
  published: CmsData;
  mediaLibrary: MediaAsset[];
  lastPublishedAt?: string | null;
  lastDraftSavedAt?: string | null;
  lastPublishedBy?: string | null;
  hasUnpublishedChanges: boolean;
}

