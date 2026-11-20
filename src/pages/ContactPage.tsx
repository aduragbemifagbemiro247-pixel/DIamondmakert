import { ArrowRight, Clock, Gem, Mail, MapPin, MessageCircle, Phone, Send } from 'lucide-react';
import React, { useState } from 'react';
import { BrandLogo } from '../components/BrandLogo.tsx';
import { useStore } from '../context/StoreContext.tsx';
import { buildWhatsAppUrl, sanitizeHtml } from '../utils/sanitizeHtml.ts';

export function ContactPage() {
  const { settings, cmsPages, navigate, pushToast } = useStore();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [subject, setSubject] = useState('Sizing or Product Inquiry');
  const [message, setMessage] = useState('');

  const cmsContact = cmsPages.find((p) => p.slug === 'contact');

  const storePhone = settings?.phone || '07051959290';
  const storeWhatsapp = settings?.whatsapp || storePhone;
  const storeLocation = settings?.address || 'Ogbomoso, Oyo State, Nigeria';
  const storeEmail = settings?.storeEmail || 'hello@diamondmarket.ng';

  const handleSendWhatsApp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !message.trim()) {
      pushToast('Please enter your name and message first.', 'error');
      return;
    }
    const composed = `Hello ${settings?.storeName || 'Diamond Market'},\nName: ${name.trim()}\nPhone: ${
      phone.trim() || 'Not provided'
    }\nTopic: ${subject}\nMessage: ${message.trim()}`;
    const url = buildWhatsAppUrl(storeWhatsapp, composed);
    window.open(url, '_blank', 'noopener,noreferrer');
    pushToast(`Opening WhatsApp conversation with ${settings?.storeName || 'Diamond Market'}...`, 'success');
  };

  return (
    <div className="bg-white">
      {/* Header Banner */}
      <section className="bg-[var(--dm-ivory,#FAF8F3)] border-b border-[#E8E8E8]">
        <div className="dm-container px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <div className="max-w-3xl space-y-4">
            <BrandLogo variant="light" compact storeName={settings?.storeName || 'DIAMOND MARKET'} />
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#8C6D34] pt-2">
              {cmsContact?.eyebrow || 'Contact & Brand Story'}
            </p>
            <h1 className="font-display text-4xl sm:text-5xl font-bold text-[var(--dm-black,#111111)] leading-tight">
              {cmsContact?.title || 'Always Within Reach in Ogbomoso & Nationwide'}
            </h1>
            <p className="text-base text-[#333333] leading-relaxed">
              {cmsContact?.subtitle ||
                settings?.aboutUsText ||
                'Diamond Market specializes in curated footwear, tailored two-piece sets, casualwear, and refined fashion accessories from Ogbomoso, Oyo State, Nigeria.'}
            </p>
            {cmsContact?.contentHtml && (
              <div
                className="dm-prose text-sm text-[#333333]"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(cmsContact.contentHtml) }}
              />
            )}
          </div>
        </div>
      </section>

      {/* Contact Details + WhatsApp Concierge Form */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-5 space-y-6">
          <div className="rounded-3xl bg-[#111111] text-white p-8 space-y-6 border border-[#C6A15B]/30">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-[#C6A15B] font-semibold">
                Official Store Information
              </p>
              <h2 className="font-display text-2xl font-bold mt-1">Diamond Market</h2>
              <p className="text-xs text-neutral-400 mt-1">Shoes &amp; Wears · Nigeria (NGN / ₦)</p>
            </div>

            <div className="space-y-4 text-sm">
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-[#C6A15B] shrink-0 mt-0.5" />
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-neutral-400">Location</p>
                  <p className="font-semibold text-white">{storeLocation}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Phone className="w-5 h-5 text-[#C6A15B] shrink-0 mt-0.5" />
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-neutral-400">Phone</p>
                  <a
                    href={`tel:${storePhone}`}
                    className="font-mono-num font-bold text-white hover:text-[#C6A15B]"
                  >
                    {storePhone}
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <MessageCircle className="w-5 h-5 text-[#25D366] shrink-0 mt-0.5" />
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-neutral-400">WhatsApp</p>
                  <a
                    href={buildWhatsAppUrl(
                      storeWhatsapp,
                      'Hello Diamond Market, I would like to speak with customer support.'
                    )}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono-num font-bold text-[#C6A15B] hover:underline"
                  >
                    {storeWhatsapp} (Instant Chat)
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Mail className="w-5 h-5 text-[#C6A15B] shrink-0 mt-0.5" />
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-neutral-400">Email</p>
                  <a href={`mailto:${storeEmail}`} className="text-white hover:text-[#C6A15B]">
                    {storeEmail}
                  </a>
                </div>
              </div>

              {settings?.businessHours?.trim() && (
                <div className="flex items-start gap-3">
                  <Clock className="w-5 h-5 text-[#C6A15B] shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-neutral-400">
                      Business Hours
                    </p>
                    <p className="text-white">{settings.businessHours}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-white/10 flex flex-wrap gap-3">
              <a
                href={buildWhatsAppUrl(
                  storeWhatsapp,
                  'Hello Diamond Market, I need help with an order or sizing.'
                )}
                target="_blank"
                rel="noreferrer"
                className="flex-1 h-11 px-5 rounded-full bg-[#C6A15B] hover:bg-[#b58f48] text-[#111111] text-xs font-bold uppercase tracking-wider inline-flex items-center justify-center gap-2 transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
                Chat on WhatsApp
              </a>
              <button
                type="button"
                onClick={() => navigate('/shop')}
                className="h-11 px-5 rounded-full border border-white/25 hover:border-[#C6A15B] text-white text-xs font-semibold uppercase tracking-wider inline-flex items-center gap-1.5"
              >
                Shop <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Direct Inquiry Composer -> Routes Directly via WhatsApp */}
        <div className="lg:col-span-7">
          <form
            onSubmit={handleSendWhatsApp}
            className="rounded-3xl bg-[#FAF8F3] border border-[#E8E8E8] p-8 space-y-5"
          >
            <div className="flex items-center gap-2.5">
              <Gem className="w-5 h-5 text-[#C6A15B]" />
              <h2 className="font-display text-2xl font-bold text-[#111111]">
                Send a Direct Inquiry
              </h2>
            </div>
            <p className="text-sm text-[#333333]">
              Have questions about shoe EU sizing, two-piece fit, wholesale inquiries, or Ogbomoso dispatch? Send your note straight to our WhatsApp desk.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#111111] mb-1.5">
                  Your Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Tunde Adebayo"
                  className="w-full h-11 px-4 rounded-xl border border-[#E8E8E8] bg-white text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#111111] mb-1.5">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="07051959290"
                  className="w-full h-11 px-4 rounded-xl border border-[#E8E8E8] bg-white text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#111111] mb-1.5">
                Inquiry Topic
              </label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full h-11 px-4 rounded-xl border border-[#E8E8E8] bg-white text-sm"
              >
                <option>Sizing or Product Inquiry</option>
                <option>Existing Order Tracking &amp; Delivery</option>
                <option>Return or Exchange Request</option>
                <option>Payment &amp; Transfer Verification</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#111111] mb-1.5">
                Your Message *
              </label>
              <textarea
                rows={4}
                required
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Tell us the shoe model, size, or order number you need help with..."
                className="w-full p-4 rounded-xl border border-[#E8E8E8] bg-white text-sm"
              />
            </div>

            <button
              type="submit"
              className="h-12 px-7 rounded-full bg-[#111111] hover:bg-[#2a2a2a] text-white text-xs font-bold uppercase tracking-wider inline-flex items-center gap-2 transition-colors"
            >
              <Send className="w-4 h-4 text-[#C6A15B]" />
              Send Message via WhatsApp
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
