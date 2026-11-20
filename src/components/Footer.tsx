import { ArrowRight, Mail, MapPin, MessageCircle, Phone } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useStore } from '../context/StoreContext.tsx';
import { apiFetch } from '../lib/api.ts';
import type { CmsFooterColumn } from '../types/commerce.ts';
import { buildWhatsAppUrl } from '../utils/sanitizeHtml.ts';
import { BrandLogo } from './BrandLogo.tsx';

export function Footer() {
  const { pathname, navigate, settings, categories, cms, pushToast } = useStore();
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const footerCfg = cms?.footer;

  const fallbackColumns = useMemo<CmsFooterColumn[]>(() => {
    const visibleCats = [...categories]
      .filter((c) => c.visible !== false)
      .sort((a, b) => (a.sortOrder ?? 99) - (b.sortOrder ?? 99))
      .slice(0, 5);
    return [
      {
        id: 'fb-collections',
        title: 'Collections',
        visible: true,
        links: [
          { id: 'fb-all', label: 'All Collections', url: '/shop', visible: true, sortOrder: 1 },
          ...visibleCats.map((c, idx) => ({
            id: c.id,
            label: c.name,
            url: `/category/${c.slug}`,
            visible: true,
            sortOrder: idx + 2,
          })),
        ],
      },
      {
        id: 'fb-care',
        title: 'Customer Care',
        visible: true,
        links: [
          { id: 'fb-about', label: 'About Us', url: '/about', visible: true, sortOrder: 1 },
          { id: 'fb-contact', label: 'Contact Us', url: '/contact', visible: true, sortOrder: 2 },
          { id: 'fb-faq', label: 'FAQ', url: '/faq', visible: true, sortOrder: 3 },
          { id: 'fb-track', label: 'Track Order', url: '/track-order', visible: true, sortOrder: 4 },
          { id: 'fb-delivery', label: 'Delivery Info', url: '/delivery-information', visible: true, sortOrder: 5 },
          { id: 'fb-rider', label: 'Rider Dispatch Portal', url: '/rider', visible: true, sortOrder: 6 },
        ],
      },
      {
        id: 'fb-legal',
        title: 'Policies & Legal',
        visible: true,
        links: [
          { id: 'fb-returns', label: 'Return Policy', url: '/return-policy', visible: true, sortOrder: 1 },
          { id: 'fb-terms', label: 'Terms & Conditions', url: '/terms-and-conditions', visible: true, sortOrder: 2 },
          { id: 'fb-privacy', label: 'Privacy Policy', url: '/privacy-policy', visible: true, sortOrder: 3 },
        ],
      },
    ];
  }, [categories]);

  if (pathname.startsWith('/admin') || pathname.startsWith('/rider')) return null;
  if (footerCfg && footerCfg.visible === false) return null;

  const storeName = cms?.header?.storeNameDisplay || settings?.storeName || 'Diamond Market';
  const phone = footerCfg?.phone || settings?.phone || '07051959290';
  const email = footerCfg?.email || settings?.storeEmail || 'orders@diamondmarket.ng';
  const address = footerCfg?.address || settings?.address || 'Ogbomoso, Oyo State, Nigeria';
  const whatsapp = footerCfg?.socialLinks?.whatsapp || settings?.whatsapp || phone;
  const whatsappUrl = buildWhatsAppUrl(
    whatsapp,
    `Hello ${storeName}, I would like to connect with your team.`
  );

  const styleVariant = footerCfg?.style || 'obsidian_dark';
  const isLight = styleVariant === 'ivory_light';
  const bgClass =
    styleVariant === 'ivory_light'
      ? 'bg-[var(--dm-ivory,#FAF8F3)] text-[#333333] border-t border-[#E8E8E8]'
      : styleVariant === 'charcoal_editorial'
      ? 'bg-[#1D1D1F] text-neutral-300 border-t border-[var(--dm-gold,#C6A15B)]/25'
      : 'bg-[var(--dm-black,#111111)] text-neutral-300 border-t border-[var(--dm-gold,#C6A15B)]/25';

  const headingColor = isLight ? 'text-[#111111]' : 'text-white';
  const mutedText = isLight ? 'text-[#333333]/75' : 'text-neutral-400';
  const borderSubtle = isLight ? 'border-[#E8E8E8]' : 'border-white/10';

  const columns = (footerCfg?.columns && footerCfg.columns.length > 0
    ? footerCfg.columns
    : fallbackColumns
  ).filter((c) => c.visible);

  const handleLinkClick = (url: string, openInNewTab?: boolean) => {
    const clean = (url || '/').trim();
    if (/^https?:\/\//i.test(clean)) {
      if (openInNewTab) {
        window.open(clean, '_blank', 'noopener,noreferrer');
      } else {
        window.location.href = clean;
      }
      return;
    }
    navigate(clean);
  };

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newsletterEmail.trim() || !newsletterEmail.includes('@')) {
      pushToast('Please enter a valid email address.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await apiFetch('/api/newsletter', {
        method: 'POST',
        body: JSON.stringify({ email: newsletterEmail.trim() }),
      });
      pushToast(`Welcome to the ${storeName} style circle.`, 'success');
      setNewsletterEmail('');
    } catch {
      pushToast(`Subscribed to ${storeName} updates.`, 'success');
      setNewsletterEmail('');
    } finally {
      setSubmitting(false);
    }
  };

  const showNewsletter = footerCfg?.showNewsletter ?? true;
  const showContactInfo = footerCfg?.showContactInfo ?? true;
  const showPaymentBadges = footerCfg?.showPaymentBadges ?? true;

  return (
    <footer className={`no-print mt-20 ${bgClass}`}>
      {/* Editable Editorial Newsletter Bar */}
      {showNewsletter && (
        <div className={`border-b ${borderSubtle}`}>
          <div className="dm-container px-4 sm:px-6 lg:px-8 py-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--dm-gold,#C6A15B)] font-semibold mb-1">
                {footerCfg?.newsletterEyebrow || 'Diamond Style Dispatch'}
              </p>
              <h3 className={`font-display text-2xl font-semibold ${headingColor}`}>
                {footerCfg?.newsletterTitle || 'Receive new footwear drops & seasonal wear arrivals'}
              </h3>
              <p className={`text-sm mt-1 ${mutedText}`}>
                {footerCfg?.newsletterSubtitle ||
                  `Curated collections from ${address} delivered nationwide.`}
              </p>
            </div>
            <form onSubmit={handleSubscribe} className="flex w-full lg:w-auto gap-2.5">
              <input
                type="email"
                value={newsletterEmail}
                onChange={(e) => setNewsletterEmail(e.target.value)}
                placeholder="Enter your email address"
                className={`flex-1 lg:w-72 h-11 px-4 rounded-full border text-sm focus:outline-none focus:border-[var(--dm-gold,#C6A15B)] ${
                  isLight
                    ? 'bg-white border-[#E8E8E8] text-[#111111] placeholder:text-neutral-400'
                    : 'bg-white/10 border-white/15 text-white placeholder:text-neutral-400'
                }`}
              />
              <button
                type="submit"
                disabled={submitting}
                className="h-11 px-6 dm-btn-shape bg-[var(--dm-gold,#C6A15B)] hover:opacity-90 text-[var(--dm-black,#111111)] text-xs font-bold uppercase tracking-wider inline-flex items-center gap-1.5 transition-opacity shrink-0 cursor-pointer"
              >
                {footerCfg?.newsletterButtonText || 'Join'} <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Main Dynamic Footer Grid */}
      <div className="dm-container px-4 sm:px-6 lg:px-8 py-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 text-sm">
        <div className="space-y-4">
          <BrandLogo
            variant={isLight ? 'light' : 'dark'}
            storeName={storeName}
            logoUrl={footerCfg?.logoUrl || cms?.header?.logoUrl || ''}
            subtext={cms?.header?.subtext || 'SHOES & WEARS'}
          />
          <p className={`leading-relaxed text-xs ${mutedText}`}>
            {footerCfg?.aboutText ||
              settings?.footerTagline ||
              settings?.tagline ||
              'Classic footwear, tailored wears & timeless fashion essentials.'}
          </p>
          {showContactInfo && (
            <div className={`space-y-2.5 text-xs pt-1 ${isLight ? 'text-[#333333]' : 'text-neutral-300'}`}>
              <p className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-[var(--dm-gold,#C6A15B)] shrink-0 mt-0.5" />
                <span>{address}</span>
              </p>
              <p className="flex items-center gap-2.5">
                <Phone className="w-4 h-4 text-[var(--dm-gold,#C6A15B)] shrink-0" />
                <a
                  href={`tel:${phone}`}
                  className="hover:text-[var(--dm-gold,#C6A15B)] transition-colors font-mono-num"
                >
                  {phone}
                </a>
              </p>
              {email && (
                <p className="flex items-center gap-2.5">
                  <Mail className="w-4 h-4 text-[var(--dm-gold,#C6A15B)] shrink-0" />
                  <a
                    href={`mailto:${email}`}
                    className="hover:text-[var(--dm-gold,#C6A15B)] transition-colors"
                  >
                    {email}
                  </a>
                </p>
              )}
              <p className="flex items-center gap-2.5">
                <MessageCircle className="w-4 h-4 text-[var(--dm-gold,#C6A15B)] shrink-0" />
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-[var(--dm-gold,#C6A15B)] transition-colors"
                >
                  WhatsApp: <span className="font-mono-num">{whatsapp}</span>
                </a>
              </p>
            </div>
          )}

          {/* Social Links */}
          <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] font-semibold">
            {footerCfg?.socialLinks?.instagram && (
              <a
                href={footerCfg.socialLinks.instagram}
                target="_blank"
                rel="noreferrer"
                className="text-[var(--dm-gold,#C6A15B)] hover:underline"
              >
                Instagram
              </a>
            )}
            {footerCfg?.socialLinks?.twitter && (
              <a
                href={footerCfg.socialLinks.twitter}
                target="_blank"
                rel="noreferrer"
                className="text-[var(--dm-gold,#C6A15B)] hover:underline"
              >
                X / Twitter
              </a>
            )}
            {footerCfg?.socialLinks?.facebook && (
              <a
                href={footerCfg.socialLinks.facebook}
                target="_blank"
                rel="noreferrer"
                className="text-[var(--dm-gold,#C6A15B)] hover:underline"
              >
                Facebook
              </a>
            )}
          </div>
        </div>

        {columns.map((col, idx) => (
          <div key={col.id}>
            <h4 className={`font-semibold text-xs uppercase tracking-[0.18em] mb-4 ${headingColor}`}>
              {col.title}
            </h4>
            <ul className={`space-y-2.5 text-xs ${mutedText}`}>
              {col.links
                .filter((l) => l.visible)
                .sort((a, b) => (a.sortOrder ?? 99) - (b.sortOrder ?? 99))
                .map((lnk) => (
                  <li key={lnk.id}>
                    <button
                      type="button"
                      onClick={() => handleLinkClick(lnk.url, lnk.openInNewTab)}
                      className="hover:text-[var(--dm-gold,#C6A15B)] transition-colors text-left cursor-pointer"
                    >
                      {lnk.label}
                    </button>
                  </li>
                ))}
            </ul>

            {idx === columns.length - 1 && showPaymentBadges && (
              <div className="mt-6">
                <p className={`text-[11px] uppercase tracking-[0.16em] font-semibold mb-2.5 ${mutedText}`}>
                  Accepted Naira (₦) Methods
                </p>
                <div className="flex flex-wrap gap-1.5 text-[11px]">
                  {['Paystack', 'Flutterwave', 'Bank Transfer', 'Pay on Delivery'].map((pm) => (
                    <span
                      key={pm}
                      className={`px-2.5 py-1 rounded border ${
                        isLight
                          ? 'border-[#E8E8E8] bg-white text-[#111111]'
                          : 'border-white/15 bg-white/5 text-neutral-200'
                      }`}
                    >
                      {pm}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className={`border-t ${borderSubtle}`}>
        <div
          className={`dm-container px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs ${mutedText}`}
        >
          <span>
            {footerCfg?.copyrightText ||
              `© ${new Date().getFullYear()} ${storeName}. Shoes & Wears — Nigeria.`}
          </span>
          <span>
            {address} · {phone}
          </span>
        </div>
      </div>
    </footer>
  );
}
