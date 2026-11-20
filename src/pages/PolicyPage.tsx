import { MessageCircle } from 'lucide-react';
import React from 'react';
import { useStore } from '../context/StoreContext.tsx';
import { buildWhatsAppUrl, sanitizeHtml } from '../utils/sanitizeHtml.ts';

export function PolicyPage({ type }: { type: string }) {
  const { settings, cmsPages, navigate } = useStore();

  const slugMap: Record<string, string> = {
    terms: 'terms-and-conditions',
    privacy: 'privacy-policy',
    returns: 'return-policy',
    shipping: 'delivery-information',
  };

  const cmsMatch = cmsPages.find((p) => p.slug === slugMap[type]);

  const contentMap: Record<string, { title: string; body: string }> = {
    terms: {
      title: 'Terms & Conditions',
      body: settings?.termsText || '',
    },
    privacy: {
      title: 'Privacy Policy',
      body: settings?.privacyText || '',
    },
    returns: {
      title: 'Return & Refund Policy',
      body: `${settings?.returnPolicyText || ''}\n\n${settings?.refundPolicyText || ''}`.trim(),
    },
    shipping: {
      title: 'Shipping & Delivery Policy',
      body: settings?.shippingPolicyText || '',
    },
  };

  const doc = contentMap[type] || contentMap.terms;
  const pageTitle = cmsMatch?.title || doc.title;
  const whatsappUrl = buildWhatsAppUrl(
    settings?.whatsapp || settings?.phone || '07051959290',
    `Hello ${settings?.storeName || 'Diamond Market'}, I have a question regarding your ${pageTitle}.`
  );

  return (
    <div className="bg-white min-h-[65vh] py-12">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 space-y-6">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="text-xs font-semibold uppercase tracking-wider text-[#8C6D34] hover:text-[var(--dm-black,#111111)] cursor-pointer"
        >
          ← Back to {settings?.storeName || 'Diamond Market'}
        </button>
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-[var(--dm-black,#111111)]">
          {pageTitle}
        </h1>
        {cmsMatch?.subtitle && (
          <p className="text-sm text-[#333333]/85 leading-relaxed">{cmsMatch.subtitle}</p>
        )}
        <div className="bg-[var(--dm-ivory,#FAF8F3)] border border-[#E8E8E8] dm-card-shape p-6 sm:p-9 text-sm text-[#333333] leading-relaxed">
          {cmsMatch?.contentHtml ? (
            <div
              className="dm-prose"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(cmsMatch.contentHtml) }}
            />
          ) : (
            <div className="whitespace-pre-line">
              {doc.body ||
                `Policy details are being updated. Please contact ${
                  settings?.storeName || 'Diamond Market'
                } for clarification.`}
            </div>
          )}
        </div>
        <div className="flex items-center justify-between flex-wrap gap-3 pt-2 text-xs text-[#333333]">
          <span>
            {settings?.storeName || 'Diamond Market'} · {settings?.address || 'Ogbomoso, Oyo State, Nigeria'}
          </span>
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 font-semibold text-[#111111] hover:text-[#8C6D34]"
          >
            <MessageCircle className="w-4 h-4 text-[#25D366]" />
            Ask Support on WhatsApp ({settings?.phone || '07051959290'})
          </a>
        </div>
      </div>
    </div>
  );
}
