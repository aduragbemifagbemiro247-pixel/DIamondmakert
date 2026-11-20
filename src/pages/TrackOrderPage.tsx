import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  MessageCircle,
  PackageCheck,
  Phone,
  Search,
  Truck,
} from 'lucide-react';
import React, { useState } from 'react';
import { useStore } from '../context/StoreContext.tsx';
import { apiFetch } from '../lib/api.ts';
import type { DeliveryHistoryEntry, DeliveryRecord, Order } from '../types/commerce.ts';
import { formatDateTime, formatNaira } from '../utils/currency.ts';
import {
  buildCustomerDeliveryTimeline,
  getDeliveryStatusLabel,
  getDeliveryStatusStyle,
} from '../utils/deliveryStatus.ts';
import { buildWhatsAppUrl } from '../utils/sanitizeHtml.ts';

export function TrackOrderPage() {
  const { settings } = useStore();
  const [orderNumber, setOrderNumber] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [deliveryHistory, setDeliveryHistory] = useState<DeliveryHistoryEntry[]>([]);

  const handleTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{ order: Order; deliveryHistory?: DeliveryHistoryEntry[] }>(
        '/api/orders/track',
        {
          method: 'POST',
          body: JSON.stringify({ orderNumber: orderNumber.trim(), email: email.trim() }),
        }
      );
      setOrder(res.order);
      setDeliveryHistory(res.deliveryHistory || []);
    } catch (err) {
      setOrder(null);
      setDeliveryHistory([]);
      setError(err instanceof Error ? err.message : 'Order not found');
    } finally {
      setLoading(false);
    }
  };

  const whatsappUrl = buildWhatsAppUrl(
    settings?.whatsapp || settings?.phone || '07051959290',
    orderNumber
      ? `Hello Diamond Market, I would like an update on my order ${orderNumber.trim()}.`
      : 'Hello Diamond Market, I would like help tracking my order.'
  );

  const syntheticDelivery: DeliveryRecord | null = order
    ? {
        id: order.delivery.deliveryId || order.id,
        orderId: order.id,
        orderNumber: order.orderNumber,
        deliveryType: order.delivery.deliveryType || 'local',
        zoneName: order.shippingZoneName,
        deliveryFee: order.shippingTotal,
        estimatedDeliveryDate: order.delivery.estimatedDeliveryDate,
        status: order.delivery.status,
        riderId: order.delivery.riderId,
        riderCode: order.delivery.riderCode,
        riderName: order.delivery.riderName,
        riderPhone: order.delivery.riderPhone,
        riderWhatsapp: order.delivery.riderWhatsapp,
        riderVehicle: order.delivery.riderVehicle,
        recipientName: `${order.billing.firstName} ${order.billing.lastName}`,
        customerEmail: order.billing.email,
        customerPhone: '',
        addressStreet: '',
        addressCity: order.billing.city,
        addressState: order.billing.state,
        deliveryInstructions: '',
        courier: order.delivery.courier,
        trackingNumber: order.delivery.trackingNumber,
        otpRequired: Boolean(order.delivery.otpRequired),
        otpVerified: Boolean(order.delivery.otpVerified),
        confirmation: {
          confirmed: Boolean(order.delivery.customerConfirmed),
          confirmedAt: order.delivery.customerConfirmedAt,
          reminderCount: 0,
        },
        codAmountToCollect: 0,
        codCollected: false,
        history: deliveryHistory,
        createdAt: order.createdAt,
        updatedAt: order.delivery.updatedAt || order.createdAt,
      }
    : null;

  const timeline = order ? buildCustomerDeliveryTimeline(order, syntheticDelivery) : null;

  return (
    <div className="bg-[#FAF8F3] min-h-[75vh] py-12">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 space-y-6">
        <div className="bg-white border border-[#E8E8E8] rounded-3xl p-6 sm:p-9 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#8C6D34] mb-1">
            Live Order &amp; Dispatch Lookup
          </p>
          <h1 className="font-display text-3xl font-bold text-[#111111] mb-2">
            Track Your Order
          </h1>
          <p className="text-sm text-[#333333]/80 mb-6">
            Enter your Diamond Market order number and billing email address to inspect real-time dispatch milestones, rider details, and delivery confirmation status.
          </p>

          <form onSubmit={handleTrack} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="trk-num" className="block text-xs font-semibold text-[#111111] mb-1.5">
                  Order Number
                </label>
                <input
                  id="trk-num"
                  type="text"
                  required
                  value={orderNumber}
                  onChange={(e) => setOrderNumber(e.target.value)}
                  placeholder="DM-26A1B2C3"
                  className="w-full border border-[#E8E8E8] rounded-xl px-3.5 py-2.5 text-sm font-mono-num uppercase focus:outline-none focus:border-[#111111]"
                />
              </div>
              <div>
                <label htmlFor="trk-email" className="block text-xs font-semibold text-[#111111] mb-1.5">
                  Billing Email
                </label>
                <input
                  id="trk-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full border border-[#E8E8E8] rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#111111]"
                />
              </div>
            </div>

            {error && (
              <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3">
                {error}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-3 bg-[#111111] text-white text-xs font-bold uppercase tracking-wider rounded-full hover:bg-[#2a2a2a] cursor-pointer inline-flex items-center gap-2"
              >
                <Search className="w-4 h-4 text-[#C6A15B]" />
                <span>{loading ? 'Searching...' : 'Track Order'}</span>
              </button>

              <a
                href={whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="px-5 py-3 border border-[#E8E8E8] hover:border-[#111111] text-[#111111] text-xs font-semibold rounded-full inline-flex items-center gap-1.5"
              >
                <MessageCircle className="w-4 h-4 text-[#25D366]" />
                Ask on WhatsApp
              </a>
            </div>
          </form>
        </div>

        {order && timeline && (
          <div className="bg-white border border-[#E8E8E8] rounded-3xl p-6 sm:p-8 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#E8E8E8]">
              <div>
                <p className="font-display text-xl font-bold text-[#111111] font-mono-num">
                  {order.orderNumber}
                </p>
                <p className="text-xs text-[#333333]/75">
                  Placed {formatDateTime(order.createdAt)} · Destination: {order.billing.city}, {order.billing.state}
                </p>
              </div>
              <div className="text-right space-y-1">
                <span
                  className={`inline-block px-3 py-1 rounded-full text-[11px] font-bold border ${getDeliveryStatusStyle(
                    order.delivery.status
                  )}`}
                >
                  {getDeliveryStatusLabel(order.delivery.status)}
                </span>
                <p className="font-bold text-[#111111] font-mono-num text-base">
                  {formatNaira(order.total)}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
              <div className="p-4 bg-[#FAF8F3] border border-[#E8E8E8] rounded-2xl">
                <p className="text-xs text-[#333333]/75 flex items-center gap-1.5">
                  <PackageCheck className="w-3.5 h-3.5 text-[#C6A15B]" /> Order Status
                </p>
                <p className="font-semibold text-[#111111] capitalize mt-1">{order.status}</p>
              </div>
              <div className="p-4 bg-[#FAF8F3] border border-[#E8E8E8] rounded-2xl">
                <p className="text-xs text-[#333333]/75">Payment ({order.paymentMethodTitle})</p>
                <p className="font-semibold text-[#111111] capitalize mt-1">
                  {order.paymentStatus.replace(/_/g, ' ')}
                </p>
              </div>
              <div className="p-4 bg-[#FAF8F3] border border-[#E8E8E8] rounded-2xl">
                <p className="text-xs text-[#333333]/75 flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5 text-[#C6A15B]" /> Estimated Delivery
                </p>
                <p className="font-semibold text-[#111111] mt-1">
                  {order.delivery.estimatedDeliveryDate || order.shippingZoneName}
                </p>
              </div>
            </div>

            {timeline.exceptionStatus && (
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-3 text-xs text-rose-900">
                <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">{getDeliveryStatusLabel(timeline.exceptionStatus)}</p>
                  {timeline.exceptionReason && <p className="mt-0.5">{timeline.exceptionReason}</p>}
                </div>
              </div>
            )}

            {/* 9-Stage Factual Customer Progress Timeline */}
            <div className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-[#111111]">
                Delivery Progress Timeline
              </p>
              <div className="space-y-2.5 border-l-2 border-[#E8E8E8] ml-2.5 pl-5">
                {timeline.stages.map((st) => (
                  <div key={st.key} className="relative flex items-start justify-between gap-4 text-xs">
                    <span className="absolute -left-[29px] top-0.5 bg-white">
                      {st.completed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                      ) : st.active ? (
                        <Circle className="w-4 h-4 text-[#C6A15B] fill-[#C6A15B]/30" />
                      ) : (
                        <Circle className="w-4 h-4 text-neutral-300" />
                      )}
                    </span>
                    <span
                      className={
                        st.completed || st.active ? 'font-semibold text-[#111111]' : 'text-[#333333]/55'
                      }
                    >
                      {st.label}
                    </span>
                    <span className="text-[11px] font-mono-num text-[#333333]/65 shrink-0">
                      {st.timestamp ? formatDateTime(st.timestamp) : 'Pending'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Assigned Rider Information (only shown when a real rider is assigned) */}
            {order.delivery.riderName && (
              <div className="p-4 border border-[#C6A15B]/40 bg-[#FAF8F3] rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[#8C6D34]">
                    Assigned Dispatch Rider
                  </p>
                  <p className="font-bold text-sm text-[#111111] mt-0.5">
                    {order.delivery.riderName}{' '}
                    {order.delivery.riderCode ? `(${order.delivery.riderCode})` : ''}
                  </p>
                  {order.delivery.riderVehicle && (
                    <p className="text-[#333333]/75 capitalize">{order.delivery.riderVehicle}</p>
                  )}
                </div>
                {order.delivery.riderPhone && (
                  <div className="flex gap-2">
                    <a
                      href={`tel:${order.delivery.riderPhone}`}
                      className="px-3.5 py-2 rounded-full border border-[#E8E8E8] bg-white font-semibold text-[#111111] inline-flex items-center gap-1.5"
                    >
                      <Phone className="w-3.5 h-3.5 text-[#C6A15B]" />
                      <span>Call Rider</span>
                    </a>
                    <a
                      href={buildWhatsAppUrl(
                        order.delivery.riderWhatsapp || order.delivery.riderPhone,
                        `Hello ${order.delivery.riderName}, regarding Diamond Market order ${order.orderNumber}.`
                      )}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3.5 py-2 rounded-full bg-[#111111] text-white font-semibold inline-flex items-center gap-1.5"
                    >
                      <MessageCircle className="w-3.5 h-3.5 text-[#25D366]" />
                      <span>WhatsApp</span>
                    </a>
                  </div>
                )}
              </div>
            )}

            {(order.delivery.courier || order.delivery.trackingNumber) && (
              <div className="p-4 border border-[#E8E8E8] bg-[#FAF8F3] rounded-2xl text-xs space-y-1">
                <p className="font-semibold text-[#111111]">
                  Courier: {order.delivery.courier || 'Diamond Market Dispatch'}
                </p>
                {order.delivery.trackingNumber && (
                  <p className="text-[#333333] font-mono-num">
                    Tracking Number: {order.delivery.trackingNumber}
                  </p>
                )}
              </div>
            )}

            {order.notes.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#111111]">
                  Order Updates
                </p>
                <div className="space-y-2">
                  {order.notes.map((n) => (
                    <div key={n.id} className="text-xs border-b border-[#E8E8E8] pb-2">
                      <p className="text-[#111111]">{n.note}</p>
                      <p className="text-[#333333]/65 mt-0.5">{formatDateTime(n.createdAt)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
