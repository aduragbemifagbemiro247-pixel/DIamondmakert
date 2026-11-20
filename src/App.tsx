import React, { useEffect, useMemo } from 'react';
import { CartDrawer } from './components/CartDrawer.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { FloatingWhatsApp } from './components/FloatingWhatsApp.tsx';
import { Footer } from './components/Footer.tsx';
import { Header } from './components/Header.tsx';
import { StoreProvider, useStore } from './context/StoreContext.tsx';
import { AdminDashboardPage } from './pages/AdminDashboardPage.tsx';
import { AuthPage } from './pages/AuthPage.tsx';
import { CheckoutPage } from './pages/CheckoutPage.tsx';
import { ConfirmDeliveryPage } from './pages/ConfirmDeliveryPage.tsx';
import { ContactPage } from './pages/ContactPage.tsx';
import { CustomerDashboardPage } from './pages/CustomerDashboardPage.tsx';
import { DynamicCmsPage } from './pages/DynamicCmsPage.tsx';
import { HomePage } from './pages/HomePage.tsx';
import { OrderConfirmationPage } from './pages/OrderConfirmationPage.tsx';
import { PolicyPage } from './pages/PolicyPage.tsx';
import { ProductDetailPage } from './pages/ProductDetailPage.tsx';
import { RiderDashboardPage } from './pages/RiderDashboardPage.tsx';
import { ShopPage } from './pages/ShopPage.tsx';
import { TrackOrderPage } from './pages/TrackOrderPage.tsx';
import { WishlistPage } from './pages/WishlistPage.tsx';

function setMetaContent(selector: string, content: string) {
  if (!content || typeof document === 'undefined') return;
  const el = document.querySelector(selector);
  if (el) el.setAttribute('content', content);
}

function StoreRouter() {
  const {
    pathname,
    loading,
    error,
    refreshStore,
    toasts,
    settings,
    products,
    categories,
    cms,
    cmsPages,
    isPreviewMode,
  } = useStore();

  const isPaymentCallback =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).has('payment_callback');

  const isAdminRoute = pathname === '/admin' || pathname.startsWith('/admin/');
  const isRiderRoute = pathname === '/rider' || pathname.startsWith('/rider/');
  const isChromelessRoute = isAdminRoute || isRiderRoute;

  const matchedCmsSlug = useMemo(() => {
    if (pathname.startsWith('/pages/')) {
      return pathname.replace('/pages/', '').split('/')[0];
    }
    const clean = pathname.replace(/^\/+/, '').split('/')[0];
    return clean;
  }, [pathname]);

  const activeCmsPage = useMemo(() => {
    if (!matchedCmsSlug) return undefined;
    return cmsPages.find(
      (p) =>
        p.slug.toLowerCase() === matchedCmsSlug.toLowerCase() &&
        (isPreviewMode || (p.status === 'published' && p.visible))
    );
  }, [cmsPages, matchedCmsSlug, isPreviewMode]);

  useEffect(() => {
    const storeName = cms?.header?.storeNameDisplay || settings?.storeName || 'Diamond Market';
    const sep = cms?.seo?.titleSeparator || '—';
    const seoDesc =
      cms?.seo?.metaDescription ||
      'Shop luxury footwear, sneakers, loafers, tailored wears, and fashion accessories at Diamond Market.';

    if (isAdminRoute) {
      document.title = `Admin Console ${sep} ${storeName}`;
    } else if (isRiderRoute) {
      document.title = `Dispatch Rider Portal ${sep} ${storeName}`;
    } else if (pathname.startsWith('/confirm-delivery/')) {
      document.title = `Confirm Delivery ${sep} ${storeName}`;
    } else if (pathname.startsWith('/product/')) {
      const slug = pathname.replace('/product/', '').split('/')[0];
      const match = products.find((p) => p.slug === slug || p.id === slug);
      document.title =
        match?.seoTitle || (match ? `${match.name} ${sep} ${storeName}` : `${storeName} ${sep} Shoes & Wears`);
      if (match?.seoDescription || match?.shortDescription) {
        setMetaContent('meta[name="description"]', match.seoDescription || match.shortDescription);
      }
    } else if (pathname.startsWith('/category/')) {
      const slug = pathname.replace('/category/', '').split('/')[0];
      const cat = categories.find((c) => c.slug === slug);
      document.title = `${cat?.name || 'Collection'} ${sep} ${storeName}`;
      setMetaContent('meta[name="description"]', cat?.description || seoDesc);
    } else if (pathname.startsWith('/shop')) {
      document.title = `Shop Shoes & Wears ${sep} ${storeName}`;
      setMetaContent('meta[name="description"]', seoDesc);
    } else if (pathname === '/contact') {
      const contactPage = cmsPages.find((p) => p.slug === 'contact');
      document.title = contactPage?.seoTitle || `Contact ${sep} ${storeName}`;
      setMetaContent('meta[name="description"]', contactPage?.seoDescription || seoDesc);
    } else if (pathname.startsWith('/checkout')) {
      document.title = `Secure Checkout ${sep} ${storeName}`;
    } else if (pathname.startsWith('/track-order')) {
      document.title = `Track Order ${sep} ${storeName}`;
    } else if (activeCmsPage) {
      document.title = activeCmsPage.seoTitle || `${activeCmsPage.title} ${sep} ${storeName}`;
      setMetaContent('meta[name="description"]', activeCmsPage.seoDescription || activeCmsPage.subtitle || seoDesc);
      setMetaContent('meta[property="og:title"]', activeCmsPage.seoTitle || activeCmsPage.title);
      setMetaContent('meta[property="og:description"]', activeCmsPage.seoDescription || seoDesc);
    } else {
      const globalTitle = cms?.seo?.globalTitle || `${storeName} ${sep} Premium Shoes & Wears Store in Nigeria`;
      document.title = globalTitle;
      setMetaContent('meta[name="description"]', seoDesc);
      setMetaContent('meta[property="og:title"]', globalTitle);
      setMetaContent('meta[property="og:description"]', seoDesc);
    }
  }, [pathname, isAdminRoute, isRiderRoute, settings, products, categories, cms, cmsPages, activeCmsPage]);

  const storefrontThemeStyle = useMemo<React.CSSProperties>(() => {
    const t = cms?.theme;
    if (!t || isChromelessRoute) return {};

    const btnRadius =
      t.buttonStyle === 'square' ? '0.25rem' : t.buttonStyle === 'rounded' ? '0.75rem' : '9999px';
    const cardRadius =
      t.cardBorderRadius === 'none'
        ? '0px'
        : t.cardBorderRadius === 'md'
        ? '0.5rem'
        : t.cardBorderRadius === 'xl'
        ? '0.85rem'
        : '1rem';
    const containerMax =
      t.containerWidth === 'full' ? '100%' : t.containerWidth === 'wide' ? '90rem' : '80rem';
    const fontScale =
      t.fontSizeScale === 'compact' ? '0.94' : t.fontSizeScale === 'large' ? '1.06' : '1';

    return {
      '--dm-black': t.primaryColor || '#111111',
      '--dm-charcoal': t.secondaryColor || '#333333',
      '--dm-gold': t.accentColor || '#C6A15B',
      '--dm-white': t.backgroundColor || '#FFFFFF',
      '--dm-ivory': t.surfaceColor || '#FAF8F3',
      '--font-display': t.headingFont || "'Playfair Display', Georgia, serif",
      '--font-sans': t.bodyFont || "'Plus Jakarta Sans', system-ui, sans-serif",
      '--dm-btn-radius': btnRadius,
      '--dm-card-radius': cardRadius,
      '--dm-container-max': containerMax,
      '--dm-font-scale': fontScale,
    } as React.CSSProperties;
  }, [cms?.theme, isChromelessRoute]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF8F3] flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-[#111111] border-t-[#C6A15B] rounded-full animate-spin mx-auto" />
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#333333]">
            Loading Diamond Market...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#FAF8F3] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-[#E8E8E8] rounded-3xl p-8 text-center space-y-4">
          <h1 className="font-display text-xl font-bold text-[#111111]">
            Storefront Connection Error
          </h1>
          <p className="text-sm text-[#333333]/80">{error}</p>
          <button
            type="button"
            onClick={refreshStore}
            className="px-6 py-2.5 bg-[#111111] text-white text-xs font-bold uppercase tracking-wider rounded-full cursor-pointer"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  let pageContent: React.ReactNode = <HomePage />;

  if (isPaymentCallback) {
    pageContent = <OrderConfirmationPage />;
  } else if (isAdminRoute) {
    pageContent = <AdminDashboardPage />;
  } else if (isRiderRoute) {
    pageContent = <RiderDashboardPage />;
  } else if (pathname === '/' || pathname === '') {
    pageContent = <HomePage />;
  } else if (pathname.startsWith('/confirm-delivery/')) {
    const token = pathname.replace('/confirm-delivery/', '').split('/')[0];
    pageContent = <ConfirmDeliveryPage token={decodeURIComponent(token)} />;
  } else if (pathname === '/shop') {
    pageContent = <ShopPage />;
  } else if (pathname.startsWith('/category/')) {
    const slug = pathname.replace('/category/', '').split('/')[0];
    pageContent = <ShopPage categorySlug={slug} />;
  } else if (pathname.startsWith('/product/')) {
    const slug = pathname.replace('/product/', '').split('/')[0];
    pageContent = <ProductDetailPage slug={slug} />;
  } else if (pathname === '/contact') {
    pageContent = <ContactPage />;
  } else if (pathname === '/wishlist') {
    pageContent = <WishlistPage />;
  } else if (pathname === '/checkout') {
    pageContent = <CheckoutPage />;
  } else if (pathname.startsWith('/order/')) {
    const orderNumber = pathname.replace('/order/', '').split('/')[0];
    pageContent = <OrderConfirmationPage orderNumber={orderNumber} />;
  } else if (pathname === '/track-order') {
    pageContent = <TrackOrderPage />;
  } else if (pathname === '/auth') {
    pageContent = <AuthPage />;
  } else if (pathname === '/account') {
    pageContent = <CustomerDashboardPage />;
  } else if (pathname.startsWith('/policy/')) {
    const type = pathname.replace('/policy/', '').split('/')[0];
    pageContent = <PolicyPage type={type} />;
  } else if (pathname.startsWith('/pages/')) {
    const slug = pathname.replace('/pages/', '').split('/')[0];
    pageContent = <DynamicCmsPage slug={slug} />;
  } else {
    const fallbackSlug = pathname.replace(/^\/+/, '').split('/')[0];
    pageContent = <DynamicCmsPage slug={fallbackSlug} />;
  }

  const animEnabled = cms?.theme?.animationsEnabled ?? true;
  const animStyle = cms?.theme?.animationStyle || 'luxury_smooth';
  const animIntensity = cms?.theme?.animationIntensity || 'balanced';

  return (
    <div
      style={storefrontThemeStyle}
      data-dm-anim={animEnabled ? 'on' : 'off'}
      data-dm-anim-style={animStyle}
      data-dm-intensity={animIntensity}
      className={`min-h-screen flex flex-col ${isChromelessRoute ? '' : 'dm-storefront-root'}`}
    >
      {!isChromelessRoute && <Header />}
      <main className="flex-1">{pageContent}</main>
      {!isChromelessRoute && <Footer />}
      <CartDrawer />
      {!isChromelessRoute && !isPreviewMode && <FloatingWhatsApp />}

      {toasts.length > 0 && (
        <div
          aria-live="polite"
          className="fixed bottom-20 right-5 z-50 space-y-2 max-w-sm no-print pointer-events-none"
        >
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`dm-toast-in pointer-events-auto px-4 py-3 rounded-2xl text-xs font-medium shadow-xl border backdrop-blur-md ${
                t.type === 'error'
                  ? 'bg-rose-950/95 text-white border-rose-800'
                  : t.type === 'success'
                  ? 'bg-[#111111]/95 text-white border-[#C6A15B]/75'
                  : 'bg-white/95 text-[#111111] border-[#E8E8E8]'
              }`}
            >
              {t.text}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <StoreProvider>
        <StoreRouter />
      </StoreProvider>
    </ErrorBoundary>
  );
}
