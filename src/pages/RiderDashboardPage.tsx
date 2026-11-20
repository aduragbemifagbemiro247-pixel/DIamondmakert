import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  KeyRound,
  LogOut,
  MapPin,
  MessageCircle,
  Navigation,
  PackageCheck,
  Phone,
  RefreshCw,
  ShieldCheck,
  Star,
  Truck,
  User,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useStore } from '../context/StoreContext.tsx';
import { getRiderToken, riderFetch, setRiderToken } from '../lib/api.ts';
import type {
  DeliveryRecord,
  OrderLineItem,
  PaymentMethodId,
  PaymentStatus,
  Rider,
  RiderReview,
} from '../types/commerce.ts';
import { formatDateTime, formatNaira } from '../utils/currency.ts';
import { getDeliveryStatusLabel, getDeliveryStatusStyle } from '../utils/deliveryStatus.ts';
import { buildWhatsAppUrl } from '../utils/sanitizeHtml.ts';

interface RiderAssignmentItem {
  delivery: DeliveryRecord;
  items: OrderLineItem[];
  paymentMethod: PaymentMethodId;
  paymentStatus: PaymentStatus;
  orderTotal: number;
}

interface RiderProfilePayload {
  rider: Rider;
  ratingSummary: {
    averageRating: number | null;
    reviewCount: number;
    reviews: RiderReview[];
  };
  evidenceRules: {
    collectDeliveryPhoto: boolean;
    collectDeliveryLocation: boolean;
  };
}

type RiderTab = 'active' | 'history' | 'profile';

export function RiderDashboardPage() {
  const { navigate, pushToast } = useStore();
  const [rider, setRider] = useState<Rider | null>(null);
  const [ratingSummary, setRatingSummary] = useState<RiderProfilePayload['ratingSummary']>({
    averageRating: null,
    reviewCount: 0,
    reviews: [],
  });
  const [evidenceRules, setEvidenceRules] = useState({
    collectDeliveryPhoto: true,
    collectDeliveryLocation: false,
  });
  const [assignments, setAssignments] = useState<RiderAssignmentItem[]>([]);
  const [checkingSession, setCheckingSession] = useState(true);
  const [tab, setTab] = useState<RiderTab>('active');

  // Login form state
  const [identifier, setIdentifier] = useState('');
  const [passcode, setPasscode] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Per-delivery interactive inputs
  const [otpInputs, setOtpInputs] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  // Complete delivery / evidence modal
  const [completingItem, setCompletingItem] = useState<RiderAssignmentItem | null>(null);
  const [evRecipient, setEvRecipient] = useState('');
  const [evNotes, setEvNotes] = useState('');
  const [evPhotoUrl, setEvPhotoUrl] = useState('');
  const [evUploading, setEvUploading] = useState(false);
  const [evCodCollected, setEvCodCollected] = useState(false);
  const [evLocationConsent, setEvLocationConsent] = useState(false);
  const [evLocationNote, setEvLocationNote] = useState('');
  const [evCoords, setEvCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Failed delivery modal
  const [failingItem, setFailingItem] = useState<RiderAssignmentItem | null>(null);
  const [failReason, setFailReason] = useState('');

  const loadRiderData = useCallback(async () => {
    try {
      const [meRes, delRes] = await Promise.all([
        riderFetch<RiderProfilePayload>('/api/rider/me'),
        riderFetch<{ deliveries: RiderAssignmentItem[] }>('/api/rider/deliveries'),
      ]);
      setRider(meRes.rider);
      setRatingSummary(meRes.ratingSummary);
      setEvidenceRules(meRes.evidenceRules);
      setAssignments(delRes.deliveries || []);
    } catch {
      setRider(null);
      setAssignments([]);
    } finally {
      setCheckingSession(false);
    }
  }, []);

  useEffect(() => {
    if (getRiderToken()) {
      loadRiderData();
    } else {
      // Also check HttpOnly cookie silently if present
      riderFetch<RiderProfilePayload>('/api/rider/me')
        .then((res) => {
          setRider(res.rider);
          setRatingSummary(res.ratingSummary);
          setEvidenceRules(res.evidenceRules);
          return riderFetch<{ deliveries: RiderAssignmentItem[] }>('/api/rider/deliveries');
        })
        .then((delRes) => setAssignments(delRes.deliveries || []))
        .catch(() => setRider(null))
        .finally(() => setCheckingSession(false));
    }
  }, [loadRiderData]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError(null);
    try {
      const res = await riderFetch<{ rider: Rider; token: string }>('/api/rider/login', {
        method: 'POST',
        body: JSON.stringify({ identifier: identifier.trim(), passcode }),
      });
      setRiderToken(res.token);
      setRider(res.rider);
      setPasscode('');
      await loadRiderData();
      pushToast(`Signed in as ${res.rider.fullName} (${res.rider.riderCode})`, 'success');
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Unable to sign in');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    await riderFetch('/api/rider/logout', { method: 'POST' }).catch(() => {});
    setRiderToken(null);
    setRider(null);
    setAssignments([]);
  };

  const handleVerifyOtp = async (deliveryId: string) => {
    const code = (otpInputs[deliveryId] || '').trim();
    if (!code) {
      pushToast('Enter the 6-digit OTP from the customer.', 'error');
      return;
    }
    setBusyId(deliveryId);
    try {
      await riderFetch(`/api/rider/deliveries/${encodeURIComponent(deliveryId)}/verify-otp`, {
        method: 'POST',
        body: JSON.stringify({ otpCode: code }),
      });
      pushToast('Customer OTP verified cleanly!', 'success');
      setOtpInputs((prev) => ({ ...prev, [deliveryId]: '' }));
      await loadRiderData();
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'OTP verification failed', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const handleQuickStatus = async (
    deliveryId: string,
    toStatus: 'picked_up' | 'out_for_delivery' | 'arrived_at_destination',
    note: string
  ) => {
    setBusyId(deliveryId);
    try {
      await riderFetch(`/api/rider/deliveries/${encodeURIComponent(deliveryId)}/status`, {
        method: 'POST',
        body: JSON.stringify({ toStatus, note }),
      });
      pushToast(`Updated status: ${getDeliveryStatusLabel(toStatus)}`, 'success');
      await loadRiderData();
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Status update failed', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const openCompleteModal = (item: RiderAssignmentItem) => {
    setCompletingItem(item);
    setEvRecipient(item.delivery.recipientName);
    setEvNotes('');
    setEvPhotoUrl('');
    setEvCodCollected(item.paymentMethod === 'cod' && item.paymentStatus !== 'paid');
    setEvLocationConsent(false);
    setEvLocationNote('');
    setEvCoords(null);
  };

  const handleUploadEvidence = async (file: File) => {
    if (!completingItem) return;
    setEvUploading(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const res = await riderFetch<{ url: string }>(
        `/api/rider/deliveries/${encodeURIComponent(completingItem.delivery.id)}/evidence-upload`,
        {
          method: 'POST',
          body: formData,
        }
      );
      setEvPhotoUrl(res.url);
      pushToast('Delivery photo uploaded.', 'success');
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Photo upload failed', 'error');
    } finally {
      setEvUploading(false);
    }
  };

  const handleCaptureGps = () => {
    if (!navigator.geolocation) {
      pushToast('Geolocation is not supported on this device.', 'error');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setEvCoords({ lat: Number(pos.coords.latitude.toFixed(5)), lng: Number(pos.coords.longitude.toFixed(5)) });
        setEvLocationConsent(true);
        pushToast('GPS coordinates attached with consent.', 'success');
      },
      () => pushToast('Location permission declined.', 'info')
    );
  };

  const handleCompleteDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!completingItem) return;
    setBusyId(completingItem.delivery.id);
    try {
      await riderFetch(`/api/rider/deliveries/${encodeURIComponent(completingItem.delivery.id)}/status`, {
        method: 'POST',
        body: JSON.stringify({
          toStatus: 'awaiting_customer_confirmation',
          note: evNotes.trim() || `Handed to ${evRecipient.trim() || completingItem.delivery.recipientName}`,
          codCollected: evCodCollected,
          evidence: {
            recipientName: evRecipient.trim() || completingItem.delivery.recipientName,
            notes: evNotes.trim(),
            photoUrl: evPhotoUrl || undefined,
            locationNote: evLocationNote.trim() || undefined,
            locationLat: evCoords?.lat,
            locationLng: evCoords?.lng,
            locationConsentGranted: evLocationConsent,
          },
        }),
      });
      pushToast('Delivery completed & confirmation request sent to customer!', 'success');
      setCompletingItem(null);
      await loadRiderData();
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Could not complete delivery', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const handleFailDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!failingItem || !failReason.trim()) return;
    setBusyId(failingItem.delivery.id);
    try {
      await riderFetch(`/api/rider/deliveries/${encodeURIComponent(failingItem.delivery.id)}/status`, {
        method: 'POST',
        body: JSON.stringify({
          toStatus: 'delivery_failed',
          failureReason: failReason.trim(),
          note: failReason.trim(),
        }),
      });
      pushToast('Failed delivery attempt recorded.', 'info');
      setFailingItem(null);
      setFailReason('');
      await loadRiderData();
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Could not record failed delivery', 'error');
    } finally {
      setBusyId(null);
    }
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-[#FAF8F3] flex items-center justify-center p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#333333]">
          Checking Rider Session...
        </p>
      </div>
    );
  }

  if (!rider) {
    return (
      <div className="min-h-screen bg-[#FAF8F3] flex flex-col justify-center items-center p-4">
        <div className="w-full max-w-md bg-white border border-[#E8E8E8] rounded-3xl p-7 sm:p-9 shadow-sm space-y-6">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-[#111111] text-[#C6A15B] flex items-center justify-center mx-auto">
              <Truck className="w-6 h-6" />
            </div>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#8C6D34]">
              Diamond Market Logistics
            </p>
            <h1 className="font-display text-2xl font-bold text-[#111111]">
              Dispatch Rider Portal
            </h1>
            <p className="text-xs text-[#333333]/75">
              Sign in with the Rider Code (e.g. DMR-101) or email assigned by Diamond Market Administration.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="rider-id" className="block text-xs font-semibold text-[#111111] mb-1.5">
                Rider ID or Email
              </label>
              <input
                id="rider-id"
                type="text"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="DMR-101 or rider@diamondmarket.ng"
                className="w-full min-h-[44px] border border-[#E8E8E8] rounded-xl px-4 text-sm focus:outline-none focus:border-[#111111]"
              />
            </div>

            <div>
              <label htmlFor="rider-pass" className="block text-xs font-semibold text-[#111111] mb-1.5">
                Rider Passcode
              </label>
              <input
                id="rider-pass"
                type="password"
                required
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="••••••••"
                className="w-full min-h-[44px] border border-[#E8E8E8] rounded-xl px-4 text-sm focus:outline-none focus:border-[#111111]"
              />
            </div>

            {loginError && (
              <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3">
                {loginError}
              </p>
            )}

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full min-h-[46px] bg-[#111111] text-white text-xs font-bold uppercase tracking-wider rounded-full hover:bg-[#2a2a2a] cursor-pointer"
            >
              {loginLoading ? 'Authenticating...' : 'Sign In to Dispatch Portal'}
            </button>
          </form>

          <div className="pt-2 border-t border-[#E8E8E8] text-center">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="text-xs text-[#333333] hover:text-[#111111] underline cursor-pointer"
            >
              Return to Diamond Market Storefront
            </button>
          </div>
        </div>
      </div>
    );
  }

  const activeList = assignments.filter(
    (a) =>
      !['delivered_customer_confirmed', 'awaiting_customer_confirmation', 'cancelled', 'returned_to_store'].includes(
        a.delivery.status
      )
  );
  const historyList = assignments.filter((a) => !activeList.includes(a));

  return (
    <div className="min-h-screen bg-[#FAF8F3] pb-16">
      {/* Mobile-First Top Bar */}
      <header className="bg-[#111111] text-white sticky top-0 z-30 border-b border-[#C6A15B]/30">
        <div className="max-w-3xl mx-auto px-4 py-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {rider.photoUrl ? (
              <img
                src={rider.photoUrl}
                alt={rider.fullName}
                className="w-10 h-10 rounded-full object-cover border border-[#C6A15B]/60 shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-[#C6A15B]/20 text-[#C6A15B] flex items-center justify-center shrink-0 font-bold text-sm">
                {rider.fullName.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#C6A15B] truncate">
                Diamond Market Rider · <span className="font-mono-num">{rider.riderCode}</span>
              </p>
              <p className="font-semibold text-sm truncate">{rider.fullName}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => loadRiderData()}
              aria-label="Refresh deliveries"
              className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-full border border-white/15 hover:bg-white/10 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="min-h-[40px] px-3.5 rounded-full border border-white/15 text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-white/10 cursor-pointer whitespace-nowrap"
            >
              <LogOut className="w-3.5 h-3.5 text-[#C6A15B]" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>

        {/* Mobile Tab Switcher */}
        <div className="max-w-3xl mx-auto px-4 pb-3 flex gap-2 overflow-x-auto">
          {(
            [
              { id: 'active', label: `Active (${activeList.length})` },
              { id: 'history', label: `History (${historyList.length})` },
              { id: 'profile', label: 'Profile & Ratings' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`min-h-[40px] px-4 rounded-full text-xs font-bold uppercase tracking-wider whitespace-nowrap cursor-pointer transition-colors ${
                tab === t.id
                  ? 'bg-[#C6A15B] text-[#111111]'
                  : 'bg-white/10 text-neutral-200 hover:bg-white/20'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {tab === 'active' && (
          <>
            {activeList.length === 0 ? (
              <div className="bg-white border border-[#E8E8E8] rounded-3xl p-8 text-center space-y-2">
                <PackageCheck className="w-8 h-8 text-[#C6A15B] mx-auto" />
                <p className="font-display text-lg font-bold text-[#111111]">
                  No Active Assigned Deliveries
                </p>
                <p className="text-xs text-[#333333]/75">
                  When an administrator assigns new Diamond Market packages to you, they will appear here automatically.
                </p>
              </div>
            ) : (
              activeList.map((item) => {
                const { delivery, items, paymentMethod, paymentStatus, orderTotal } = item;
                const mapsQuery = encodeURIComponent(
                  `${delivery.addressStreet}, ${delivery.addressCity}, ${delivery.addressState}, Nigeria`
                );
                const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`;
                const waUrl = buildWhatsAppUrl(
                  delivery.customerPhone,
                  `Hello ${delivery.recipientName}, I am your Diamond Market dispatch rider for order ${delivery.orderNumber}.`
                );
                const isCodDue = paymentMethod === 'cod' && paymentStatus !== 'paid';
                const otpBlocked = delivery.otpRequired && !delivery.otpVerified;

                return (
                  <div
                    key={delivery.id}
                    className="bg-white border border-[#E8E8E8] rounded-3xl p-5 sm:p-6 shadow-sm space-y-4"
                  >
                    {/* Header Row */}
                    <div className="flex flex-wrap items-start justify-between gap-2 pb-3 border-b border-[#E8E8E8]">
                      <div>
                        <p className="font-mono-num text-base font-bold text-[#111111]">
                          {delivery.orderNumber}
                        </p>
                        <p className="text-[11px] text-[#333333]/70">
                          {delivery.zoneName} · Assigned {delivery.assignedAt ? formatDateTime(delivery.assignedAt) : ''}
                        </p>
                      </div>
                      <span
                        className={`px-3 py-1 rounded-full text-[11px] font-bold border ${getDeliveryStatusStyle(
                          delivery.status
                        )}`}
                      >
                        {getDeliveryStatusLabel(delivery.status)}
                      </span>
                    </div>

                    {/* COD Collection Banner */}
                    {isCodDue ? (
                      <div className="p-3.5 rounded-2xl bg-[#FAF8F3] border border-[#C6A15B]/60 flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-[#111111]">
                          Pay on Delivery — Collect Amount:
                        </span>
                        <span className="font-mono-num font-bold text-sm text-[#111111]">
                          {formatNaira(orderTotal)}
                        </span>
                      </div>
                    ) : (
                      <div className="px-3.5 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-800">
                        Prepaid Order ({paymentMethod.toUpperCase()}) — No cash collection required
                      </div>
                    )}

                    {/* Recipient & Address */}
                    <div className="space-y-1.5 text-sm">
                      <p className="font-bold text-[#111111] flex items-center gap-2">
                        <User className="w-4 h-4 text-[#C6A15B]" />
                        <span>{delivery.recipientName}</span>
                      </p>
                      <p className="text-xs text-[#333333] flex items-start gap-2">
                        <MapPin className="w-4 h-4 text-[#C6A15B] shrink-0 mt-0.5" />
                        <span>
                          {delivery.addressStreet}, {delivery.addressCity}, {delivery.addressState}
                        </span>
                      </p>
                      {delivery.deliveryInstructions && (
                        <div className="mt-2 p-3 rounded-xl bg-[#FAF8F3] border border-[#E8E8E8] text-xs text-[#333333]">
                          <strong className="text-[#111111]">Customer Note:</strong>{' '}
                          {delivery.deliveryInstructions}
                        </div>
                      )}
                    </div>

                    {/* Customer Contact & Navigation Buttons */}
                    <div className="grid grid-cols-3 gap-2">
                      <a
                        href={`tel:${delivery.customerPhone}`}
                        className="min-h-[44px] px-3 rounded-xl border border-[#E8E8E8] hover:border-[#111111] text-xs font-semibold text-[#111111] flex items-center justify-center gap-1.5"
                      >
                        <Phone className="w-3.5 h-3.5 text-[#C6A15B]" />
                        <span>Call</span>
                      </a>
                      <a
                        href={waUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="min-h-[44px] px-3 rounded-xl border border-[#E8E8E8] hover:border-[#111111] text-xs font-semibold text-[#111111] flex items-center justify-center gap-1.5"
                      >
                        <MessageCircle className="w-3.5 h-3.5 text-[#25D366]" />
                        <span>WhatsApp</span>
                      </a>
                      <a
                        href={mapsUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="min-h-[44px] px-3 rounded-xl bg-[#111111] text-white text-xs font-semibold flex items-center justify-center gap-1.5"
                      >
                        <Navigation className="w-3.5 h-3.5 text-[#C6A15B]" />
                        <span>Directions</span>
                      </a>
                    </div>

                    {/* Order Items Summary */}
                    <div className="bg-[#FAF8F3] border border-[#E8E8E8] rounded-2xl p-3.5 space-y-1.5">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-[#333333]/75">
                        Package Contents ({items.length})
                      </p>
                      {items.map((it, i) => (
                        <div key={i} className="text-xs flex justify-between gap-2 text-[#111111]">
                          <span>
                            {it.quantity}× {it.name}
                            {it.attributes && Object.keys(it.attributes).length > 0
                              ? ` (${Object.values(it.attributes).join(' / ')})`
                              : ''}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* OTP Verification Box */}
                    {delivery.otpRequired && (
                      <div
                        className={`p-4 rounded-2xl border ${
                          delivery.otpVerified
                            ? 'bg-emerald-50 border-emerald-200'
                            : 'bg-[#FAF8F3] border-[#C6A15B]/50'
                        }`}
                      >
                        {delivery.otpVerified ? (
                          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800">
                            <ShieldCheck className="w-4 h-4 shrink-0" />
                            <span>
                              Customer 6-Digit OTP Verified{' '}
                              {delivery.otpVerifiedAt ? `(${formatDateTime(delivery.otpVerifiedAt)})` : ''}
                            </span>
                          </div>
                        ) : (
                          <div className="space-y-2.5">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-xs font-bold text-[#111111] flex items-center gap-1.5">
                                <KeyRound className="w-3.5 h-3.5 text-[#C6A15B]" />
                                <span>Customer OTP Required for Handoff</span>
                              </p>
                              {delivery.otpAttemptsRemaining !== undefined && (
                                <span className="text-[11px] font-mono-num text-[#333333]/75">
                                  {delivery.otpAttemptsRemaining} tries left
                                </span>
                              )}
                            </div>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                inputMode="numeric"
                                maxLength={6}
                                value={otpInputs[delivery.id] || ''}
                                onChange={(e) =>
                                  setOtpInputs((prev) => ({
                                    ...prev,
                                    [delivery.id]: e.target.value.replace(/\D/g, ''),
                                  }))
                                }
                                placeholder="6-digit OTP"
                                className="flex-1 min-h-[44px] bg-white border border-[#E8E8E8] rounded-xl px-3.5 text-sm font-mono-num tracking-widest focus:outline-none focus:border-[#111111]"
                              />
                              <button
                                type="button"
                                disabled={busyId === delivery.id}
                                onClick={() => handleVerifyOtp(delivery.id)}
                                className="min-h-[44px] px-5 rounded-xl bg-[#111111] text-white text-xs font-bold uppercase tracking-wider cursor-pointer whitespace-nowrap"
                              >
                                Verify OTP
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Action Controls */}
                    <div className="flex flex-wrap gap-2 pt-1">
                      {delivery.status === 'rider_assigned' && (
                        <button
                          type="button"
                          disabled={busyId === delivery.id}
                          onClick={() =>
                            handleQuickStatus(
                              delivery.id,
                              'picked_up',
                              'Package picked up from Diamond Market dispatch.'
                            )
                          }
                          className="flex-1 min-h-[44px] px-4 rounded-full bg-[#111111] text-white text-xs font-bold uppercase tracking-wider cursor-pointer whitespace-nowrap"
                        >
                          Mark Picked Up
                        </button>
                      )}

                      {delivery.status === 'picked_up' && (
                        <button
                          type="button"
                          disabled={busyId === delivery.id}
                          onClick={() =>
                            handleQuickStatus(
                              delivery.id,
                              'out_for_delivery',
                              'Rider en route to customer address.'
                            )
                          }
                          className="flex-1 min-h-[44px] px-4 rounded-full bg-[#111111] text-white text-xs font-bold uppercase tracking-wider cursor-pointer whitespace-nowrap"
                        >
                          Mark Out for Delivery
                        </button>
                      )}

                      {delivery.status === 'out_for_delivery' && (
                        <button
                          type="button"
                          disabled={busyId === delivery.id}
                          onClick={() =>
                            handleQuickStatus(
                              delivery.id,
                              'arrived_at_destination',
                              'Rider arrived at customer delivery address.'
                            )
                          }
                          className="flex-1 min-h-[44px] px-4 rounded-full bg-[#C6A15B] text-[#111111] text-xs font-bold uppercase tracking-wider cursor-pointer whitespace-nowrap"
                        >
                          Mark Arrived
                        </button>
                      )}

                      {['picked_up', 'out_for_delivery', 'arrived_at_destination'].includes(delivery.status) && (
                        <button
                          type="button"
                          disabled={otpBlocked || busyId === delivery.id}
                          onClick={() => openCompleteModal(item)}
                          className="flex-1 min-h-[44px] px-4 rounded-full bg-emerald-700 hover:bg-emerald-800 disabled:opacity-45 text-white text-xs font-bold uppercase tracking-wider cursor-pointer whitespace-nowrap inline-flex items-center justify-center gap-1.5"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>{otpBlocked ? 'Verify OTP First' : 'Complete Delivery'}</span>
                        </button>
                      )}

                      <button
                        type="button"
                        disabled={busyId === delivery.id}
                        onClick={() => {
                          setFailingItem(item);
                          setFailReason('');
                        }}
                        className="min-h-[44px] px-4 rounded-full border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-semibold cursor-pointer whitespace-nowrap"
                      >
                        Report Failed
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </>
        )}

        {tab === 'history' && (
          <div className="space-y-3">
            {historyList.length === 0 ? (
              <div className="bg-white border border-[#E8E8E8] rounded-3xl p-8 text-center">
                <p className="text-sm font-semibold text-[#111111]">No delivery history yet</p>
                <p className="text-xs text-[#333333]/75 mt-1">
                  Completed or returned deliveries assigned to you will appear here.
                </p>
              </div>
            ) : (
              historyList.map(({ delivery, orderTotal }) => (
                <div
                  key={delivery.id}
                  className="bg-white border border-[#E8E8E8] rounded-2xl p-4 sm:p-5 space-y-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono-num font-bold text-sm text-[#111111]">
                      {delivery.orderNumber}
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${getDeliveryStatusStyle(
                        delivery.status
                      )}`}
                    >
                      {getDeliveryStatusLabel(delivery.status)}
                    </span>
                  </div>
                  <p className="text-xs text-[#333333]">
                    {delivery.recipientName} — {delivery.addressCity}, {delivery.addressState}
                  </p>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#333333]/75">
                    <span>
                      {delivery.deliveredAt
                        ? `Delivered: ${formatDateTime(delivery.deliveredAt)}`
                        : `Updated: ${formatDateTime(delivery.updatedAt)}`}
                    </span>
                    <span className="font-mono-num font-semibold text-[#111111]">
                      Order Value: {formatNaira(orderTotal)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {tab === 'profile' && (
          <div className="space-y-5">
            <div className="bg-white border border-[#E8E8E8] rounded-3xl p-6 space-y-4">
              <div className="flex items-center gap-4">
                {rider.photoUrl ? (
                  <img
                    src={rider.photoUrl}
                    alt={rider.fullName}
                    className="w-16 h-16 rounded-2xl object-cover border border-[#E8E8E8]"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-2xl bg-[#111111] text-[#C6A15B] flex items-center justify-center font-display text-2xl font-bold">
                    {rider.fullName.charAt(0)}
                  </div>
                )}
                <div>
                  <h2 className="font-display text-xl font-bold text-[#111111]">{rider.fullName}</h2>
                  <p className="text-xs font-mono-num text-[#8C6D34] font-semibold">
                    {rider.riderCode} · {rider.vehicleType.toUpperCase()}{' '}
                    {rider.vehicleRegistration ? `(${rider.vehicleRegistration})` : ''}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
                <div className="p-3.5 bg-[#FAF8F3] border border-[#E8E8E8] rounded-2xl">
                  <p className="text-[11px] text-[#333333]/70">Assigned Total</p>
                  <p className="font-mono-num text-xl font-bold text-[#111111] mt-0.5">
                    {assignments.length}
                  </p>
                </div>
                <div className="p-3.5 bg-[#FAF8F3] border border-[#E8E8E8] rounded-2xl">
                  <p className="text-[11px] text-[#333333]/70">Customer Confirmed</p>
                  <p className="font-mono-num text-xl font-bold text-[#111111] mt-0.5">
                    {assignments.filter((a) => a.delivery.confirmation.confirmed).length}
                  </p>
                </div>
                <div className="p-3.5 bg-[#FAF8F3] border border-[#E8E8E8] rounded-2xl col-span-2 sm:col-span-1">
                  <p className="text-[11px] text-[#333333]/70">Rider Rating</p>
                  <p className="font-mono-num text-xl font-bold text-[#111111] mt-0.5 flex items-center gap-1">
                    {ratingSummary.averageRating !== null ? (
                      <>
                        <span>{ratingSummary.averageRating}</span>
                        <Star className="w-4 h-4 fill-[#C6A15B] text-[#C6A15B]" />
                      </>
                    ) : (
                      <span className="text-sm font-normal text-[#333333]/65">No ratings yet</span>
                    )}
                  </p>
                </div>
              </div>

              <div className="text-xs text-[#333333] space-y-1 pt-2 border-t border-[#E8E8E8]">
                <p>Phone: <strong className="font-mono-num">{rider.phone}</strong></p>
                <p>Email: <strong>{rider.email}</strong></p>
                <p>Zones: <strong>{rider.zoneCoverage.join(', ')}</strong></p>
              </div>
            </div>

            <div className="bg-white border border-[#E8E8E8] rounded-3xl p-6 space-y-3">
              <h3 className="font-display text-base font-bold text-[#111111]">
                Customer Feedback ({ratingSummary.reviewCount})
              </h3>
              {ratingSummary.reviews.length === 0 ? (
                <p className="text-xs text-[#333333]/75">
                  Customer ratings appear here once customers submit feedback after receiving deliveries.
                </p>
              ) : (
                <div className="space-y-3">
                  {ratingSummary.reviews.map((rev) => (
                    <div key={rev.id} className="p-4 bg-[#FAF8F3] border border-[#E8E8E8] rounded-2xl space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-[#111111]">{rev.customerDisplayName}</span>
                        <span className="font-mono-num font-bold text-[#8C6D34]">
                          {rev.overallRating} ★
                        </span>
                      </div>
                      {rev.comment && <p className="text-xs text-[#333333]">{rev.comment}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Complete Delivery + Evidence Modal */}
      {completingItem && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <form
            onSubmit={handleCompleteDelivery}
            className="w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl p-6 space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-[#111111]">
                Complete Delivery · {completingItem.delivery.orderNumber}
              </h2>
              <button
                type="button"
                onClick={() => setCompletingItem(null)}
                className="text-xs font-semibold underline cursor-pointer"
              >
                Cancel
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#111111] mb-1">
                Received By (Name)
              </label>
              <input
                type="text"
                required
                value={evRecipient}
                onChange={(e) => setEvRecipient(e.target.value)}
                className="w-full min-h-[44px] border border-[#E8E8E8] rounded-xl px-3.5 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#111111] mb-1">
                Delivery Handoff Note
              </label>
              <textarea
                rows={2}
                value={evNotes}
                onChange={(e) => setEvNotes(e.target.value)}
                placeholder="e.g. Handed package directly to customer at main gate."
                className="w-full border border-[#E8E8E8] rounded-xl p-3 text-sm"
              />
            </div>

            {evidenceRules.collectDeliveryPhoto && (
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-[#111111]">
                  Proof of Delivery Photo (Optional)
                </label>
                <label className="min-h-[44px] px-4 rounded-xl border border-dashed border-[#C6A15B] bg-[#FAF8F3] flex items-center justify-center gap-2 text-xs font-semibold text-[#111111] cursor-pointer">
                  <Camera className="w-4 h-4 text-[#C6A15B]" />
                  <span>{evUploading ? 'Uploading Photo...' : evPhotoUrl ? 'Photo Attached (Tap to Replace)' : 'Upload / Capture Photo'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleUploadEvidence(file);
                    }}
                  />
                </label>
              </div>
            )}

            {evidenceRules.collectDeliveryLocation && (
              <div className="p-3 bg-[#FAF8F3] border border-[#E8E8E8] rounded-2xl space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-[#111111]">Drop-off Location Proof</span>
                  <button
                    type="button"
                    onClick={handleCaptureGps}
                    className="text-xs font-semibold text-[#8C6D34] underline cursor-pointer"
                  >
                    {evCoords ? `Captured (${evCoords.lat}, ${evCoords.lng})` : 'Attach GPS with Consent'}
                  </button>
                </div>
                <input
                  type="text"
                  value={evLocationNote}
                  onChange={(e) => setEvLocationNote(e.target.value)}
                  placeholder="Optional street/gate note"
                  className="w-full border border-[#E8E8E8] bg-white rounded-xl px-3 py-2 text-xs"
                />
              </div>
            )}

            {completingItem.paymentMethod === 'cod' && completingItem.paymentStatus !== 'paid' && (
              <label className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-[#FAF8F3] border border-[#C6A15B]/60 text-xs text-[#111111] cursor-pointer">
                <input
                  type="checkbox"
                  checked={evCodCollected}
                  onChange={(e) => setEvCodCollected(e.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  I confirm I collected Pay on Delivery total of{' '}
                  <strong className="font-mono-num">{formatNaira(completingItem.orderTotal)}</strong>{' '}
                  (Admin will verify settlement separately).
                </span>
              </label>
            )}

            <button
              type="submit"
              disabled={busyId === completingItem.delivery.id || evUploading}
              className="w-full min-h-[46px] bg-[#111111] text-white text-xs font-bold uppercase tracking-wider rounded-full cursor-pointer"
            >
              {busyId === completingItem.delivery.id ? 'Submitting...' : 'Confirm & Mark Delivered'}
            </button>
          </form>
        </div>
      )}

      {/* Failed Delivery Modal */}
      {failingItem && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <form
            onSubmit={handleFailDelivery}
            className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-rose-800 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                <span>Report Failed Attempt</span>
              </h2>
              <button
                type="button"
                onClick={() => setFailingItem(null)}
                className="text-xs underline cursor-pointer"
              >
                Cancel
              </button>
            </div>
            <p className="text-xs text-[#333333]">
              Explain clearly why order <strong className="font-mono-num">{failingItem.delivery.orderNumber}</strong> could not be delivered right now:
            </p>
            <textarea
              required
              rows={3}
              value={failReason}
              onChange={(e) => setFailReason(e.target.value)}
              placeholder="e.g. Customer unreachable by phone after 3 attempts; rescheduled for tomorrow."
              className="w-full border border-[#E8E8E8] rounded-xl p-3 text-sm"
            />
            <button
              type="submit"
              disabled={busyId === failingItem.delivery.id}
              className="w-full min-h-[44px] bg-rose-700 text-white text-xs font-bold uppercase tracking-wider rounded-full cursor-pointer"
            >
              Submit Failed Delivery Report
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
