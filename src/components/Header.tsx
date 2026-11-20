import {
  Heart,
  Menu,
  MessageCircle,
  Search,
  ShieldCheck,
  ShoppingBag,
  User,
  X,
} from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../context/StoreContext.tsx';
import { useMotionPreferences } from '../hooks/useMotionPreferences.ts';
import type { CmsNavLink } from '../types/commerce.ts';
import { buildWhatsAppUrl } from '../utils/sanitizeHtml.ts';
import { BrandLogo } from './BrandLogo.tsx';

export function Header() {
  const {
    pathname,
    navigate,
    settings,
    categories,
    cms,
    cartCount,
    wishlistIds,
    setIsCartOpen,
    user,
    isAdmin,
    searchQuery,
    setSearchQuery,
  } = useStore();

  const { animationsEnabled } = useMotionPreferences();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [cartBump, setCartBump] = useState(false);
  const prevCartCountRef = useRef(cartCount);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 18);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (cartCount > prevCartCountRef.current && animationsEnabled) {
      setCartBump(true);
      const timer = window.setTimeout(() => setCartBump(false), 480);
      prevCartCountRef.current = cartCount;
      return () => window.clearTimeout(timer);
    }
    prevCartCountRef.current = cartCount;
  }, [cartCount, animationsEnabled]);

  const visibleCategories = useMemo(() => {
    return [...categories]
      .filter((c) => c.visible !== false)
      .sort((a, b) => (a.sortOrder ?? 99) - (b.sortOrder ?? 99));
  }, [categories]);

  const topCategories = useMemo(() => {
    const parents = visibleCategories.filter((c) => !c.parentId);
    return parents.length > 0 ? parents : visibleCategories;
  }, [visibleCategories]);

  const headerCfg = cms?.header;

  const navLinks = useMemo<CmsNavLink[]>(() => {
    if (headerCfg?.navLinks && headerCfg.navLinks.length > 0) {
      return [...headerCfg.navLinks]
        .filter((l) => l.visible)
        .sort((a, b) => (a.sortOrder ?? 99) - (b.sortOrder ?? 99));
    }
    return [
      { id: 'def-shop', label: 'Shop', url: '/shop', visible: true, sortOrder: 1 },
      { id: 'def-shoes', label: 'Shoes', url: '/category/shoes', visible: true, sortOrder: 2 },
      { id: 'def-wears', label: 'Wears', url: '/category/wears', visible: true, sortOrder: 3 },
      { id: 'def-contact', label: 'Contact', url: '/contact', visible: true, sortOrder: 4 },
      { id: 'def-track', label: 'Track Order', url: '/track-order', visible: true, sortOrder: 5 },
    ];
  }, [headerCfg]);

  if (pathname.startsWith('/admin') || pathname.startsWith('/rider')) {
    return null;
  }

  if (headerCfg && headerCfg.visible === false) {
    return null;
  }

  const handleLinkClick = (url: string, openInNewTab?: boolean) => {
    setMobileMenuOpen(false);
    const trimmed = (url || '/').trim();
    if (trimmed === '/shop') setSearchQuery('');
    if (/^https?:\/\//i.test(trimmed)) {
      if (openInNewTab) {
        window.open(trimmed, '_blank', 'noopener,noreferrer');
      } else {
        window.location.href = trimmed;
      }
      return;
    }
    navigate(trimmed);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMobileMenuOpen(false);
    navigate('/shop');
  };

  const storeName = headerCfg?.storeNameDisplay || settings?.storeName || 'Diamond Market';
  const whatsappNumber = settings?.whatsapp || settings?.phone || '07051959290';
  const whatsappUrl = buildWhatsAppUrl(
    whatsappNumber,
    `Hello ${storeName}, I would like to inquire about your collection.`
  );

  const announcementEnabled =
    headerCfg !== undefined
      ? headerCfg.announcementEnabled
      : Boolean(settings?.announcementEnabled);
  const announcementText =
    headerCfg?.announcementText || settings?.announcementBar || '';

  const isSticky = headerCfg?.sticky ?? true;
  const layout = headerCfg?.layout || 'classic_luxury';
  const showSearch = headerCfg?.showSearch ?? true;
  const showWishlist = headerCfg?.showWishlist ?? true;
  const showAccount = headerCfg?.showAccount ?? true;
  const showCart = headerCfg?.showCart ?? true;
  const showWhatsapp = headerCfg?.showWhatsappButton ?? true;
  const showSubBar = (headerCfg?.showCategorySubBar ?? true) && layout !== 'minimal_bar';

  const navItemClass = (active: boolean) =>
    `dm-nav-link text-xs uppercase tracking-[0.14em] font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
      active
        ? 'text-[var(--dm-gold,#C6A15B)]'
        : 'text-neutral-200 hover:text-[var(--dm-gold,#C6A15B)]'
    }`;

  return (
    <header
      className={`no-print ${
        isSticky ? 'sticky top-0' : 'relative'
      } z-40 text-white border-b transition-all duration-300 ${
        scrolled
          ? 'bg-[#111111]/92 backdrop-blur-md border-[var(--dm-gold,#C6A15B)]/25 shadow-lg shadow-black/20'
          : 'bg-[var(--dm-black,#111111)] border-white/10'
      }`}
    >
      {/* Editable Announcement Bar */}
      {announcementEnabled && announcementText && (
        <div
          className={`bg-[#181818] border-b border-[var(--dm-gold,#C6A15B)]/25 text-neutral-100 text-[11px] sm:text-xs tracking-wide px-4 transition-all duration-300 ${
            scrolled && isSticky ? 'py-1.5 opacity-95' : 'py-2'
          }`}
        >
          <div className="dm-container flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5 truncate">
              <span className="text-[var(--dm-gold,#C6A15B)] font-semibold uppercase shrink-0">
                {storeName}
              </span>
              <span className="truncate font-medium">{announcementText}</span>
              {headerCfg?.announcementLinkText && headerCfg?.announcementLinkUrl && (
                <button
                  type="button"
                  onClick={() => handleLinkClick(headerCfg.announcementLinkUrl)}
                  className="hidden sm:inline underline text-[var(--dm-gold,#C6A15B)] hover:text-white font-semibold shrink-0 cursor-pointer transition-colors"
                >
                  {headerCfg.announcementLinkText}
                </button>
              )}
            </div>
            <div className="hidden md:flex items-center gap-5 shrink-0 text-[11px] text-neutral-300">
              <span>{settings?.address || 'Ogbomoso, Oyo State, Nigeria'}</span>
              <a
                href={`tel:${settings?.phone || '07051959290'}`}
                className="hover:text-[var(--dm-gold,#C6A15B)] transition-colors font-mono-num"
              >
                {settings?.phone || '07051959290'}
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Main Single-Row Luxury Header */}
      <div
        className={`dm-container px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4 transition-[height] duration-300 ${
          scrolled && isSticky ? 'h-14 sm:h-16' : 'h-16 sm:h-20'
        }`}
      >
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            className="lg:hidden p-2.5 -ml-2 rounded-lg text-neutral-200 hover:text-[var(--dm-gold,#C6A15B)] hover:bg-white/5 transition-colors cursor-pointer"
            aria-label="Toggle Menu"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <button
            type="button"
            onClick={() => navigate('/')}
            className="focus:outline-none cursor-pointer transition-transform duration-200 active:scale-[0.98]"
            aria-label={`${storeName} Home`}
          >
            <BrandLogo
              variant="dark"
              compact
              storeName={storeName}
              subtext={headerCfg?.subtext || 'SHOES & WEARS'}
              showSubtext={headerCfg?.showSubtext ?? true}
              logoUrl={headerCfg?.logoUrl || ''}
            />
          </button>
        </div>

        {/* Desktop Primary Navigation (Dynamic & Single-Row) */}
        <nav
          className={`hidden lg:flex items-center gap-6 shrink-0 ${
            layout === 'centered_brand' ? 'mx-auto' : ''
          }`}
          aria-label="Main Navigation"
        >
          {navLinks.map((lnk) => {
            const cleanUrl = lnk.url.split('?')[0];
            const active =
              pathname === cleanUrl || (cleanUrl !== '/' && pathname.startsWith(`${cleanUrl}/`));
            return (
              <button
                key={lnk.id}
                type="button"
                data-active={active ? 'true' : 'false'}
                onClick={() => handleLinkClick(lnk.url, lnk.openInNewTab)}
                className={navItemClass(active)}
              >
                {lnk.label}
              </button>
            );
          })}
        </nav>

        {/* Interactive Search Input */}
        {showSearch && layout !== 'minimal_bar' && (
          <form
            onSubmit={handleSearchSubmit}
            className={`hidden md:flex flex-1 relative transition-all duration-300 ${
              searchFocused ? 'max-w-sm xl:max-w-md' : 'max-w-xs xl:max-w-sm'
            }`}
          >
            <Search
              className={`w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none transition-colors ${
                searchFocused ? 'text-[var(--dm-gold,#C6A15B)]' : 'text-neutral-400'
              }`}
            />
            <input
              type="search"
              value={searchQuery}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search shoes, wears, loafers..."
              className="w-full h-10 pl-10 pr-4 rounded-full bg-white/10 border border-white/15 text-xs text-white placeholder:text-neutral-400 focus:outline-none focus:bg-white/15 focus:border-[var(--dm-gold,#C6A15B)] transition-all"
            />
          </form>
        )}

        {/* Utility Icons */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {isAdmin && (
            <button
              type="button"
              onClick={() => navigate('/admin')}
              className="dm-btn-interactive hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 dm-btn-shape bg-[var(--dm-gold,#C6A15B)] text-[var(--dm-black,#111111)] text-[11px] font-bold uppercase tracking-wider hover:opacity-90 cursor-pointer whitespace-nowrap"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              Admin
            </button>
          )}

          {showWhatsapp && (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="dm-btn-interactive hidden xl:inline-flex items-center gap-1.5 px-3 py-1.5 dm-btn-shape border border-[var(--dm-gold,#C6A15B)]/45 text-xs font-medium text-[var(--dm-gold,#C6A15B)] hover:bg-[var(--dm-gold,#C6A15B)]/10 whitespace-nowrap"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              WhatsApp
            </a>
          )}

          {showWishlist && (
            <button
              type="button"
              onClick={() => navigate('/wishlist')}
              className="relative p-2.5 rounded-full text-neutral-200 hover:text-[var(--dm-gold,#C6A15B)] hover:bg-white/5 transition-all active:scale-95 cursor-pointer"
              aria-label="Wishlist"
            >
              <Heart className="w-5 h-5" />
              {wishlistIds.length > 0 && (
                <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-[var(--dm-gold,#C6A15B)] text-[var(--dm-black,#111111)] text-[10px] font-bold flex items-center justify-center font-mono-num">
                  {wishlistIds.length}
                </span>
              )}
            </button>
          )}

          {showAccount && (
            <button
              type="button"
              onClick={() => navigate(user ? '/account' : '/auth')}
              className="p-2.5 rounded-full text-neutral-200 hover:text-[var(--dm-gold,#C6A15B)] hover:bg-white/5 transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
              aria-label={user ? 'Customer Account' : 'Sign In'}
            >
              <User className="w-5 h-5" />
              <span className="hidden xl:inline text-xs font-medium text-neutral-200 max-w-[90px] truncate">
                {user ? user.displayName?.split(' ')[0] || 'Account' : 'Sign In'}
              </span>
            </button>
          )}

          {showCart && (
            <button
              type="button"
              onClick={() => setIsCartOpen(true)}
              className={`dm-btn-interactive relative inline-flex items-center gap-2 ml-1 px-3.5 py-2 dm-btn-shape bg-[var(--dm-gold,#C6A15B)] hover:opacity-95 text-[var(--dm-black,#111111)] text-xs font-bold uppercase tracking-wider cursor-pointer ${
                cartBump ? 'dm-cart-bump' : ''
              }`}
              aria-label="Open Shopping Bag"
            >
              <ShoppingBag className="w-4 h-4" />
              <span className="hidden sm:inline">Bag</span>
              <span className="min-w-5 h-5 px-1 rounded-full bg-[var(--dm-black,#111111)] text-white text-[10px] font-bold flex items-center justify-center font-mono-num">
                {cartCount}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Curated Category Sub-Bar */}
      {showSubBar && (
        <div className="hidden lg:block bg-[var(--dm-ivory,#FAF8F3)]/95 text-[var(--dm-black,#111111)] border-t border-[#E8E8E8]">
          <div className="dm-container px-4 sm:px-6 lg:px-8 h-10 flex items-center justify-between text-xs">
            <div className="flex items-center gap-6 overflow-x-auto">
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  navigate('/shop');
                }}
                className={`whitespace-nowrap font-semibold transition-colors cursor-pointer ${
                  pathname === '/shop'
                    ? 'text-[var(--dm-gold,#C6A15B)]'
                    : 'text-[#333333] hover:text-[var(--dm-black,#111111)]'
                }`}
              >
                All Collections
              </button>
              {visibleCategories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => navigate(`/category/${cat.slug}`)}
                  className={`whitespace-nowrap transition-colors cursor-pointer ${
                    pathname === `/category/${cat.slug}`
                      ? 'font-semibold text-[var(--dm-gold,#C6A15B)]'
                      : 'text-[#333333] hover:text-[var(--dm-black,#111111)]'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
            <span className="text-[11px] text-[#333333]/80 whitespace-nowrap">
              Paystack · Flutterwave · Transfer · Cash on Delivery
            </span>
          </div>
        </div>
      )}

      {/* Animated Mobile Drawer Navigation */}
      {mobileMenuOpen && (
        <div className="dm-drawer-down lg:hidden bg-[#161616] border-t border-white/10 px-4 py-5 space-y-4 shadow-2xl">
          {showSearch && (
            <form onSubmit={handleSearchSubmit} className="relative">
              <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search shoes, wears, accessories..."
                className="w-full h-11 pl-10 pr-4 rounded-full bg-white/10 border border-white/15 text-sm text-white placeholder:text-neutral-400 focus:outline-none focus:border-[var(--dm-gold,#C6A15B)]"
              />
            </form>
          )}

          <div className="grid grid-cols-2 gap-2 text-sm">
            {navLinks.map((lnk) => (
              <button
                key={lnk.id}
                type="button"
                onClick={() => handleLinkClick(lnk.url, lnk.openInNewTab)}
                className="text-left px-3.5 py-3 rounded-xl bg-white/5 text-neutral-100 font-medium hover:text-[var(--dm-gold,#C6A15B)] active:scale-[0.98] transition-all cursor-pointer"
              >
                {lnk.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-white/10">
            {topCategories.slice(0, 6).map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  navigate(`/category/${cat.slug}`);
                  setMobileMenuOpen(false);
                }}
                className="text-left px-3.5 py-2.5 rounded-xl bg-white/5 text-neutral-300 hover:text-[var(--dm-gold,#C6A15B)] active:scale-[0.98] transition-all cursor-pointer"
              >
                {cat.name}
              </button>
            ))}
          </div>

          <div className="pt-3 border-t border-white/10 flex flex-wrap items-center gap-4 text-xs">
            <button
              type="button"
              onClick={() => {
                navigate(user ? '/account' : '/auth');
                setMobileMenuOpen(false);
              }}
              className="text-neutral-200 hover:text-[var(--dm-gold,#C6A15B)] font-medium py-1"
            >
              {user ? 'My Account' : 'Sign In'}
            </button>
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-[var(--dm-gold,#C6A15B)] font-semibold py-1"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              WhatsApp: {whatsappNumber}
            </a>
            {isAdmin && (
              <button
                type="button"
                onClick={() => {
                  navigate('/admin');
                  setMobileMenuOpen(false);
                }}
                className="text-[var(--dm-gold,#C6A15B)] font-bold py-1"
              >
                Admin Dashboard
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
