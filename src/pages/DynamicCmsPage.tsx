import { ArrowLeft, ChevronDown, ChevronUp, MessageCircle, ShoppingBag } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useStore } from '../context/StoreContext.tsx';
import { apiFetch } from '../lib/api.ts';
import type { CmsPage } from '../types/commerce.ts';
import { buildWhatsAppUrl, sanitizeHtml } from '../utils/sanitizeHtml.ts';

interface DynamicCmsPageProps {
  slug: string;
}

export function DynamicCmsPage({ slug }: DynamicCmsPageProps) {
  const { cmsPages, settings, navigate, isPreviewMode } = useStore();
  const [fetchedPage, setFetchedPage] = useState<CmsPage | null>(null);
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [openFaqId, setOpenFaqId] = useState<string | null>(null);

  const normalizedSlug = slug.replace(/^\/+/, '').toLowerCase();
  const contextMatch = cmsPages.find(
    (p) => p.slug.toLowerCase() === normalizedSlug && (isPreviewMode || (p.status === 'published' && p.visible))
  );

  useEffect(() => {
    if (contextMatch) {
      setFetchedPage(contextMatch);
      setNotFound(false);
      if (contextMatch.faqItems && contextMatch.faqItems.length > 0 && !openFaqId) {
        setOpenFaqId(contextMatch.faqItems[0].id);
      }
      return;
    }

    if (isPreviewMode) {
      setFetchedPage(null);
      setNotFound(true);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    apiFetch<{ page: CmsPage }>(`/api/pages/${encodeURIComponent(normalizedSlug)}`)
      .then((res) => {
        if (cancelled) return;
        setFetchedPage(res.page);
        if (res.page.faqItems && res.page.faqItems.length > 0) {
          setOpenFaqId(res.page.faqItems[0].id);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFetchedPage(null);
          setNotFound(true);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [normalizedSlug, contextMatch, isPreviewMode]);

  const activePage = contextMatch || fetchedPage;
  const whatsappUrl = buildWhatsAppUrl(
    settings?.whatsapp || settings?.phone || '07051959290',
    `Hello ${settings?.storeName || 'Diamond Market'}, I am reaching out from your ${
      activePage?.title || normalizedSlug
    } page.`
  );

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center bg-white">
        <div className="w-7 h-7 border-2 border-[var(--dm-black,#111111)] border-t-[var(--dm-gold,#C6A15B)] rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound || !activePage) {
    return (
      <div className="min-h-[65vh] bg-white flex items-center justify-center px-4 py-16">
        <div className="max-w-md w-full bg-[var(--dm-ivory,#FAF8F3)] border border-[#E8E8E8] dm-card-shape p-8 text-center space-y-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#8C6D34]">
            Page Unavailable
          </p>
          <h1 className="font-display text-3xl font-bold text-[var(--dm-black,#111111)]">
            404 — Page Not Found
          </h1>
          <p className="text-sm text-[#333333]">
            The page “/{normalizedSlug}” either does not exist or is currently saved as a private draft.
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="px-6 py-2.5 dm-btn-shape bg-[var(--dm-black,#111111)] text-white text-xs font-bold uppercase tracking-wider cursor-pointer"
            >
              Return Home
            </button>
            <button
              type="button"
              onClick={() => navigate('/shop')}
              className="px-6 py-2.5 dm-btn-shape border border-[#E8E8E8] bg-white text-[var(--dm-black,#111111)] text-xs font-semibold uppercase tracking-wider cursor-pointer"
            >
              Browse Shop
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white min-h-[70vh]">
      {/* Page Hero */}
      <section className="bg-[var(--dm-ivory,#FAF8F3)] border-b border-[#E8E8E8]">
        <div className="dm-container px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#8C6D34] hover:text-[var(--dm-black,#111111)] mb-5 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Storefront
          </button>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className={activePage.heroImageUrl ? 'lg:col-span-7 space-y-4' : 'lg:col-span-9 space-y-4'}>
              {activePage.eyebrow && (
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#8C6D34]">
                  {activePage.eyebrow}
                </p>
              )}
              <h1 className="font-display text-3xl sm:text-5xl font-bold text-[var(--dm-black,#111111)] leading-tight">
                {activePage.title}
              </h1>
              {activePage.subtitle && (
                <p className="text-base sm:text-lg text-[#333333] leading-relaxed">
                  {activePage.subtitle}
                </p>
              )}
              {isPreviewMode && activePage.status === 'draft' && (
                <p className="text-xs font-bold uppercase tracking-wider text-amber-700">
                  Previewing Draft Page (Not Yet Published)
                </p>
              )}
            </div>

            {activePage.heroImageUrl && (
              <div className="lg:col-span-5">
                <div className="dm-card-shape overflow-hidden border border-[#E8E8E8] shadow-lg aspect-[16/10] bg-white">
                  <img
                    src={activePage.heroImageUrl}
                    alt={activePage.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 space-y-10">
        {activePage.contentHtml && (
          <div
            className="dm-prose text-sm sm:text-base text-[#333333] leading-relaxed"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(activePage.contentHtml) }}
          />
        )}

        {/* Interactive FAQ Accordion when FAQ items exist */}
        {activePage.faqItems && activePage.faqItems.length > 0 && (
          <div className="space-y-3 pt-2">
            <h2 className="font-display text-2xl font-bold text-[var(--dm-black,#111111)] mb-4">
              Common Questions &amp; Answers
            </h2>
            {activePage.faqItems.map((item) => {
              const isOpen = openFaqId === item.id;
              return (
                <div
                  key={item.id}
                  className="dm-card-shape border border-[#E8E8E8] bg-[var(--dm-ivory,#FAF8F3)] overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaqId(isOpen ? null : item.id)}
                    className="w-full px-6 py-4 flex items-center justify-between gap-4 text-left font-display font-semibold text-base text-[var(--dm-black,#111111)] cursor-pointer"
                  >
                    <span>{item.question}</span>
                    {isOpen ? (
                      <ChevronUp className="w-4 h-4 text-[var(--dm-gold,#C6A15B)] shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-[#333333] shrink-0" />
                    )}
                  </button>
                  {isOpen && (
                    <div className="px-6 pb-5 text-sm text-[#333333] leading-relaxed border-t border-[#E8E8E8]/70 pt-3 bg-white">
                      {item.answer}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Footer Assistance Bar */}
        <div className="dm-card-shape bg-[var(--dm-ivory,#FAF8F3)] border border-[#E8E8E8] p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-display text-xl font-bold text-[var(--dm-black,#111111)]">
              Need Personal Assistance?
            </h3>
            <p className="text-xs text-[#333333] mt-1">
              Reach {settings?.storeName || 'Diamond Market'} on WhatsApp or explore our catalog directly.
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5 shrink-0">
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="h-10 px-5 dm-btn-shape bg-[var(--dm-black,#111111)] text-white text-xs font-bold uppercase tracking-wider inline-flex items-center gap-2 hover:opacity-90"
            >
              <MessageCircle className="w-4 h-4 text-[var(--dm-gold,#C6A15B)]" />
              WhatsApp Support
            </a>
            <button
              type="button"
              onClick={() => navigate('/shop')}
              className="h-10 px-5 dm-btn-shape border border-[#E8E8E8] bg-white text-[var(--dm-black,#111111)] text-xs font-semibold uppercase tracking-wider inline-flex items-center gap-1.5 hover:border-[var(--dm-gold,#C6A15B)] cursor-pointer"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              Shop Collection
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
