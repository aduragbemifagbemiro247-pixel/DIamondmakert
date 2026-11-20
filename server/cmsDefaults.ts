import crypto from 'crypto';
import type {
  CmsData,
  CmsFooterColumn,
  CmsFooterConfig,
  CmsHeaderConfig,
  CmsNavLink,
  CmsPage,
  CmsSeoConfig,
  CmsThemeConfig,
  HomepageSection,
  MediaAsset,
  StoreSettings,
} from '../src/types/commerce.ts';

const RESERVED_SLUGS = new Set([
  '',
  'shop',
  'category',
  'product',
  'cart',
  'checkout',
  'order',
  'track-order',
  'wishlist',
  'auth',
  'account',
  'admin',
  'rider',
  'policy',
  'confirm-delivery',
  'api',
  'uploads',
]);

export function normalizePageSlug(raw: string): string {
  return String(raw || '')
    .toLowerCase()
    .trim()
    .replace(/^\/+/, '')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function isReservedRouteSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(normalizePageSlug(slug));
}

export function createDefaultHomepageSections(settings: StoreSettings): HomepageSection[] {
  return [
    {
      id: 'sec-hero',
      type: 'hero',
      label: 'Hero Banner',
      enabled: true,
      visible: true,
      sortOrder: 1,
      eyebrow: settings.heroEyebrow || 'Ogbomoso, Oyo State · Shoes & Wears',
      title: settings.heroTitle || 'Step Into Your Style.',
      subtitle:
        settings.heroSubtitle ||
        'Explore footwear and fashion essentials carefully selected to bring style, comfort, and confidence to every occasion.',
      content: 'Footwear, Two-Piece Sets & Accessories',
      imageUrl: settings.heroImage || '/src/assets/images/hero_diamond_fashion_1795178919083.jpg',
      secondaryImageUrl: '',
      primaryCtaText: settings.heroCtaLabel || 'Shop Shoes',
      primaryCtaUrl: '/category/shoes',
      secondaryCtaText: settings.heroSecondaryCtaLabel || 'Explore Wears',
      secondaryCtaUrl: '/category/wears',
      layout: 'split_left',
      background: 'ivory',
      spacing: 'spacious',
      items: [],
    },
    {
      id: 'sec-pillars',
      type: 'value_pillars',
      label: 'Value Pillars Bar',
      enabled: true,
      visible: true,
      sortOrder: 2,
      eyebrow: 'Diamond Market Promise',
      title: 'Why Discerning Shoppers Choose Us',
      subtitle: '',
      content: '',
      imageUrl: '',
      primaryCtaText: '',
      primaryCtaUrl: '',
      secondaryCtaText: '',
      secondaryCtaUrl: '',
      layout: 'grid_4',
      background: 'white',
      spacing: 'compact',
      items: [
        {
          id: 'pil-1',
          title: 'Curated Craftsmanship',
          description: 'Inspected leather footwear and structured wears.',
        },
        {
          id: 'pil-2',
          title: 'Ogbomoso & Nationwide',
          description: 'Fast dispatch from Oyo State across Nigeria.',
        },
        {
          id: 'pil-3',
          title: 'Flexible Naira Checkout',
          description: 'Paystack, Flutterwave, Transfer & Pay on Delivery.',
        },
        {
          id: 'pil-4',
          title: 'Clear Return Policies',
          description: 'Product-specific return & sizing guarantee.',
        },
      ],
    },
    {
      id: 'sec-categories',
      type: 'category_showcase',
      label: 'Category Showcase',
      enabled: true,
      visible: true,
      sortOrder: 3,
      eyebrow: 'Explore Departments',
      title: 'Shop by Category',
      subtitle: 'Curated footwear, tailored wears, and everyday essentials.',
      content: '',
      imageUrl: '',
      primaryCtaText: 'Browse Full Catalog',
      primaryCtaUrl: '/shop',
      secondaryCtaText: '',
      secondaryCtaUrl: '',
      layout: 'default',
      background: 'white',
      spacing: 'normal',
      maxItems: 6,
    },
    {
      id: 'sec-collections',
      type: 'product_collections',
      label: 'Shoes & Wears Tabs Showcase',
      enabled: true,
      visible: true,
      sortOrder: 4,
      eyebrow: 'Curated Edit',
      title: 'Shoes & Wears Selection',
      subtitle: 'Switch seamlessly between our footwear, latest arrivals, best sellers, and special offers.',
      content: '',
      imageUrl: '',
      primaryCtaText: 'View All Shoes & Wears',
      primaryCtaUrl: '/shop',
      secondaryCtaText: '',
      secondaryCtaUrl: '',
      layout: 'grid_4',
      background: 'ivory',
      spacing: 'normal',
      maxItems: 4,
    },
    {
      id: 'sec-promo',
      type: 'promo_banner',
      label: 'Editorial Promotional Banner',
      enabled: true,
      visible: true,
      sortOrder: 5,
      eyebrow: 'Why Shop at Diamond Market',
      title: settings.promoBannerTitle || 'Curated Shoes & Wears Delivered Nationwide From Ogbomoso',
      subtitle:
        settings.promoBannerSubtitle ||
        'Order directly online or inquire on WhatsApp (07051959290). Pay securely with Paystack, Flutterwave, Direct Bank Transfer, or Pay on Delivery.',
      content:
        'Verified sizing & fit guidance|Same-day dispatch within Ogbomoso|Secure Nigerian Naira checkout|Dedicated product return clarity',
      imageUrl: '',
      primaryCtaText: 'Chat on WhatsApp',
      primaryCtaUrl: `https://wa.me/234${(settings.whatsapp || '07051959290').replace(/^0/, '')}`,
      secondaryCtaText: 'Contact Store',
      secondaryCtaUrl: '/contact',
      layout: 'editorial_dark',
      background: 'white',
      spacing: 'normal',
    },
    {
      id: 'sec-testimonials',
      type: 'testimonials',
      label: 'Verified Client Reviews & Delivery Feedback',
      enabled: true,
      visible: true,
      sortOrder: 6,
      eyebrow: 'Verified Client Voices',
      title: 'Approved Reviews & Delivery Feedback',
      subtitle: 'Real ratings submitted by verified Diamond Market buyers and completed deliveries.',
      content: '',
      imageUrl: '',
      primaryCtaText: 'Explore Verified Pieces',
      primaryCtaUrl: '/shop',
      secondaryCtaText: '',
      secondaryCtaUrl: '',
      layout: 'grid_3',
      background: 'ivory',
      spacing: 'normal',
      maxItems: 3,
    },
    {
      id: 'sec-about',
      type: 'about',
      label: 'About Diamond Market',
      enabled: false,
      visible: true,
      sortOrder: 7,
      eyebrow: 'Our Heritage',
      title: 'Rooted in Ogbomoso, Styled for Nigeria',
      subtitle:
        settings.aboutUsText ||
        'Diamond Market is a modern Nigerian fashion retailer based in Ogbomoso, Oyo State, specializing in carefully curated shoes, contemporary wears, and signature leather accessories.',
      content:
        '<p>Every pair of shoes and every two-piece garment in our showroom is inspected for stitching, comfort, and lasting value before dispatch across Oyo State and Nigeria.</p>',
      imageUrl: '/src/assets/images/prod_tailored_two_piece_1795178922245.jpg',
      primaryCtaText: 'Visit Contact & Story',
      primaryCtaUrl: '/about',
      secondaryCtaText: 'Shop Collection',
      secondaryCtaUrl: '/shop',
      layout: 'split_right',
      background: 'white',
      spacing: 'normal',
    },
    {
      id: 'sec-newsletter',
      type: 'newsletter',
      label: 'Style Dispatch Newsletter Strip',
      enabled: false,
      visible: true,
      sortOrder: 8,
      eyebrow: 'Diamond Style Circle',
      title: 'Be the first to know about new footwear drops & capsule deals',
      subtitle: 'No clutter — only curated new arrivals, restocks, and private seasonal offers.',
      content: '',
      imageUrl: '',
      primaryCtaText: 'Subscribe',
      primaryCtaUrl: '',
      secondaryCtaText: '',
      secondaryCtaUrl: '',
      layout: 'centered',
      background: 'gold_tint',
      spacing: 'compact',
    },
  ];
}

export function createDefaultHeaderConfig(settings: StoreSettings): CmsHeaderConfig {
  const navLinks: CmsNavLink[] = [
    { id: 'nav-shop', label: 'Shop', url: '/shop', visible: true, sortOrder: 1 },
    { id: 'nav-shoes', label: 'Shoes', url: '/category/shoes', visible: true, sortOrder: 2 },
    { id: 'nav-wears', label: 'Wears', url: '/category/wears', visible: true, sortOrder: 3 },
    { id: 'nav-accessories', label: 'Accessories', url: '/category/accessories', visible: true, sortOrder: 4 },
    { id: 'nav-about', label: 'About', url: '/about', visible: true, sortOrder: 5 },
    { id: 'nav-contact', label: 'Contact', url: '/contact', visible: true, sortOrder: 6 },
    { id: 'nav-track', label: 'Track Order', url: '/track-order', visible: true, sortOrder: 7 },
  ];

  return {
    visible: true,
    sticky: true,
    layout: 'classic_luxury',
    logoUrl: '',
    logoAlt: `${settings.storeName || 'Diamond Market'} Logo`,
    storeNameDisplay: settings.storeName || 'Diamond Market',
    subtext: 'SHOES & WEARS',
    showSubtext: true,
    announcementEnabled: settings.announcementEnabled ?? true,
    announcementText:
      settings.announcementBar ||
      'New Shoes & Tailored Wears Collection Now Live — Free Oyo State delivery above ₦120,000 (Code: DIAMOND10)',
    announcementLinkText: 'Shop New Arrivals',
    announcementLinkUrl: '/shop',
    showSearch: true,
    showWishlist: true,
    showAccount: true,
    showCart: true,
    showWhatsappButton: true,
    showCategorySubBar: true,
    navLinks,
  };
}

export function createDefaultFooterConfig(settings: StoreSettings): CmsFooterConfig {
  const columns: CmsFooterColumn[] = [
    {
      id: 'col-collections',
      title: 'Collections',
      visible: true,
      links: [
        { id: 'fl-all', label: 'All Collections', url: '/shop', visible: true, sortOrder: 1 },
        { id: 'fl-shoes', label: 'Luxury Shoes', url: '/category/shoes', visible: true, sortOrder: 2 },
        { id: 'fl-wears', label: 'Tailored Wears', url: '/category/wears', visible: true, sortOrder: 3 },
        { id: 'fl-acc', label: 'Accessories', url: '/category/accessories', visible: true, sortOrder: 4 },
        { id: 'fl-sneakers', label: 'Sneakers & Trainers', url: '/category/sneakers', visible: true, sortOrder: 5 },
      ],
    },
    {
      id: 'col-care',
      title: 'Customer Care',
      visible: true,
      links: [
        { id: 'fl-about', label: 'About Us', url: '/about', visible: true, sortOrder: 1 },
        { id: 'fl-contact', label: 'Contact Us', url: '/contact', visible: true, sortOrder: 2 },
        { id: 'fl-faq', label: 'FAQ', url: '/faq', visible: true, sortOrder: 3 },
        { id: 'fl-track', label: 'Track Your Order', url: '/track-order', visible: true, sortOrder: 4 },
        { id: 'fl-delivery', label: 'Delivery Information', url: '/delivery-information', visible: true, sortOrder: 5 },
        { id: 'fl-returns', label: 'Return Policy', url: '/return-policy', visible: true, sortOrder: 6 },
        { id: 'fl-rider', label: 'Rider Dispatch Portal', url: '/rider', visible: true, sortOrder: 7 },
      ],
    },
    {
      id: 'col-legal',
      title: 'Policies & Legal',
      visible: true,
      links: [
        { id: 'fl-terms', label: 'Terms & Conditions', url: '/terms-and-conditions', visible: true, sortOrder: 1 },
        { id: 'fl-privacy', label: 'Privacy Policy', url: '/privacy-policy', visible: true, sortOrder: 2 },
        { id: 'fl-account', label: 'My Account & Orders', url: '/account', visible: true, sortOrder: 3 },
        { id: 'fl-wish', label: 'Saved Wishlist', url: '/wishlist', visible: true, sortOrder: 4 },
      ],
    },
  ];

  return {
    visible: true,
    style: 'obsidian_dark',
    logoUrl: '',
    aboutText:
      settings.footerTagline ||
      settings.tagline ||
      'Classic footwear, tailored wears & timeless fashion essentials.',
    showNewsletter: true,
    newsletterEyebrow: 'Diamond Style Dispatch',
    newsletterTitle: 'Receive new footwear drops & seasonal wear arrivals',
    newsletterSubtitle: `Curated collections from ${settings.address || 'Ogbomoso, Oyo State, Nigeria'} delivered nationwide.`,
    newsletterButtonText: 'Join',
    showContactInfo: true,
    phone: settings.phone || '07051959290',
    email: settings.storeEmail || 'orders@diamondmarket.ng',
    address: settings.address || 'Ogbomoso, Oyo State, Nigeria',
    socialLinks: {
      instagram: settings.socialLinks?.instagram || 'https://instagram.com',
      twitter: settings.socialLinks?.twitter || 'https://x.com',
      facebook: settings.socialLinks?.facebook || 'https://facebook.com',
      whatsapp: settings.whatsapp || '07051959290',
    },
    columns,
    showPaymentBadges: true,
    copyrightText: `© ${new Date().getFullYear()} ${settings.storeName || 'Diamond Market'}. Shoes & Wears — Nigeria.`,
  };
}

export function createDefaultThemeConfig(): CmsThemeConfig {
  return {
    presetId: 'diamond_classic',
    primaryColor: '#111111',
    secondaryColor: '#333333',
    accentColor: '#C6A15B',
    backgroundColor: '#FFFFFF',
    surfaceColor: '#FAF8F3',
    textColor: '#111111',
    headingFont: "'Playfair Display', Georgia, 'Times New Roman', serif",
    bodyFont: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",
    fontSizeScale: 'standard',
    buttonStyle: 'pill',
    cardStyle: 'bordered',
    cardBorderRadius: '2xl',
    containerWidth: 'standard',
    animationsEnabled: true,
    animationStyle: 'luxury_smooth',
    animationIntensity: 'balanced',
    heroEffects: true,
    sectionReveal: true,
    productHoverStyle: 'tilt_3d',
    backgroundEffects: true,
  };
}

export function createDefaultSeoConfig(settings: StoreSettings): CmsSeoConfig {
  return {
    globalTitle: `${settings.storeName || 'Diamond Market'} — Premium Shoes & Wears Store in Ogbomoso, Nigeria`,
    titleSeparator: '—',
    metaDescription:
      'Shop luxury footwear, sneakers, loafers, tailored wears, and fashion accessories at Diamond Market in Ogbomoso, Oyo State, Nigeria. Nationwide delivery with Paystack, Flutterwave, Bank Transfer & Pay on Delivery.',
    metaKeywords:
      'Diamond Market, Shoes and Wears Nigeria, Ogbomoso Fashion Store, Luxury Loafers, Sneakers Nigeria, Two-Piece Tailored Wears',
    ogImageUrl: '/src/assets/images/hero_diamond_fashion_1795178919083.jpg',
    twitterHandle: '@diamondmarketng',
  };
}

export function createDefaultPages(settings: StoreSettings): CmsPage[] {
  const now = new Date().toISOString();
  return [
    {
      id: 'page-about-us',
      slug: 'about',
      title: 'About Diamond Market',
      subtitle: 'Crafted footwear and structured wears curated in Ogbomoso, Oyo State for discerning Nigerian wardrobes.',
      eyebrow: 'Our Story',
      contentHtml: `<h3>Who We Are</h3><p>${
        settings.aboutUsText ||
        'Diamond Market is a modern Nigerian fashion retailer based in Ogbomoso, Oyo State, specializing in carefully curated shoes, contemporary wears, and signature leather accessories.'
      }</p><h3>Craftsmanship &amp; Inspection</h3><p>Every shoe, sneaker, loafer, and two-piece garment passes hand inspection for sole durability, stitching consistency, and comfortable Nigerian climate wearability before entering our showcase.</p><h3>Ogbomoso Roots, Nationwide Reach</h3><p>Whether you shop in-person in Ogbomoso or place an online order from Lagos, Abuja, Ibadan, Port Harcourt, or any of the 36 states, our dispatch desk coordinates insured door-to-door delivery with verified OTP handoff.</p>`,
      heroImageUrl: '/src/assets/images/hero_diamond_fashion_1795178919083.jpg',
      seoTitle: 'About Us — Diamond Market Shoes & Wears',
      seoDescription: 'Learn about Diamond Market in Ogbomoso, Oyo State — our footwear craftsmanship, tailored wears, and nationwide Nigerian delivery.',
      status: 'published',
      visible: true,
      isSystemPage: true,
      updatedAt: now,
      createdAt: now,
    },
    {
      id: 'page-contact-us',
      slug: 'contact',
      title: 'Always Within Reach in Ogbomoso & Nationwide',
      subtitle:
        settings.aboutUsText ||
        'Diamond Market specializes in curated footwear, tailored two-piece sets, casualwear, and refined fashion accessories from Ogbomoso, Oyo State, Nigeria.',
      eyebrow: 'Contact & Concierge Desk',
      contentHtml:
        '<p>Reach our styling, EU sizing, or delivery support desk directly by phone, WhatsApp, or via the inquiry composer below.</p>',
      heroImageUrl: '',
      seoTitle: 'Contact Diamond Market — Ogbomoso, Nigeria',
      seoDescription: 'Contact Diamond Market via WhatsApp or phone (07051959290) in Ogbomoso, Oyo State for sizing help, orders, and nationwide shipping.',
      status: 'published',
      visible: true,
      isSystemPage: true,
      updatedAt: now,
      createdAt: now,
    },
    {
      id: 'page-faq',
      slug: 'faq',
      title: 'Frequently Asked Questions',
      subtitle: 'Quick answers about sizing, payments, delivery timelines, OTP confirmation, and returns.',
      eyebrow: 'Help Center',
      contentHtml:
        '<p>Below are answers to the most common questions from Diamond Market shoppers across Ogbomoso and Nigeria. Need personal help? Message us on WhatsApp at 07051959290.</p>',
      heroImageUrl: '',
      seoTitle: 'FAQ — Diamond Market Nigeria',
      seoDescription: 'Answers to common questions about ordering shoes and wears, delivery zones, OTP handoff, and returns at Diamond Market.',
      status: 'published',
      visible: true,
      isSystemPage: true,
      faqItems: [
        {
          id: 'faq-1',
          question: 'How fast do you deliver within Ogbomoso and across Nigeria?',
          answer:
            'Orders placed before 2:00 PM in Ogbomoso & Oyo State qualify for same-day or next-day dispatch. Lagos, Abuja, and interstate deliveries arrive within 1–5 business days with tracking.',
        },
        {
          id: 'faq-2',
          question: 'Which payment methods do you accept?',
          answer:
            'We accept Paystack (Cards, Bank Transfer, USSD), Flutterwave, Direct Bank Transfer with receipt upload, and Pay on Delivery across supported states.',
        },
        {
          id: 'faq-3',
          question: 'How does Delivery OTP & Customer Confirmation work?',
          answer:
            'For eligible orders, a 6-digit security OTP is emailed to you so your rider verifies the right recipient upon arrival. Afterwards, you can confirm delivery in one click from your email or Customer Dashboard.',
        },
        {
          id: 'faq-4',
          question: 'Can I exchange shoes if the EU size does not fit?',
          answer:
            'Yes. Unworn footwear and unworn garments with original packaging and clean outsoles qualify for quick size exchange or return within 7 days of delivery.',
        },
      ],
      updatedAt: now,
      createdAt: now,
    },
    {
      id: 'page-delivery-info',
      slug: 'delivery-information',
      title: 'Delivery & Dispatch Information',
      subtitle: 'Ogbomoso same-day dispatch, interstate routes, pickup hub details, and OTP verification.',
      eyebrow: 'Shipping & Logistics',
      contentHtml: `<h3>Regional Delivery Schedule</h3><p>${
        settings.shippingPolicyText ||
        'Orders placed before 2:00 PM qualify for same-day or next-day dispatch across Ogbomoso and Oyo State. Lagos, Abuja, and interstate deliveries arrive within 1–5 business days with tracking.'
      }</p><h3>Pickup Desk &amp; Rider Safety</h3><p>Customers in Ogbomoso can choose direct pickup from our Ogbomoso hub or doorstep rider delivery with live status tracking via Track Order.</p>`,
      heroImageUrl: '',
      seoTitle: 'Delivery Information — Diamond Market Nigeria',
      seoDescription: 'Delivery zones, shipping fees, same-day Ogbomoso dispatch, and nationwide delivery timelines.',
      status: 'published',
      visible: true,
      isSystemPage: true,
      updatedAt: now,
      createdAt: now,
    },
    {
      id: 'page-return-policy',
      slug: 'return-policy',
      title: 'Return & Refund Policy',
      subtitle: 'Transparent exchange and refund terms for shoes, wears, and accessories.',
      eyebrow: 'Buyer Protection',
      contentHtml: `<h3>7-Day Return &amp; Size Exchange</h3><p>${
        settings.returnPolicyText ||
        'Unworn shoes and unworn garments with original tags and boxes may be returned or exchanged within 7 days of delivery.'
      }</p><h3>Refund Processing</h3><p>${
        settings.refundPolicyText ||
        'Approved returns are refunded within 3–5 business days to your original Paystack/Flutterwave method or nominated Nigerian bank account.'
      }</p>`,
      heroImageUrl: '',
      seoTitle: 'Return & Refund Policy — Diamond Market',
      seoDescription: 'Read the Diamond Market return, exchange, and refund policy for shoes and apparel.',
      status: 'published',
      visible: true,
      isSystemPage: true,
      updatedAt: now,
      createdAt: now,
    },
    {
      id: 'page-privacy-policy',
      slug: 'privacy-policy',
      title: 'Privacy Policy',
      subtitle: 'How Diamond Market safeguards your account, address book, and payment records.',
      eyebrow: 'Data Protection',
      contentHtml: `<p>${
        settings.privacyText ||
        'Customer profiles, delivery addresses, and authentication records are protected via Firebase Authentication and strict server-side access controls. Payment card details are processed securely by Paystack or Flutterwave and never stored on our servers.'
      }</p>`,
      heroImageUrl: '',
      seoTitle: 'Privacy Policy — Diamond Market',
      seoDescription: 'Privacy policy detailing customer data protection at Diamond Market.',
      status: 'published',
      visible: true,
      isSystemPage: true,
      updatedAt: now,
      createdAt: now,
    },
    {
      id: 'page-terms',
      slug: 'terms-and-conditions',
      title: 'Terms & Conditions',
      subtitle: 'Storefront purchasing, pricing in Nigerian Naira (NGN), and fulfillment terms.',
      eyebrow: 'Legal Notice',
      contentHtml: `<p>${
        settings.termsText ||
        'All orders placed on Diamond Market are subject to stock verification and payment confirmation. Prices are denominated in Nigerian Naira (NGN).'
      }</p>`,
      heroImageUrl: '',
      seoTitle: 'Terms & Conditions — Diamond Market',
      seoDescription: 'Terms and conditions governing purchases at Diamond Market Nigeria.',
      status: 'published',
      visible: true,
      isSystemPage: true,
      updatedAt: now,
      createdAt: now,
    },
  ];
}

export function createInitialMediaLibrary(): MediaAsset[] {
  const now = new Date().toISOString();
  const seeds: { name: string; url: string; folder: MediaAsset['folder'] }[] = [
    {
      name: 'Hero — Diamond Market Editorial Edit',
      url: '/src/assets/images/hero_diamond_fashion_1795178919083.jpg',
      folder: 'hero',
    },
    {
      name: 'Product — Handcrafted Leather Sneakers',
      url: '/src/assets/images/prod_leather_sneakers_1795178922442.jpg',
      folder: 'products',
    },
    {
      name: 'Product — Royal Suede Loafers',
      url: '/src/assets/images/prod_suede_loafers_1795178922817.jpg',
      folder: 'products',
    },
    {
      name: 'Product — Champagne Stiletto Heels',
      url: '/src/assets/images/prod_stiletto_heels_1795178922483.jpg',
      folder: 'products',
    },
    {
      name: 'Product — Tailored Two-Piece Suit',
      url: '/src/assets/images/prod_tailored_two_piece_1795178922245.jpg',
      folder: 'products',
    },
    {
      name: 'Product — Essential Luxury Hoodie',
      url: '/src/assets/images/prod_essential_hoodie_1795178922447.jpg',
      folder: 'products',
    },
    {
      name: 'Product — Crafted Leather Bag',
      url: '/src/assets/images/prod_crafted_leather_bag_1795178922982.jpg',
      folder: 'products',
    },
    {
      name: 'Product — Sculpted Running Trainers',
      url: '/src/assets/images/prod_running_trainers_1795178922046.jpg',
      folder: 'products',
    },
    {
      name: 'Product — Leather Weekender Holdall',
      url: '/src/assets/images/prod_leather_weekender_1795176860307.jpg',
      folder: 'products',
    },
    {
      name: 'Product — Gold Chronograph Watch',
      url: '/src/assets/images/prod_gold_chronograph_1795176863201.jpg',
      folder: 'products',
    },
  ];

  return seeds.map((s, idx) => ({
    id: `media-sys-${idx + 1}`,
    name: s.name,
    url: s.url,
    folder: s.folder,
    mimeType: 'image/jpeg',
    isSystemAsset: true,
    createdAt: now,
  }));
}

export function createDefaultCmsData(settings: StoreSettings): CmsData {
  return {
    homepageSections: createDefaultHomepageSections(settings),
    pages: createDefaultPages(settings),
    header: createDefaultHeaderConfig(settings),
    footer: createDefaultFooterConfig(settings),
    theme: createDefaultThemeConfig(),
    seo: createDefaultSeoConfig(settings),
  };
}

export function sanitizeCmsData(input: Partial<CmsData> | undefined, fallback: CmsData): CmsData {
  const safe = input || {};

  const homepageSections: HomepageSection[] = Array.isArray(safe.homepageSections)
    ? safe.homepageSections.map((sec, idx) => ({
        id: sec.id || `sec-${crypto.randomUUID().slice(0, 8)}`,
        type: sec.type || 'custom_content',
        label: String(sec.label || sec.title || 'Section').trim(),
        enabled: sec.enabled ?? true,
        visible: sec.visible ?? true,
        sortOrder: Number.isFinite(sec.sortOrder) ? Number(sec.sortOrder) : idx + 1,
        eyebrow: String(sec.eyebrow || ''),
        title: String(sec.title || ''),
        subtitle: String(sec.subtitle || ''),
        content: String(sec.content || ''),
        imageUrl: String(sec.imageUrl || ''),
        secondaryImageUrl: sec.secondaryImageUrl ? String(sec.secondaryImageUrl) : '',
        primaryCtaText: String(sec.primaryCtaText || ''),
        primaryCtaUrl: String(sec.primaryCtaUrl || ''),
        secondaryCtaText: String(sec.secondaryCtaText || ''),
        secondaryCtaUrl: String(sec.secondaryCtaUrl || ''),
        layout: sec.layout || 'default',
        background: sec.background || 'white',
        spacing: sec.spacing || 'normal',
        maxItems: sec.maxItems ? Number(sec.maxItems) : 4,
        categorySlug: sec.categorySlug ? String(sec.categorySlug) : '',
        items: Array.isArray(sec.items)
          ? sec.items.map((it) => ({
              id: it.id || `item-${crypto.randomUUID().slice(0, 6)}`,
              title: String(it.title || ''),
              description: String(it.description || ''),
              imageUrl: it.imageUrl ? String(it.imageUrl) : '',
              linkLabel: it.linkLabel ? String(it.linkLabel) : '',
              linkUrl: it.linkUrl ? String(it.linkUrl) : '',
            }))
          : [],
      }))
    : fallback.homepageSections;

  const pages: CmsPage[] = Array.isArray(safe.pages)
    ? safe.pages.map((p) => ({
        id: p.id || `page-${crypto.randomUUID().slice(0, 8)}`,
        slug: normalizePageSlug(p.slug || p.title || 'page') || `page-${Date.now().toString().slice(-4)}`,
        title: String(p.title || 'Untitled Page').trim(),
        subtitle: String(p.subtitle || ''),
        eyebrow: p.eyebrow ? String(p.eyebrow) : '',
        contentHtml: String(p.contentHtml || ''),
        heroImageUrl: String(p.heroImageUrl || ''),
        seoTitle: String(p.seoTitle || p.title || ''),
        seoDescription: String(p.seoDescription || p.subtitle || ''),
        status: p.status === 'draft' ? 'draft' : 'published',
        visible: p.visible ?? true,
        isSystemPage: Boolean(p.isSystemPage),
        faqItems: Array.isArray(p.faqItems)
          ? p.faqItems.map((f) => ({
              id: f.id || `faq-${crypto.randomUUID().slice(0, 6)}`,
              question: String(f.question || ''),
              answer: String(f.answer || ''),
            }))
          : [],
        createdAt: p.createdAt || new Date().toISOString(),
        updatedAt: p.updatedAt || new Date().toISOString(),
      }))
    : fallback.pages;

  const header: CmsHeaderConfig = {
    ...fallback.header,
    ...(safe.header || {}),
    navLinks: Array.isArray(safe.header?.navLinks)
      ? safe.header.navLinks.map((lnk, idx) => ({
          id: lnk.id || `nav-${idx + 1}`,
          label: String(lnk.label || 'Link').trim(),
          url: String(lnk.url || '/'),
          visible: lnk.visible ?? true,
          sortOrder: Number.isFinite(lnk.sortOrder) ? Number(lnk.sortOrder) : idx + 1,
          openInNewTab: Boolean(lnk.openInNewTab),
        }))
      : fallback.header.navLinks,
  };

  const footer: CmsFooterConfig = {
    ...fallback.footer,
    ...(safe.footer || {}),
    socialLinks: {
      ...fallback.footer.socialLinks,
      ...(safe.footer?.socialLinks || {}),
    },
    columns: Array.isArray(safe.footer?.columns)
      ? safe.footer.columns.map((col, cIdx) => ({
          id: col.id || `col-${cIdx + 1}`,
          title: String(col.title || 'Links').trim(),
          visible: col.visible ?? true,
          links: Array.isArray(col.links)
            ? col.links.map((lnk, lIdx) => ({
                id: lnk.id || `fl-${cIdx}-${lIdx}`,
                label: String(lnk.label || 'Link').trim(),
                url: String(lnk.url || '/'),
                visible: lnk.visible ?? true,
                sortOrder: Number.isFinite(lnk.sortOrder) ? Number(lnk.sortOrder) : lIdx + 1,
                openInNewTab: Boolean(lnk.openInNewTab),
              }))
            : [],
        }))
      : fallback.footer.columns,
  };

  const theme: CmsThemeConfig = {
    ...fallback.theme,
    ...(safe.theme || {}),
    animationsEnabled: safe.theme?.animationsEnabled ?? fallback.theme.animationsEnabled ?? true,
    animationStyle: safe.theme?.animationStyle || fallback.theme.animationStyle || 'luxury_smooth',
    animationIntensity:
      safe.theme?.animationIntensity || fallback.theme.animationIntensity || 'balanced',
    heroEffects: safe.theme?.heroEffects ?? fallback.theme.heroEffects ?? true,
    sectionReveal: safe.theme?.sectionReveal ?? fallback.theme.sectionReveal ?? true,
    productHoverStyle: safe.theme?.productHoverStyle || fallback.theme.productHoverStyle || 'tilt_3d',
    backgroundEffects: safe.theme?.backgroundEffects ?? fallback.theme.backgroundEffects ?? true,
  };

  const seo: CmsSeoConfig = {
    ...fallback.seo,
    ...(safe.seo || {}),
  };

  return {
    homepageSections,
    pages,
    header,
    footer,
    theme,
    seo,
  };
}
