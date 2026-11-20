import {
  ArrowRight,
  CheckCircle2,
  Gem,
  Heart,
  MapPin,
  MessageCircle,
  Quote,
  RotateCcw,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Star,
  Truck,
  X,
} from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ProductCard } from '../components/ProductCard.tsx';
import { RevealSection } from '../components/RevealSection.tsx';
import { useStore } from '../context/StoreContext.tsx';
import { useMotionPreferences } from '../hooks/useMotionPreferences.ts';
import { apiFetch } from '../lib/api.ts';
import type {
  CmsBackgroundTone,
  CmsSpacingSize,
  HomepageSection,
  Product,
  ProductReview,
  ProductVariation,
  RiderReview,
} from '../types/commerce.ts';
import { calculateDiscountPercentage, formatDateShort, formatNaira } from '../utils/currency.ts';
import { buildWhatsAppUrl, sanitizeHtml, stripHtml } from '../utils/sanitizeHtml.ts';

type ShowcaseTab =
  | 'featured_shoes'
  | 'latest_arrivals'
  | 'best_sellers'
  | 'wears_collection'
  | 'special_offers'
  | 'recommended';

function getSpacingClass(spacing: CmsSpacingSize): string {
  if (spacing === 'compact') return 'py-8 lg:py-10';
  if (spacing === 'spacious') return 'py-16 lg:py-24';
  return 'py-12 lg:py-16';
}

function getBackgroundClasses(bg: CmsBackgroundTone): {
  wrapper: string;
  heading: string;
  subtext: string;
  eyebrow: string;
  border: string;
} {
  if (bg === 'black') {
    return {
      wrapper: 'bg-[var(--dm-black,#111111)] text-white border-y border-white/10',
      heading: 'text-white',
      subtext: 'text-neutral-300',
      eyebrow: 'text-[var(--dm-gold,#C6A15B)]',
      border: 'border-white/15',
    };
  }
  if (bg === 'ivory') {
    return {
      wrapper: 'bg-[var(--dm-ivory,#FAF8F3)] text-[var(--dm-black,#111111)] border-y border-[#E8E8E8]',
      heading: 'text-[var(--dm-black,#111111)]',
      subtext: 'text-[#333333]',
      eyebrow: 'text-[#8C6D34]',
      border: 'border-[#E8E8E8]',
    };
  }
  if (bg === 'gold_tint') {
    return {
      wrapper: 'bg-[#F5EFE2] text-[var(--dm-black,#111111)] border-y border-[var(--dm-gold,#C6A15B)]/30',
      heading: 'text-[var(--dm-black,#111111)]',
      subtext: 'text-[#333333]',
      eyebrow: 'text-[#7C5E28]',
      border: 'border-[var(--dm-gold,#C6A15B)]/35',
    };
  }
  return {
    wrapper: 'bg-[var(--dm-white,#FFFFFF)] text-[var(--dm-black,#111111)]',
    heading: 'text-[var(--dm-black,#111111)]',
    subtext: 'text-[#333333]',
    eyebrow: 'text-[#8C6D34]',
    border: 'border-[#E8E8E8]',
  };
}

export function HomePage() {
  const {
    navigate,
    settings,
    categories,
    products,
    cms,
    addToCart,
    isInWishlist,
    toggleWishlist,
    setSearchQuery,
    pushToast,
  } = useStore();

  const { animationsEnabled, heroEffects, backgroundEffects, canHover } = useMotionPreferences();
  const [activeTab, setActiveTab] = useState<ShowcaseTab>('featured_shoes');
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);
  const [selectedVariation, setSelectedVariation] = useState<ProductVariation | null>(null);
  const [productTestimonials, setProductTestimonials] = useState<Omit<ProductReview, 'reviewerEmail'>[]>([]);
  const [riderTestimonials, setRiderTestimonials] = useState<RiderReview[]>([]);
  const [inlineEmail, setInlineEmail] = useState('');
  const [heroParallaxY, setHeroParallaxY] = useState(0);
  const parallaxRafRef = useRef<number | null>(null);

  useEffect(() => {
    apiFetch<{
      productTestimonials: Omit<ProductReview, 'reviewerEmail'>[];
      riderTestimonials: RiderReview[];
    }>('/api/testimonials')
      .then((res) => {
        setProductTestimonials(res.productTestimonials || []);
        setRiderTestimonials(res.riderTestimonials || []);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!heroEffects || !canHover) {
      setHeroParallaxY(0);
      return;
    }
    const onScroll = () => {
      if (parallaxRafRef.current) cancelAnimationFrame(parallaxRafRef.current);
      parallaxRafRef.current = requestAnimationFrame(() => {
        const y = Math.min(26, Math.max(0, window.scrollY * 0.08));
        setHeroParallaxY(y);
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (parallaxRafRef.current) cancelAnimationFrame(parallaxRafRef.current);
    };
  }, [heroEffects, canHover]);

  const visibleCategories = useMemo(() => {
    return [...categories]
      .filter((c) => c.visible !== false)
      .sort((a, b) => (a.sortOrder ?? 99) - (b.sortOrder ?? 99));
  }, [categories]);

  const publishedProducts = useMemo(
    () => products.filter((p) => p.status === 'publish'),
    [products]
  );

  const orderedSections = useMemo<HomepageSection[]>(() => {
    if (cms?.homepageSections && cms.homepageSections.length > 0) {
      return [...cms.homepageSections]
        .filter((s) => s.enabled && s.visible)
        .sort((a, b) => (a.sortOrder ?? 99) - (b.sortOrder ?? 99));
    }
    return [];
  }, [cms]);

  const getTabProducts = (limit = 4) => {
    switch (activeTab) {
      case 'featured_shoes': {
        const shoes = publishedProducts.filter(
          (p) =>
            p.categorySlug === 'shoes' ||
            p.categoryId === 'cat-shoes' ||
            ['sneakers', 'loafers', 'heels'].includes(p.categorySlug)
        );
        return (shoes.length > 0 ? shoes : publishedProducts).slice(0, limit);
      }
      case 'latest_arrivals': {
        const arrivals = publishedProducts.filter((p) => p.isNewArrival);
        return (arrivals.length > 0 ? arrivals : publishedProducts).slice(0, limit);
      }
      case 'best_sellers': {
        const sorted = [...publishedProducts].sort(
          (a, b) => (b.isBestSeller ? 1 : 0) - (a.isBestSeller ? 1 : 0) || b.salesCount - a.salesCount
        );
        return sorted.slice(0, limit);
      }
      case 'wears_collection': {
        const wears = publishedProducts.filter(
          (p) =>
            p.categorySlug === 'wears' ||
            p.categoryId === 'cat-wears' ||
            ['two-piece', 'casualwear'].includes(p.categorySlug)
        );
        return (wears.length > 0 ? wears : publishedProducts).slice(0, limit);
      }
      case 'special_offers': {
        const deals = publishedProducts.filter((p) => p.salePrice && p.salePrice < p.price);
        return (deals.length > 0 ? deals : publishedProducts).slice(0, limit);
      }
      case 'recommended':
      default: {
        const featured = publishedProducts.filter((p) => p.featured);
        return (featured.length > 0 ? featured : publishedProducts).slice(0, limit);
      }
    }
  };

  const openQuickView = (product: Product) => {
    setQuickViewProduct(product);
    setSelectedVariation(null);
  };

  const handleActionUrl = (url?: string) => {
    const clean = (url || '/shop').trim();
    if (clean === '/shop') setSearchQuery('');
    if (/^https?:\/\//i.test(clean)) {
      window.open(clean, '_blank', 'noopener,noreferrer');
      return;
    }
    navigate(clean);
  };

  const whatsappUrl = buildWhatsAppUrl(
    settings?.whatsapp || settings?.phone || '07051959290',
    `Hello ${settings?.storeName || 'Diamond Market'}, I would like styling or order assistance.`
  );

  const tabs: { id: ShowcaseTab; label: string }[] = [
    { id: 'featured_shoes', label: 'Featured Shoes' },
    { id: 'latest_arrivals', label: 'Latest Arrivals' },
    { id: 'best_sellers', label: 'Best Sellers' },
    { id: 'wears_collection', label: 'Wears Collection' },
    { id: 'special_offers', label: 'Special Offers' },
    { id: 'recommended', label: 'Recommended' },
  ];

  const handleInlineSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inlineEmail.trim() || !inlineEmail.includes('@')) {
      pushToast('Please enter a valid email address.', 'error');
      return;
    }
    try {
      await apiFetch('/api/newsletter', {
        method: 'POST',
        body: JSON.stringify({ email: inlineEmail.trim() }),
      });
    } catch {
      // ignore fallback
    }
    pushToast(`Subscribed to ${settings?.storeName || 'Diamond Market'} style updates.`, 'success');
    setInlineEmail('');
  };

  const renderSection = (section: HomepageSection, index: number) => {
    const bg = getBackgroundClasses(section.background);
    const pad = getSpacingClass(section.spacing);
    const limit = Math.max(1, Number(section.maxItems || 4));
    const gridCols =
      section.layout === 'grid_3'
        ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
        : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4';

    switch (section.type) {
      case 'announcement': {
        return (
          <section key={section.id} className={`${bg.wrapper} py-3.5 px-4`}>
            <div className="dm-container flex flex-wrap items-center justify-center gap-3 text-center text-xs sm:text-sm font-medium">
              {section.eyebrow && (
                <span className="font-bold uppercase tracking-wider text-[var(--dm-gold,#C6A15B)]">
                  {section.eyebrow}
                </span>
              )}
              <span>{section.title || section.subtitle}</span>
              {section.primaryCtaText && (
                <button
                  type="button"
                  onClick={() => handleActionUrl(section.primaryCtaUrl)}
                  className="underline font-bold text-[var(--dm-gold,#C6A15B)] hover:opacity-80 cursor-pointer"
                >
                  {section.primaryCtaText}
                </button>
              )}
            </div>
          </section>
        );
      }

      case 'hero': {
        const isCentered = section.layout === 'centered';
        const imageFirst = section.layout === 'split_right';
        const heroImg =
          section.imageUrl ||
          settings?.heroImage ||
          '/src/assets/images/hero_diamond_fashion_1795178919083.jpg';

        return (
          <section key={section.id} className={`relative overflow-hidden ${bg.wrapper}`}>
            {/* Subtle Ambient Champagne Light Drift */}
            {backgroundEffects && (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 overflow-hidden"
              >
                <div className="dm-ambient-aura absolute -top-24 -right-24 w-96 h-96 rounded-full bg-[radial-gradient(circle,rgba(198,161,91,0.18)_0%,transparent_70%)] blur-2xl" />
                <div className="dm-ambient-aura absolute -bottom-24 -left-24 w-80 h-80 rounded-full bg-[radial-gradient(circle,rgba(198,161,91,0.12)_0%,transparent_70%)] blur-2xl" />
              </div>
            )}

            <div className={`relative z-10 dm-container px-4 sm:px-6 lg:px-8 ${pad}`}>
              {isCentered ? (
                <div className="max-w-4xl mx-auto text-center space-y-6">
                  {section.eyebrow && (
                    <div
                      className={`inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] ${
                        heroEffects ? 'dm-hero-stagger-1' : ''
                      } ${bg.eyebrow}`}
                    >
                      <Gem className="w-3.5 h-3.5 text-[var(--dm-gold,#C6A15B)]" />
                      <span>{section.eyebrow}</span>
                    </div>
                  )}
                  <h1
                    className={`font-display text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.08] ${
                      heroEffects ? 'dm-hero-stagger-2' : ''
                    } ${bg.heading}`}
                  >
                    {section.title}
                  </h1>
                  {section.subtitle && (
                    <p
                      className={`text-base sm:text-lg max-w-2xl mx-auto leading-relaxed ${
                        heroEffects ? 'dm-hero-stagger-3' : ''
                      } ${bg.subtext}`}
                    >
                      {section.subtitle}
                    </p>
                  )}
                  <div
                    className={`flex flex-wrap items-center justify-center gap-3.5 pt-2 ${
                      heroEffects ? 'dm-hero-stagger-4' : ''
                    }`}
                  >
                    {section.primaryCtaText && (
                      <button
                        type="button"
                        onClick={() => handleActionUrl(section.primaryCtaUrl)}
                        className="dm-btn-interactive h-12 px-7 dm-btn-shape bg-[var(--dm-black,#111111)] hover:opacity-90 text-white text-xs font-bold uppercase tracking-[0.14em] inline-flex items-center gap-2 shadow-lg cursor-pointer"
                      >
                        {section.primaryCtaText}
                        <ArrowRight className="w-4 h-4 text-[var(--dm-gold,#C6A15B)]" />
                      </button>
                    )}
                    {section.secondaryCtaText && (
                      <button
                        type="button"
                        onClick={() => handleActionUrl(section.secondaryCtaUrl)}
                        className="dm-btn-interactive h-12 px-7 dm-btn-shape bg-white hover:bg-[var(--dm-black,#111111)] text-[var(--dm-black,#111111)] hover:text-white border border-[var(--dm-black,#111111)] text-xs font-bold uppercase tracking-[0.14em] inline-flex items-center gap-2 cursor-pointer"
                      >
                        {section.secondaryCtaText}
                      </button>
                    )}
                  </div>
                  {heroImg && (
                    <div
                      style={
                        heroEffects && canHover
                          ? { transform: `translate3d(0, ${heroParallaxY.toFixed(1)}px, 0)` }
                          : undefined
                      }
                      className={`mt-8 dm-card-shape overflow-hidden border border-[#E8E8E8] shadow-2xl aspect-[16/8] transition-transform duration-200 ${
                        heroEffects ? 'dm-hero-float' : ''
                      }`}
                    >
                      <img
                        src={heroImg}
                        alt={section.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
                  <div className={`lg:col-span-6 space-y-6 ${imageFirst ? 'lg:order-2' : ''}`}>
                    {section.eyebrow && (
                      <div
                        className={`inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] ${
                          heroEffects ? 'dm-hero-stagger-1' : ''
                        } ${bg.eyebrow}`}
                      >
                        <Gem className="w-3.5 h-3.5 text-[var(--dm-gold,#C6A15B)]" />
                        <span>{section.eyebrow}</span>
                      </div>
                    )}

                    <h1
                      className={`font-display text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.08] ${
                        heroEffects ? 'dm-hero-stagger-2' : ''
                      } ${bg.heading}`}
                    >
                      {section.title || 'Step Into Your Style.'}
                    </h1>

                    {section.subtitle && (
                      <p
                        className={`text-base sm:text-lg max-w-xl leading-relaxed ${
                          heroEffects ? 'dm-hero-stagger-3' : ''
                        } ${bg.subtext}`}
                      >
                        {section.subtitle}
                      </p>
                    )}

                    <div
                      className={`flex flex-wrap items-center gap-3.5 pt-2 ${
                        heroEffects ? 'dm-hero-stagger-4' : ''
                      }`}
                    >
                      {section.primaryCtaText && (
                        <button
                          type="button"
                          onClick={() => handleActionUrl(section.primaryCtaUrl)}
                          className="dm-btn-interactive h-12 px-7 dm-btn-shape bg-[var(--dm-black,#111111)] hover:opacity-95 text-white text-xs font-bold uppercase tracking-[0.14em] inline-flex items-center gap-2 shadow-lg shadow-black/15 cursor-pointer"
                        >
                          {section.primaryCtaText}
                          <ArrowRight className="w-4 h-4 text-[var(--dm-gold,#C6A15B)]" />
                        </button>
                      )}
                      {section.secondaryCtaText && (
                        <button
                          type="button"
                          onClick={() => handleActionUrl(section.secondaryCtaUrl)}
                          className="dm-btn-interactive h-12 px-7 dm-btn-shape bg-white hover:bg-[var(--dm-black,#111111)] text-[var(--dm-black,#111111)] hover:text-white border border-[var(--dm-black,#111111)] text-xs font-bold uppercase tracking-[0.14em] inline-flex items-center gap-2 cursor-pointer"
                        >
                          {section.secondaryCtaText}
                        </button>
                      )}
                    </div>

                    <div className={`pt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs opacity-80 border-t ${bg.border}`}>
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-[var(--dm-gold,#C6A15B)]" />
                        {settings?.address || 'Ogbomoso, Oyo State, Nigeria'}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Truck className="w-3.5 h-3.5 text-[var(--dm-gold,#C6A15B)]" />
                        Nationwide Delivery
                      </span>
                      <span className="inline-flex items-center gap-1.5 font-mono-num">
                        <MessageCircle className="w-3.5 h-3.5 text-[var(--dm-gold,#C6A15B)]" />
                        WhatsApp: {settings?.whatsapp || '07051959290'}
                      </span>
                    </div>
                  </div>

                  {/* Layered 3D Depth Showcase Frame */}
                  <div className={`lg:col-span-6 dm-perspective-wrap ${imageFirst ? 'lg:order-1' : ''}`}>
                    <div
                      style={
                        heroEffects && canHover
                          ? { transform: `translate3d(0, ${heroParallaxY.toFixed(1)}px, 0)` }
                          : undefined
                      }
                      className="relative transition-transform duration-150"
                    >
                      {/* Architectural Champagne Depth Backplate */}
                      {heroEffects && (
                        <div
                          aria-hidden="true"
                          className="hidden sm:block pointer-events-none absolute -inset-3 translate-x-2 translate-y-2 dm-card-shape border border-[var(--dm-gold,#C6A15B)]/40 bg-[var(--dm-gold,#C6A15B)]/5"
                        />
                      )}
                      <div
                        className={`relative dm-card-shape overflow-hidden border border-[#E8E8E8] bg-white shadow-2xl shadow-black/15 aspect-[16/11] lg:aspect-[5/4] group ${
                          heroEffects ? 'dm-hero-float' : ''
                        }`}
                      >
                        <img
                          src={heroImg}
                          alt={section.title || 'Diamond Market Showcase'}
                          referrerPolicy="no-referrer"
                          className={`w-full h-full object-cover transition-transform duration-700 ${
                            animationsEnabled ? 'group-hover:scale-105' : ''
                          }`}
                        />
                        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                        <div className="absolute bottom-5 left-5 right-5 flex items-end justify-between gap-4 text-white">
                          <div>
                            <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--dm-gold,#C6A15B)] font-semibold">
                              Curated Edit · Naira (₦)
                            </p>
                            <p className="font-display text-xl font-semibold mt-0.5">
                              {section.content || 'Footwear, Two-Piece Sets & Accessories'}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleActionUrl('/shop')}
                            className="dm-btn-interactive shrink-0 px-4 py-2 dm-btn-shape bg-white/95 hover:bg-[var(--dm-gold,#C6A15B)] text-[var(--dm-black,#111111)] text-[11px] font-bold uppercase tracking-wider cursor-pointer"
                          >
                            View All
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>
        );
      }

      case 'value_pillars': {
        const pillars =
          section.items && section.items.length > 0
            ? section.items
            : [
                {
                  id: 'p1',
                  title: 'Curated Craftsmanship',
                  description: 'Inspected leather footwear and structured wears.',
                },
                {
                  id: 'p2',
                  title: 'Ogbomoso & Nationwide',
                  description: 'Fast dispatch from Oyo State across Nigeria.',
                },
                {
                  id: 'p3',
                  title: 'Flexible Naira Checkout',
                  description: 'Paystack, Flutterwave, Transfer & Pay on Delivery.',
                },
                {
                  id: 'p4',
                  title: 'Clear Return Policies',
                  description: 'Product-specific return & sizing guarantee.',
                },
              ];
        const icons = [Sparkles, Truck, ShieldCheck, RotateCcw];
        return (
          <RevealSection key={section.id}>
            <section className={`${bg.wrapper} border-b border-[#E8E8E8]`}>
              <div className={`dm-container px-4 sm:px-6 lg:px-8 ${pad}`}>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                  {pillars.map((pillar, idx) => {
                    const Icon = icons[idx % icons.length];
                    return (
                      <div
                        key={pillar.id}
                        className="flex items-start gap-3 p-2 rounded-xl transition-transform duration-200 hover:-translate-y-0.5"
                      >
                        <span className="w-9 h-9 rounded-full bg-[var(--dm-ivory,#FAF8F3)] border border-[#E8E8E8] flex items-center justify-center text-[var(--dm-gold,#C6A15B)] shrink-0 shadow-xs">
                          <Icon className="w-4 h-4" />
                        </span>
                        <div>
                          <h3 className={`text-xs font-bold uppercase tracking-wider ${bg.heading}`}>
                            {pillar.title}
                          </h3>
                          <p className={`text-xs opacity-80 mt-0.5 leading-relaxed ${bg.subtext}`}>
                            {pillar.description}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          </RevealSection>
        );
      }

      case 'category_showcase': {
        const cards = visibleCategories.slice(0, limit || 6);
        return (
          <RevealSection key={section.id} delayMs={Math.min(120, index * 30)}>
            <section className={bg.wrapper}>
              <div className={`dm-container px-4 sm:px-6 lg:px-8 ${pad}`}>
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-9">
                  <div>
                    {section.eyebrow && (
                      <p className={`text-[11px] uppercase tracking-[0.2em] font-semibold ${bg.eyebrow}`}>
                        {section.eyebrow}
                      </p>
                    )}
                    <h2 className={`font-display text-3xl sm:text-4xl font-bold mt-1 ${bg.heading}`}>
                      {section.title || 'Shop by Category'}
                    </h2>
                    {section.subtitle && (
                      <p className={`text-sm mt-1 ${bg.subtext}`}>{section.subtitle}</p>
                    )}
                  </div>
                  {section.primaryCtaText && (
                    <button
                      type="button"
                      onClick={() => handleActionUrl(section.primaryCtaUrl || '/shop')}
                      className={`text-xs font-bold uppercase tracking-[0.16em] hover:text-[#8C6D34] inline-flex items-center gap-1.5 cursor-pointer transition-colors ${bg.heading}`}
                    >
                      {section.primaryCtaText} <ArrowRight className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  {cards.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => navigate(`/category/${cat.slug}`)}
                      className={`group text-left bg-[var(--dm-ivory,#FAF8F3)] hover:bg-white dm-card-shape border border-[#E8E8E8] hover:border-[var(--dm-gold,#C6A15B)] overflow-hidden transition-all duration-300 cursor-pointer ${
                        animationsEnabled ? 'hover:-translate-y-1.5 hover:shadow-xl hover:shadow-black/5 active:scale-[0.98]' : ''
                      }`}
                    >
                      <div className="aspect-[4/4.2] bg-white overflow-hidden">
                        {cat.image ? (
                          <img
                            src={cat.image}
                            alt={cat.name}
                            loading="lazy"
                            referrerPolicy="no-referrer"
                            className={`w-full h-full object-cover transition-transform duration-500 ${
                              animationsEnabled ? 'group-hover:scale-105' : ''
                            }`}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-[var(--dm-ivory,#FAF8F3)] text-[var(--dm-gold,#C6A15B)]">
                            <Gem className="w-6 h-6" />
                          </div>
                        )}
                      </div>
                      <div className="p-3.5">
                        <h3 className="font-display font-semibold text-sm text-[var(--dm-black,#111111)] group-hover:text-[#8C6D34] transition-colors truncate">
                          {cat.name}
                        </h3>
                        <p className="text-[11px] text-[#333333]/75 mt-0.5 line-clamp-1">
                          {cat.description || 'Explore collection'}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </section>
          </RevealSection>
        );
      }

      case 'product_collections': {
        const list = section.categorySlug
          ? publishedProducts
              .filter((p) => p.categorySlug === section.categorySlug)
              .slice(0, limit)
          : getTabProducts(limit);

        return (
          <RevealSection key={section.id}>
            <section className={bg.wrapper}>
              <div className={`dm-container px-4 sm:px-6 lg:px-8 ${pad}`}>
                <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-10">
                  <div>
                    {section.eyebrow && (
                      <p className={`text-[11px] uppercase tracking-[0.2em] font-semibold ${bg.eyebrow}`}>
                        {section.eyebrow}
                      </p>
                    )}
                    <h2 className={`font-display text-3xl sm:text-4xl font-bold mt-1 ${bg.heading}`}>
                      {section.title || 'Shoes & Wears Selection'}
                    </h2>
                    {section.subtitle && (
                      <p className={`text-sm mt-1 ${bg.subtext}`}>{section.subtitle}</p>
                    )}
                  </div>

                  {!section.categorySlug && (
                    <div className="flex flex-wrap gap-2">
                      {tabs.map((tab) => (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setActiveTab(tab.id)}
                          className={`dm-btn-interactive px-4 py-2 dm-btn-shape text-xs font-semibold cursor-pointer ${
                            activeTab === tab.id
                              ? 'bg-[var(--dm-black,#111111)] text-white shadow-sm'
                              : 'bg-white text-[#333333] border border-[#E8E8E8] hover:border-[var(--dm-black,#111111)]/40'
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className={`grid ${gridCols} gap-6`}>
                  {list.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      onQuickView={openQuickView}
                    />
                  ))}
                </div>

                {section.primaryCtaText && (
                  <div className="mt-10 text-center">
                    <button
                      type="button"
                      onClick={() => handleActionUrl(section.primaryCtaUrl || '/shop')}
                      className="dm-btn-interactive h-12 px-8 dm-btn-shape border border-[var(--dm-black,#111111)] bg-white hover:bg-[var(--dm-black,#111111)] text-[var(--dm-black,#111111)] hover:text-white text-xs font-bold uppercase tracking-[0.16em] inline-flex items-center gap-2 cursor-pointer"
                    >
                      {section.primaryCtaText} <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </section>
          </RevealSection>
        );
      }

      case 'featured_products':
      case 'new_arrivals':
      case 'best_sellers':
      case 'deals': {
        let filtered = publishedProducts;
        if (section.categorySlug) {
          filtered = filtered.filter((p) => p.categorySlug === section.categorySlug);
        } else if (section.type === 'featured_products') {
          const f = filtered.filter((p) => p.featured);
          if (f.length > 0) filtered = f;
        } else if (section.type === 'new_arrivals') {
          const n = filtered.filter((p) => p.isNewArrival);
          if (n.length > 0) filtered = n;
        } else if (section.type === 'best_sellers') {
          filtered = [...filtered].sort(
            (a, b) => (b.isBestSeller ? 1 : 0) - (a.isBestSeller ? 1 : 0) || b.salesCount - a.salesCount
          );
        } else if (section.type === 'deals') {
          const d = filtered.filter((p) => p.salePrice && p.salePrice < p.price);
          if (d.length > 0) filtered = d;
        }
        const slice = filtered.slice(0, limit);
        if (slice.length === 0) return null;

        return (
          <RevealSection key={section.id}>
            <section className={bg.wrapper}>
              <div className={`dm-container px-4 sm:px-6 lg:px-8 ${pad}`}>
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-9">
                  <div>
                    {section.eyebrow && (
                      <p className={`text-[11px] uppercase tracking-[0.2em] font-semibold ${bg.eyebrow}`}>
                        {section.eyebrow}
                      </p>
                    )}
                    <h2 className={`font-display text-3xl sm:text-4xl font-bold mt-1 ${bg.heading}`}>
                      {section.title}
                    </h2>
                    {section.subtitle && (
                      <p className={`text-sm mt-1 max-w-2xl ${bg.subtext}`}>{section.subtitle}</p>
                    )}
                  </div>
                  {section.primaryCtaText && (
                    <button
                      type="button"
                      onClick={() => handleActionUrl(section.primaryCtaUrl || '/shop')}
                      className={`text-xs font-bold uppercase tracking-[0.16em] hover:text-[var(--dm-gold,#C6A15B)] inline-flex items-center gap-1.5 cursor-pointer transition-colors ${bg.heading}`}
                    >
                      {section.primaryCtaText} <ArrowRight className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className={`grid ${gridCols} gap-6`}>
                  {slice.map((product) => (
                    <ProductCard key={product.id} product={product} onQuickView={openQuickView} />
                  ))}
                </div>
              </div>
            </section>
          </RevealSection>
        );
      }

      case 'promo_banner': {
        const bullets = section.content
          ? section.content.split('|').map((s) => s.trim()).filter(Boolean)
          : [
              'Verified sizing & fit guidance',
              'Same-day dispatch within Ogbomoso',
              'Secure Nigerian Naira checkout',
              'Dedicated product return clarity',
            ];
        return (
          <RevealSection key={section.id}>
            <section className={bg.wrapper}>
              <div className={`dm-container px-4 sm:px-6 lg:px-8 ${pad} dm-perspective-wrap`}>
                <div className="relative dm-card-shape bg-[var(--dm-black,#111111)] text-white overflow-hidden border border-[var(--dm-gold,#C6A15B)]/30 hover:border-[var(--dm-gold,#C6A15B)]/65 transition-all duration-300 hover:shadow-2xl grid grid-cols-1 lg:grid-cols-12">
                  {backgroundEffects && (
                    <div
                      aria-hidden="true"
                      className="dm-ambient-aura pointer-events-none absolute -top-24 right-1/4 w-96 h-96 rounded-full bg-[radial-gradient(circle,rgba(198,161,91,0.16)_0%,transparent_70%)] blur-2xl"
                    />
                  )}
                  <div className="relative z-10 lg:col-span-7 p-8 sm:p-12 lg:p-14 flex flex-col justify-center space-y-5">
                    {section.eyebrow && (
                      <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--dm-gold,#C6A15B)]">
                        {section.eyebrow}
                      </span>
                    )}
                    <h2 className="font-display text-3xl sm:text-4xl font-bold leading-tight">
                      {section.title}
                    </h2>
                    {section.subtitle && (
                      <p className="text-sm sm:text-base text-neutral-300 leading-relaxed max-w-xl">
                        {section.subtitle}
                      </p>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs text-neutral-200">
                      {bullets.map((b) => (
                        <div key={b} className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-[var(--dm-gold,#C6A15B)] shrink-0" />
                          <span>{b}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-3 pt-4">
                      {section.primaryCtaText && (
                        <button
                          type="button"
                          onClick={() => handleActionUrl(section.primaryCtaUrl || whatsappUrl)}
                          className="dm-btn-interactive h-11 px-6 dm-btn-shape bg-[var(--dm-gold,#C6A15B)] hover:opacity-95 text-[var(--dm-black,#111111)] text-xs font-bold uppercase tracking-wider inline-flex items-center gap-2 cursor-pointer"
                        >
                          <MessageCircle className="w-4 h-4" />
                          {section.primaryCtaText}
                        </button>
                      )}
                      {section.secondaryCtaText && (
                        <button
                          type="button"
                          onClick={() => handleActionUrl(section.secondaryCtaUrl || '/contact')}
                          className="dm-btn-interactive h-11 px-6 dm-btn-shape border border-white/25 hover:border-[var(--dm-gold,#C6A15B)] text-white text-xs font-semibold uppercase tracking-wider cursor-pointer"
                        >
                          {section.secondaryCtaText}
                        </button>
                      )}
                    </div>
                  </div>

                  {section.imageUrl ? (
                    <div className="relative z-10 lg:col-span-5 min-h-[260px] overflow-hidden group">
                      <img
                        src={section.imageUrl}
                        alt={section.title}
                        referrerPolicy="no-referrer"
                        className={`w-full h-full object-cover transition-transform duration-700 ${
                          animationsEnabled ? 'group-hover:scale-105' : ''
                        }`}
                      />
                    </div>
                  ) : (
                    <div className="relative z-10 lg:col-span-5 bg-[#181818] p-8 sm:p-10 border-t lg:border-t-0 lg:border-l border-white/10 flex flex-col justify-between gap-6">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--dm-gold,#C6A15B)] font-semibold">
                          Personal Styling &amp; Sizing Help
                        </p>
                        <h3 className="font-display text-2xl font-semibold mt-2">
                          Need EU size guidance or bulk inquiries?
                        </h3>
                        <p className="text-xs text-neutral-400 mt-2 leading-relaxed">
                          Reach {settings?.storeName || 'Diamond Market'} directly by phone or WhatsApp for quick measurements, pair availability, or delivery coordination across Nigeria.
                        </p>
                      </div>
                      <div className="space-y-3 rounded-2xl bg-white/5 border border-white/10 p-5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-neutral-400">Location</span>
                          <span className="font-semibold text-white">
                            {settings?.address || 'Ogbomoso, Oyo State, Nigeria'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-neutral-400">Phone / WhatsApp</span>
                          <a
                            href={`tel:${settings?.phone || '07051959290'}`}
                            className="font-mono-num font-bold text-[var(--dm-gold,#C6A15B)] hover:underline"
                          >
                            {settings?.phone || '07051959290'}
                          </a>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-neutral-400">Currency</span>
                          <span className="font-semibold text-white">Nigerian Naira (₦ / NGN)</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </section>
          </RevealSection>
        );
      }

      case 'testimonials': {
        if (productTestimonials.length === 0 && riderTestimonials.length === 0) {
          return null;
        }
        return (
          <RevealSection key={section.id}>
            <section className={bg.wrapper}>
              <div className={`dm-container px-4 sm:px-6 lg:px-8 ${pad} space-y-10`}>
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                  <div>
                    {section.eyebrow && (
                      <p className={`text-[11px] uppercase tracking-[0.2em] font-semibold ${bg.eyebrow}`}>
                        {section.eyebrow}
                      </p>
                    )}
                    <h2 className={`font-display text-3xl sm:text-4xl font-bold mt-1 ${bg.heading}`}>
                      {section.title || 'Approved Reviews & Delivery Feedback'}
                    </h2>
                  </div>
                  {section.primaryCtaText && (
                    <button
                      type="button"
                      onClick={() => handleActionUrl(section.primaryCtaUrl || '/shop')}
                      className={`text-xs font-bold uppercase tracking-[0.16em] hover:text-[var(--dm-gold,#C6A15B)] inline-flex items-center gap-1.5 cursor-pointer ${bg.heading}`}
                    >
                      {section.primaryCtaText} <ArrowRight className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {productTestimonials.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {productTestimonials.slice(0, 3).map((rev) => (
                      <div
                        key={rev.id}
                        className="bg-white border border-[#E8E8E8] hover:border-[var(--dm-gold,#C6A15B)]/60 dm-card-shape p-6 flex flex-col justify-between gap-4 text-[#111111] transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
                      >
                        <div className="space-y-3">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-0.5 text-[var(--dm-gold,#C6A15B)]">
                              {Array.from({ length: 5 }).map((_, idx) => (
                                <Star
                                  key={idx}
                                  className={`w-3.5 h-3.5 ${idx < rev.rating ? 'fill-current' : 'opacity-25'}`}
                                />
                              ))}
                            </div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-[#8C6D34]">
                              Verified Purchase
                            </span>
                          </div>
                          {rev.title && (
                            <h3 className="font-display font-bold text-base text-[#111111]">{rev.title}</h3>
                          )}
                          <p className="text-xs text-[#333333] leading-relaxed">
                            <Quote className="w-3.5 h-3.5 text-[var(--dm-gold,#C6A15B)] inline mr-1.5 -mt-0.5" />
                            {rev.comment}
                          </p>
                        </div>
                        <div className="pt-3 border-t border-[#E8E8E8] flex items-center justify-between text-[11px] text-[#333333]/75">
                          <span className="font-semibold text-[#111111]">{rev.reviewerName}</span>
                          <span>{rev.productName || formatDateShort(rev.createdAt)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {riderTestimonials.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {riderTestimonials.slice(0, 2).map((rr) => (
                      <div
                        key={rr.id}
                        className="bg-white border border-[var(--dm-gold,#C6A15B)]/40 dm-card-shape p-6 flex flex-col justify-between gap-3 text-[#111111] transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-[#8C6D34]">
                            Dispatch Delivery Feedback · Rider {rr.riderName}
                          </span>
                          <span className="font-mono-num text-xs font-bold text-[#111111]">
                            {rr.overallRating.toFixed(1)} ★
                          </span>
                        </div>
                        {rr.comment && (
                          <p className="text-xs text-[#333333] leading-relaxed">“{rr.comment}”</p>
                        )}
                        <div className="text-[11px] text-[#333333]/75 flex items-center justify-between">
                          <span className="font-semibold text-[#111111]">{rr.customerDisplayName}</span>
                          <span>{formatDateShort(rr.createdAt)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </RevealSection>
        );
      }

      case 'newsletter': {
        return (
          <RevealSection key={section.id}>
            <section className={bg.wrapper}>
              <div className={`dm-container px-4 sm:px-6 lg:px-8 ${pad} max-w-3xl text-center space-y-4`}>
                {section.eyebrow && (
                  <p className={`text-[11px] font-bold uppercase tracking-[0.2em] ${bg.eyebrow}`}>
                    {section.eyebrow}
                  </p>
                )}
                <h2 className={`font-display text-3xl font-bold ${bg.heading}`}>
                  {section.title}
                </h2>
                {section.subtitle && (
                  <p className={`text-sm ${bg.subtext}`}>{section.subtitle}</p>
                )}
                <form
                  onSubmit={handleInlineSubscribe}
                  className="flex flex-col sm:flex-row gap-2.5 max-w-md mx-auto pt-2"
                >
                  <input
                    type="email"
                    value={inlineEmail}
                    onChange={(e) => setInlineEmail(e.target.value)}
                    placeholder="Enter your email address"
                    className="flex-1 h-11 px-4 rounded-full bg-white border border-[#E8E8E8] text-sm text-[#111111] focus:outline-none focus:border-[var(--dm-gold,#C6A15B)] transition-colors"
                  />
                  <button
                    type="submit"
                    className="dm-btn-interactive h-11 px-6 dm-btn-shape bg-[var(--dm-black,#111111)] text-white text-xs font-bold uppercase tracking-wider cursor-pointer"
                  >
                    {section.primaryCtaText || 'Subscribe'}
                  </button>
                </form>
              </div>
            </section>
          </RevealSection>
        );
      }

      case 'about':
      case 'contact':
      case 'custom_content':
      default: {
        const hasImage = Boolean(section.imageUrl);
        const imageRight = section.layout !== 'split_left';
        return (
          <RevealSection key={section.id}>
            <section className={bg.wrapper}>
              <div className={`dm-container px-4 sm:px-6 lg:px-8 ${pad} space-y-8`}>
                <div
                  className={
                    hasImage
                      ? 'grid grid-cols-1 lg:grid-cols-12 gap-10 items-center'
                      : section.layout === 'centered'
                      ? 'max-w-3xl mx-auto text-center space-y-5'
                      : 'max-w-4xl space-y-5'
                  }
                >
                  <div className={`${hasImage ? 'lg:col-span-6 space-y-5' : 'space-y-5'} ${hasImage && !imageRight ? 'lg:order-2' : ''}`}>
                    {section.eyebrow && (
                      <p className={`text-[11px] font-bold uppercase tracking-[0.2em] ${bg.eyebrow}`}>
                        {section.eyebrow}
                      </p>
                    )}
                    <h2 className={`font-display text-3xl sm:text-4xl font-bold leading-tight ${bg.heading}`}>
                      {section.title}
                    </h2>
                    {section.subtitle && (
                      <p className={`text-base leading-relaxed ${bg.subtext}`}>{section.subtitle}</p>
                    )}
                    {section.content && (
                      <div
                        className={`dm-prose text-sm leading-relaxed ${bg.subtext}`}
                        dangerouslySetInnerHTML={{ __html: sanitizeHtml(section.content) }}
                      />
                    )}
                    {(section.primaryCtaText || section.secondaryCtaText) && (
                      <div className={`flex flex-wrap gap-3 pt-2 ${section.layout === 'centered' ? 'justify-center' : ''}`}>
                        {section.primaryCtaText && (
                          <button
                            type="button"
                            onClick={() => handleActionUrl(section.primaryCtaUrl)}
                            className="dm-btn-interactive h-11 px-6 dm-btn-shape bg-[var(--dm-gold,#C6A15B)] text-[var(--dm-black,#111111)] text-xs font-bold uppercase tracking-wider inline-flex items-center gap-2 cursor-pointer"
                          >
                            {section.primaryCtaText}
                            <ArrowRight className="w-4 h-4" />
                          </button>
                        )}
                        {section.secondaryCtaText && (
                          <button
                            type="button"
                            onClick={() => handleActionUrl(section.secondaryCtaUrl)}
                            className={`dm-btn-interactive h-11 px-6 dm-btn-shape border ${bg.border} text-xs font-semibold uppercase tracking-wider cursor-pointer`}
                          >
                            {section.secondaryCtaText}
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {hasImage && (
                    <div className={`lg:col-span-6 ${!imageRight ? 'lg:order-1' : ''}`}>
                      <div className="dm-card-shape overflow-hidden border border-[#E8E8E8] shadow-xl aspect-[16/11] bg-white group">
                        <img
                          src={section.imageUrl}
                          alt={section.title || 'Diamond Market'}
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          className={`w-full h-full object-cover transition-transform duration-700 ${
                            animationsEnabled ? 'group-hover:scale-105' : ''
                          }`}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {section.items && section.items.length > 0 && (
                  <div className={`grid ${gridCols} gap-5 pt-2`}>
                    {section.items.map((item) => (
                      <div
                        key={item.id}
                        className="dm-card-shape border border-[#E8E8E8] bg-white text-[#111111] overflow-hidden p-5 space-y-2.5 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-[var(--dm-gold,#C6A15B)]/60"
                      >
                        {item.imageUrl && (
                          <div className="aspect-[16/10] rounded-xl overflow-hidden bg-[#FAF8F3] mb-2">
                            <img
                              src={item.imageUrl}
                              alt={item.title}
                              loading="lazy"
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                            />
                          </div>
                        )}
                        <h3 className="font-display font-bold text-base">{item.title}</h3>
                        {item.description && <p className="text-xs text-[#333333]">{item.description}</p>}
                        {item.linkLabel && (
                          <button
                            type="button"
                            onClick={() => handleActionUrl(item.linkUrl)}
                            className="text-xs font-bold uppercase tracking-wider text-[#8C6D34] hover:underline cursor-pointer"
                          >
                            {item.linkLabel} →
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </RevealSection>
        );
      }
    }
  };

  return (
    <div className="bg-[var(--dm-white,#FFFFFF)] text-[var(--dm-black,#111111)]">
      {orderedSections.length > 0 ? (
        orderedSections.map((sec, idx) => renderSection(sec, idx))
      ) : (
        <div className="py-24 text-center px-4 space-y-4">
          <h1 className="font-display text-3xl font-bold">
            {settings?.storeName || 'Diamond Market'}
          </h1>
          <p className="text-sm text-[#333333] max-w-md mx-auto">
            All homepage sections are currently hidden or empty. Add or enable sections in Admin → Website Editor.
          </p>
          <button
            type="button"
            onClick={() => navigate('/shop')}
            className="dm-btn-interactive px-6 py-3 dm-btn-shape bg-[#111111] text-white text-xs font-bold uppercase tracking-wider cursor-pointer"
          >
            Browse Full Catalog
          </button>
        </div>
      )}

      {/* Quick View Modal with Strict Variation Selector */}
      {quickViewProduct && (
        <QuickViewModal
          product={quickViewProduct}
          selectedVariation={selectedVariation}
          setSelectedVariation={setSelectedVariation}
          onClose={() => setQuickViewProduct(null)}
          onAddToCart={(qty) => {
            const added = addToCart(quickViewProduct, qty, selectedVariation || undefined);
            if (added) {
              setQuickViewProduct(null);
            }
          }}
          onViewFull={() => {
            const slug = quickViewProduct.slug;
            setQuickViewProduct(null);
            navigate(`/product/${slug}`);
          }}
          isWished={isInWishlist(quickViewProduct.id)}
          onToggleWish={() => toggleWishlist(quickViewProduct.id)}
        />
      )}
    </div>
  );
}

interface QuickViewModalProps {
  product: Product;
  selectedVariation: ProductVariation | null;
  setSelectedVariation: (v: ProductVariation | null) => void;
  onClose: () => void;
  onAddToCart: (qty: number) => void;
  onViewFull: () => void;
  isWished: boolean;
  onToggleWish: () => void;
}

function QuickViewModal({
  product,
  selectedVariation,
  setSelectedVariation,
  onClose,
  onAddToCart,
  onViewFull,
  isWished,
  onToggleWish,
}: QuickViewModalProps) {
  const isVariable = product.type === 'variable' && product.variations.length > 0;
  const activePrice = selectedVariation
    ? selectedVariation.salePrice && selectedVariation.salePrice < selectedVariation.price
      ? selectedVariation.salePrice
      : selectedVariation.price
    : product.salePrice && product.salePrice < product.price
    ? product.salePrice
    : product.price;

  const basePrice = selectedVariation ? selectedVariation.price : product.price;
  const discount = calculateDiscountPercentage(
    basePrice,
    selectedVariation ? selectedVariation.salePrice : product.salePrice
  );

  return (
    <div
      className="no-print dm-backdrop-in fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#111111]/65 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="dm-modal-in bg-white rounded-3xl max-w-3xl w-full overflow-hidden shadow-2xl border border-[#E8E8E8] grid grid-cols-1 md:grid-cols-2 relative max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full bg-white border border-[#E8E8E8] flex items-center justify-center text-[#111111] hover:bg-[#FAF8F3] active:scale-90 transition-all cursor-pointer"
          aria-label="Close quick view"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="bg-[#FAF8F3] aspect-square md:aspect-auto overflow-hidden">
          <img
            src={product.images[0]}
            alt={product.name}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />
        </div>

        <div className="p-6 sm:p-8 flex flex-col justify-between gap-5">
          <div className="space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#8C6D34]">
              {product.subcategoryName || product.categoryName}
            </p>
            <h3 className="font-display text-2xl font-bold text-[#111111] leading-snug">
              {product.name}
            </h3>
            <div className="flex items-baseline gap-2.5">
              <span className="font-mono-num text-2xl font-bold text-[#111111]">
                {formatNaira(activePrice)}
              </span>
              {discount && (
                <span className="font-mono-num text-sm text-neutral-400 line-through">
                  {formatNaira(basePrice)}
                </span>
              )}
            </div>
            <p className="text-sm text-[#333333] leading-relaxed line-clamp-3">
              {product.shortDescription || stripHtml(product.description)}
            </p>

            {isVariable && (
              <div className="pt-2">
                <p className="text-xs font-bold uppercase tracking-wider text-[#111111] mb-2">
                  Select Size / Option <span className="text-[#8C6D34]">*</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {product.variations.map((v) => {
                    const label = Object.values(v.attributes).join(' · ') || v.sku;
                    const active = selectedVariation?.id === v.id;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        disabled={!v.inStock || v.stockQuantity <= 0}
                        onClick={() => setSelectedVariation(v)}
                        className={`px-3.5 py-2 dm-btn-shape text-xs font-semibold border transition-all active:scale-95 cursor-pointer ${
                          active
                            ? 'bg-[#111111] text-white border-[#111111]'
                            : !v.inStock || v.stockQuantity <= 0
                            ? 'bg-neutral-100 text-neutral-400 border-neutral-200 line-through cursor-not-allowed'
                            : 'bg-white text-[#111111] border-[#E8E8E8] hover:border-[#C6A15B]'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
                {!selectedVariation && (
                  <p className="text-[11px] text-[#8C6D34] mt-1.5">
                    Please pick an option above to add this piece to your bag.
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="space-y-2.5 pt-2">
            <div className="flex gap-2.5">
              <button
                type="button"
                disabled={!product.inStock || (isVariable && !selectedVariation)}
                onClick={() => onAddToCart(1)}
                className="dm-btn-interactive flex-1 h-11 dm-btn-shape bg-[#111111] hover:bg-[#2a2a2a] disabled:bg-neutral-200 disabled:text-neutral-500 text-white text-xs font-bold uppercase tracking-wider inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <ShoppingBag className="w-4 h-4 text-[#C6A15B]" />
                {!product.inStock
                  ? 'Out of Stock'
                  : isVariable && !selectedVariation
                  ? 'Select Option First'
                  : 'Add to Bag'}
              </button>
              <button
                type="button"
                onClick={onToggleWish}
                className={`w-11 h-11 rounded-full border flex items-center justify-center transition-all active:scale-90 cursor-pointer ${
                  isWished
                    ? 'bg-[#111111] border-[#111111] text-[#C6A15B]'
                    : 'border-[#E8E8E8] text-[#111111] hover:border-[#C6A15B]'
                }`}
                aria-label="Toggle wishlist"
              >
                <Heart className={`w-4 h-4 ${isWished ? 'fill-current' : ''}`} />
              </button>
            </div>
            <button
              type="button"
              onClick={onViewFull}
              className="dm-btn-interactive w-full h-10 dm-btn-shape border border-[#E8E8E8] hover:bg-[#FAF8F3] text-xs font-semibold uppercase tracking-wider text-[#111111] cursor-pointer"
            >
              View Full Product Details &amp; Return Policy
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
