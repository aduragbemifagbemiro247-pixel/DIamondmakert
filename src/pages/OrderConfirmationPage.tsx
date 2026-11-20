import { Building2, CheckCircle2, Clock, MessageCircle, Printer, Upload, XCircle } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { BrandLogo } from '../components/BrandLogo.tsx';
import { useStore } from '../context/StoreContext.tsx';
import { apiFetch } from '../lib/api.ts';
import type { Order } from '../types/commerce.ts';
import { formatDateTime, formatNaira } from '../utils/currency.ts';
import { buildWhatsAppUrl } from '../utils/sanitizeHtml.ts';

function readLastOrder(orderNumber?: string): Order | null {
  try {
    const raw =
      sessionStorage.getItem('dm_last_order') ?? sessionStorage.getItem('zora_last_order');
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Order;
    if (!orderNumber || parsed.orderNumber === orderNumber || parsed.id === orderNumber) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function OrderConfirmationPage({ orderNumber }: { orderNumber?: string }) {
  const { paymentGateways, settings, navigate, pushToast } = useStore();
  const [order, setOrder] = useState<Order | null>(() => readLastOrder(orderNumber));
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [transferNote, setTransferNote] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const cb = params.get('payment_callback');
    if (cb === 'paystack') {
      const reference = params.get('reference') || params.get('trxref');
      if (reference) {
        setVerifying(true);
        apiFetch<{ verified: boolean; order: Order }>('/api/payments/paystack/verify', {
          method: 'POST',
          body: JSON.stringify({ reference }),
        })
          .then((res) => {
            setOrder(res.order);
            sessionStorage.setItem('dm_last_order', JSON.stringify(res.order));
            pushToast('Paystack payment verified successfully', 'success');
          })
          .catch((err) => {
            setVerifyError(err instanceof Error ? err.message : 'Paystack verification failed.');
          })
          .finally(() => setVerifying(false));
      }
    } else if (cb === 'flutterwave') {
      const txId = params.get('transaction_id');
      const txRef = params.get('tx_ref');
      if (txId && txRef) {
        setVerifying(true);
        apiFetch<{ verified: boolean; order: Order }>('/api/payments/flutterwave/verify', {
          method: 'POST',
          body: JSON.stringify({ transactionId: txId, txRef }),
        })
          .then((res) => {
            setOrder(res.order);
            sessionStorage.setItem('dm_last_order', JSON.stringify(res.order));
            pushToast('Flutterwave payment verified successfully', 'success');
          })
          .catch((err) => {
            setVerifyError(err instanceof Error ? err.message : 'Flutterwave verification failed.');
          })
          .finally(() => setVerifying(false));
      }
    }
  }, [pushToast]);

  const bacsGateway = paymentGateways.find((g) => g.id === 'bacs');

  const handleReceiptUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order || !receiptFile) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('receipt', receiptFile);
      form.append('email', order.customerEmail);
      form.append('note', transferNote);
      const res = await apiFetch<{ order: Order }>(`/api/orders/${order.id}/receipt`, {
        method: 'POST',
        body: form,
      });
      setOrder(res.order);
      sessionStorage.setItem('dm_last_order', JSON.stringify(res.order));
      pushToast('Transfer proof uploaded for verification', 'success');
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Receipt upload failed', 'error');
    } finally {
      setUploading(false);
    }
  };

  if (verifying) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <Clock className="w-10 h-10 text-[#C6A15B] mx-auto mb-3 animate-spin" />
        <h1 className="font-display text-xl font-bold text-[#111111]">
          Verifying Transaction with Payment Gateway...
        </h1>
        <p className="text-sm text-[#333333]/75 mt-2">
          Confirming signature and Nigerian Naira settlement status.
        </p>
      </div>
    );
  }

  if (verifyError) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <XCircle className="w-12 h-12 text-rose-600 mx-auto mb-3" />
        <h1 className="font-display text-xl font-bold text-[#111111] mb-2">
          Payment Verification Incomplete
        </h1>
        <p className="text-sm text-rose-600 mb-6">{verifyError}</p>
        <button
          type="button"
          onClick={() => navigate('/track-order')}
          className="px-6 py-3 bg-[#111111] text-white text-xs font-bold uppercase tracking-wider rounded-full cursor-pointer"
        >
          Check Order Status
        </button>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <h1 className="font-display text-xl font-bold text-[#111111] mb-2">
          Track Your Order
        </h1>
        <p className="text-sm text-[#333333]/75 mb-6">
          Enter your Diamond Market order number and billing email to view invoice and delivery status.
        </p>
        <button
          type="button"
          onClick={() => navigate('/track-order')}
          className="px-6 py-3 bg-[#111111] text-white text-xs font-bold uppercase tracking-wider rounded-full cursor-pointer"
        >
          Go to Order Tracker
        </button>
      </div>
    );
  }

  const whatsappUrl = buildWhatsAppUrl(
    settings?.whatsapp || settings?.phone || '07051959290',
    `Hello Diamond Market, I just placed order ${order.orderNumber} (${formatNaira(
      order.total
    )}). Please confirm delivery updates.`
  );

  return (
    <div className="bg-[#FAF8F3] min-h-screen py-10">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 space-y-6">
        <div className="dm-modal-in bg-white border border-[#E8E8E8] rounded-3xl p-6 sm:p-10 shadow-sm">
          {/* Official Printable Invoice Header */}
          <div className="flex flex-wrap items-center justify-between gap-4 pb-6 mb-6 border-b border-[#E8E8E8]">
            <BrandLogo variant="light" />
            <div className="text-right text-xs text-[#333333]/75">
              <p className="font-semibold text-[#111111]">Official Store Invoice</p>
              <p>{settings?.address || 'Ogbomoso, Oyo State, Nigeria'}</p>
              <p className="font-mono-num">{settings?.phone || '07051959290'}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-start justify-between gap-4 pb-6 border-b border-[#E8E8E8]">
            <div className="flex items-start gap-3.5">
              <span className="w-11 h-11 rounded-2xl bg-[#FAF8F3] border border-[#C6A15B]/40 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-6 h-6 text-[#C6A15B]" />
              </span>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#8C6D34]">
                  Order Recorded
                </p>
                <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#111111] mt-0.5">
                  Order {order.orderNumber}
                </h1>
                <p className="text-xs text-[#333333]/75 mt-1">
                  Placed {formatDateTime(order.createdAt)} · Reference:{' '}
                  <span className="font-mono-num text-[#111111] font-semibold">
                    {order.paymentReference}
                  </span>
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => window.print()}
              className="dm-btn-interactive no-print px-4 py-2 border border-[#E8E8E8] rounded-full text-xs font-semibold text-[#111111] hover:border-[#111111] flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Invoice</span>
            </button>
          </div>

          <div className="py-6 border-b border-[#E8E8E8] grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-xs text-[#333333]/70">Order Status</p>
              <p className="font-semibold text-[#111111] capitalize mt-0.5">{order.status}</p>
            </div>
            <div>
              <p className="text-xs text-[#333333]/70">Payment Method</p>
              <p className="font-semibold text-[#111111] mt-0.5">{order.paymentMethodTitle}</p>
            </div>
            <div>
              <p className="text-xs text-[#333333]/70">Payment Status</p>
              <p className="font-semibold text-[#111111] capitalize mt-0.5">
                {order.paymentStatus.replace(/_/g, ' ')}
              </p>
            </div>
          </div>

          {order.paymentMethod === 'bacs' && order.paymentStatus !== 'paid' && bacsGateway?.bankDetails && (
            <div className="my-6 bg-[#111111] text-white rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-2 text-[#C6A15B]">
                <Building2 className="w-5 h-5" />
                <h2 className="font-display text-base font-bold">
                  Complete Your Bank Transfer
                </h2>
              </div>
              <p className="text-xs text-neutral-300 leading-relaxed">
                Transfer <strong className="text-white font-mono-num">{formatNaira(order.total)}</strong> within{' '}
                {bacsGateway.bankDetails.paymentDeadlineHours} hours using narration{' '}
                <strong className="text-[#C6A15B] font-mono-num">{order.paymentReference}</strong>.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-[#1E1E1E] rounded-xl p-4 text-xs border border-white/10">
                <div>
                  <p className="text-neutral-400">Bank Name</p>
                  <p className="font-semibold text-white mt-0.5">{bacsGateway.bankDetails.bankName}</p>
                </div>
                <div>
                  <p className="text-neutral-400">Account Name</p>
                  <p className="font-semibold text-white mt-0.5">{bacsGateway.bankDetails.accountName}</p>
                </div>
                <div>
                  <p className="text-neutral-400">Account Number</p>
                  <p className="font-bold text-[#C6A15B] font-mono-num text-sm mt-0.5">
                    {bacsGateway.bankDetails.accountNumber}
                  </p>
                </div>
              </div>

              {order.transferReceiptUrl ? (
                <div className="bg-emerald-950/60 border border-emerald-700/50 rounded-xl p-3.5 text-xs text-emerald-200">
                  Receipt uploaded and queued for administrator verification.
                </div>
              ) : (
                <form onSubmit={handleReceiptUpload} className="no-print pt-2 space-y-3">
                  <p className="text-xs font-semibold text-white">Upload Transfer Receipt (JPG, PNG, or PDF)</p>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input
                      type="file"
                      required
                      accept="image/jpeg,image/png,image/webp,application/pdf"
                      onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                      className="text-xs text-neutral-300 file:mr-3 file:py-2 file:px-3 file:rounded-full file:border-0 file:bg-[#292929] file:text-white file:font-semibold"
                    />
                    <input
                      type="text"
                      value={transferNote}
                      onChange={(e) => setTransferNote(e.target.value)}
                      placeholder="Sender bank / name (optional)"
                      className="flex-1 bg-[#292929] border border-white/15 rounded-full px-4 py-2 text-xs text-white placeholder-neutral-400"
                    />
                    <button
                      type="submit"
                      disabled={uploading || !receiptFile}
                      className="px-5 py-2 bg-[#C6A15B] text-[#111111] text-xs font-bold uppercase tracking-wider rounded-full hover:bg-white cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{uploading ? 'Uploading...' : 'Submit Proof'}</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          <div className="py-6 space-y-3">
            <h2 className="font-display text-sm font-bold text-[#111111] uppercase tracking-wider">
              Items Ordered
            </h2>
            <div className="divide-y divide-[#E8E8E8]">
              {order.items.map((item, idx) => (
                <div key={`${item.productId}-${idx}`} className="py-3 flex items-center justify-between gap-4 text-sm">
                  <div>
                    <p className="font-semibold text-[#111111]">{item.name}</p>
                    <p className="text-xs text-[#333333]/75 font-mono-num">
                      SKU: {item.sku} · Qty {item.quantity} × {formatNaira(item.unitPrice)}
                      {item.attributes && Object.keys(item.attributes).length > 0
                        ? ` · ${Object.values(item.attributes).join(' · ')}`
                        : ''}
                    </p>
                  </div>
                  <p className="font-bold text-[#111111] font-mono-num">
                    {formatNaira(item.total)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-[#E8E8E8] space-y-2 text-sm">
            <div className="flex justify-between text-[#333333]/80">
              <span>Subtotal</span>
              <span className="font-mono-num">{formatNaira(order.subtotal)}</span>
            </div>
            {order.discountTotal > 0 && (
              <div className="flex justify-between text-emerald-700">
                <span>Discount</span>
                <span className="font-mono-num">-{formatNaira(order.discountTotal)}</span>
              </div>
            )}
            <div className="flex justify-between text-[#333333]/80">
              <span>Shipping ({order.shippingZoneName})</span>
              <span className="font-mono-num">
                {order.shippingTotal === 0 ? 'Free' : formatNaira(order.shippingTotal)}
              </span>
            </div>
            {order.codFee > 0 && (
              <div className="flex justify-between text-[#333333]/80">
                <span>COD Fee</span>
                <span className="font-mono-num">{formatNaira(order.codFee)}</span>
              </div>
            )}
            <div className="pt-3 border-t border-[#E8E8E8] flex justify-between font-bold text-base text-[#111111]">
              <span>Total (NGN)</span>
              <span className="font-mono-num">{formatNaira(order.total)}</span>
            </div>
          </div>

          <div className="mt-8 no-print flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => navigate('/shop')}
              className="px-5 py-2.5 bg-[#111111] text-white text-xs font-bold uppercase tracking-wider rounded-full cursor-pointer"
            >
              Continue Shopping
            </button>
            <button
              type="button"
              onClick={() => navigate('/track-order')}
              className="px-5 py-2.5 border border-[#E8E8E8] text-[#111111] text-xs font-semibold uppercase tracking-wider rounded-full cursor-pointer"
            >
              Track Delivery
            </button>
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="px-5 py-2.5 bg-[#C6A15B] text-[#111111] text-xs font-bold uppercase tracking-wider rounded-full inline-flex items-center gap-1.5"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              WhatsApp Support
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
