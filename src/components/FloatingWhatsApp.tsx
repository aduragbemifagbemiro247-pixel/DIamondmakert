import { MessageCircle } from 'lucide-react';
import React from 'react';
import { useStore } from '../context/StoreContext.tsx';
import { buildWhatsAppUrl } from '../utils/sanitizeHtml.ts';

export function FloatingWhatsApp() {
  const { pathname, settings } = useStore();

  // Keep Admin and Rider portals uncluttered
  if (pathname.startsWith('/admin') || pathname.startsWith('/rider')) return null;

  const whatsappNumber = settings?.whatsapp || settings?.phone || '07051959290';
  const href = buildWhatsAppUrl(
    whatsappNumber,
    'Hello Diamond Market, I would like assistance with shoes and wears.'
  );

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label="Chat with Diamond Market on WhatsApp"
      className="no-print fixed bottom-5 right-5 z-40 group inline-flex items-center gap-2.5 bg-[#111111] hover:bg-[#1E1E1E] text-white border border-[#C6A15B]/50 rounded-full pl-3.5 pr-4 py-2.5 shadow-xl shadow-black/25 transition-all duration-200 hover:-translate-y-0.5"
    >
      <span className="w-7 h-7 rounded-full bg-[#25D366] text-white flex items-center justify-center shrink-0">
        <MessageCircle className="w-4 h-4" />
      </span>
      <span className="flex flex-col leading-tight text-left">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-[#C6A15B]">
          WhatsApp Concierge
        </span>
        <span className="text-xs font-medium text-white hidden sm:inline">
          Chat · {whatsappNumber}
        </span>
        <span className="text-xs font-medium text-white sm:hidden">Chat Now</span>
      </span>
    </a>
  );
}
