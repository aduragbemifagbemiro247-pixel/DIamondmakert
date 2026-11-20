import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Circle,
  Heart,
  KeyRound,
  LogOut,
  MapPin,
  MessageCircle,
  Package,
  PackageCheck,
  Phone,
  Shield,
  ShieldCheck,
  Star,
  Trash2,
  Truck,
  User,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useStore } from '../context/StoreContext.tsx';
import { isValidNigerianPhone, NIGERIAN_STATES } from '../data/nigeria.ts';
import { apiFetch } from '../lib/api.ts';
import { resetUserPassword } from '../lib/firebase.ts';
import type {
  ComplaintCategory,
  DeliveryComplaint,
  DeliveryRecord,
  Order,
} from '../types/commerce.ts';
import { formatDateShort, formatDateTime, formatNaira } from '../utils/currency.ts';
import {
  buildCustomerDeliveryTimeline,
  getDeliveryStatusLabel,
  getDeliveryStatusStyle,
} from '../utils/deliveryStatus.ts';
import { buildWhatsAppUrl } from '../utils/sanitizeHtml.ts';

type AccountTab = 'profile' | 'orders' | 'complaints' | 'addresses' | 'security';

export function CustomerDashboardPage() {
  const {
    user,
    authReady,
    isAdmin,
    profile,
    addresses,
    wishlistIds,
    updateProfileInfo,
    saveAddress,
    removeAddress,
    logout,
    navigate,
    pushToast,
  } = useStore();

  const [tab, setTab] = useState<AccountTab>('orders');
  const [orders, setOrders] = useState<Order[]>([]);
  const [deliveriesByOrderId, setDeliveriesByOrderId] = useState<Record<string, DeliveryRecord | null>>({});
  const [complaints, setComplaints] = useState<DeliveryComplaint[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // OTP & Delivery actions
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpPreview, setOtpPreview] = useState<Record<string, string>>({});
  const [confirmingOrderId, setConfirmingOrderId] = useState<string | null>(null);

  // Complaint modal
  const [issueOrder, setIssueOrder] = useState<Order | null>(null);
  const [issueCat, setIssueCat] = useState<ComplaintCategory>('order_not_received');
  const [issueSubject, setIssueSubject] = useState('');
  const [issueDesc, setIssueDesc] = useState('');
  const [issuePhotoUrl, setIssuePhotoUrl] = useState('');
  const [submittingIssue, setSubmittingIssue] = useState(false);

  // Rider review modal/card
  const [riderReviewOrderId, setRiderReviewOrderId] = useState<string | null>(null);
  const [rPolite, setRPolite] = useState(5);
  const [rComm, setRComm] = useState(5);
  const [rTime, setRTime] = useState(5);
  const [rHandling, setRHandling] = useState(5);
  const [rComment, setRComment] = useState('');
  const [ratedRiderOrderIds, setRatedRiderOrderIds] = useState<string[]>([]);

  // Verified Product Review modal
  const [reviewTarget, setReviewTarget] = useState<{ orderId: string; productId: string; productName: string } | null>(null);
  const [pRating, setPRating] = useState(5);
  const [pQuality, setPQuality] = useState(5);
  const [pAccuracy, setPAccuracy] = useState(5);
  const [pFit, setPFit] = useState<'true_to_size' | 'runs_small' | 'runs_large' | 'comfortable'>('true_to_size');
  const [pTitle, setPTitle] = useState('');
  const [pComment, setPComment] = useState('');
  const [pPhotos, setPPhotos] = useState<string[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const [displayName, setDisplayName] = useState(profile?.displayName || user?.displayName || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [savingProfile, setSavingProfile] = useState(false);

  const [addrLabel, setAddrLabel] = useState('Home');
  const [addrFirst, setAddrFirst] = useState('');
  const [addrLast, setAddrLast] = useState('');
  const [addrPhone, setAddrPhone] = useState('');
  const [addrStreet, setAddrStreet] = useState('');
  const [addrCity, setAddrCity] = useState('');
  const [addrState, setAddrState] = useState('Oyo');
  const [savingAddr, setSavingAddr] = useState(false);

  const loadAccountData = useCallback(async () => {
    if (!user) return;
    setLoadingOrders(true);
    try {
      const [ordRes, cmpRes] = await Promise.all([
        apiFetch<{ orders: Order[]; deliveriesByOrderId?: Record<string, DeliveryRecord | null> }>(
          '/api/customer/orders'
        ),
        apiFetch<{ complaints: DeliveryComplaint[] }>('/api/customer/complaints'),
      ]);
      setOrders(ordRes.orders || []);
      setDeliveriesByOrderId(ordRes.deliveriesByOrderId || {});
      setComplaints(cmpRes.complaints || []);
      if (selectedOrder) {
        const updated = (ordRes.orders || []).find((o) => o.id === selectedOrder.id) || null;
        setSelectedOrder(updated);
      }
    } catch {
      // ignore initial error
    } finally {
      setLoadingOrders(false);
    }
  }, [user, selectedOrder?.id]);

  useEffect(() => {
    if (authReady && !user) {
      navigate('/auth');
    }
  }, [authReady, user, navigate]);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName || user?.displayName || '');
      setPhone(profile.phone || '');
    }
  }, [profile, user]);

  useEffect(() => {
    if (user) {
      loadAccountData();
    }
  }, [user]);

  if (!user) return null;

  const handleRequestOtp = async (orderId: string) => {
    setOtpLoading(true);
    try {
      const res = await apiFetch<{ sent: boolean; transport: string; sandboxOtpPreview?: string }>(
        `/api/customer/orders/${encodeURIComponent(orderId)}/otp-resend`,
        { method: 'POST' }
      );
      if (res.sandboxOtpPreview) {
        setOtpPreview((prev) => ({ ...prev, [orderId]: res.sandboxOtpPreview! }));
        pushToast('Your 6-digit Delivery OTP is ready.', 'success');
      } else {
        pushToast('A fresh 6-digit Delivery OTP has been sent to your email.', 'success');
      }
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Unable to request OTP', 'error');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleConfirmDelivery = async (orderId: string) => {
    setConfirmingOrderId(orderId);
    try {
      await apiFetch(`/api/customer/orders/${encodeURIComponent(orderId)}/confirm-delivery`, {
        method: 'POST',
      });
      pushToast('Delivery confirmed! Product and rider reviews are now unlocked.', 'success');
      await loadAccountData();
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Confirmation failed', 'error');
    } finally {
      setConfirmingOrderId(null);
    }
  };

  const handleUploadComplaintPhoto = async (file: File) => {
    try {
      const fd = new FormData();
      fd.append('image', file);
      const res = await apiFetch<{ url: string }>('/api/customer/complaints/upload', {
        method: 'POST',
        body: fd,
      });
      setIssuePhotoUrl(res.url);
      pushToast('Evidence image uploaded.', 'success');
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Upload failed', 'error');
    }
  };

  const handleSubmitComplaint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!issueOrder) return;
    setSubmittingIssue(true);
    try {
      const res = await apiFetch<{ complaint: DeliveryComplaint }>('/api/customer/complaints', {
        method: 'POST',
        body: JSON.stringify({
          orderId: issueOrder.id,
          category: issueCat,
          subject: issueSubject,
          description: issueDesc,
          evidenceUrls: issuePhotoUrl ? [issuePhotoUrl] : [],
        }),
      });
      pushToast(`Issue submitted (${res.complaint.complaintNumber}). Admin team notified.`, 'success');
      setIssueOrder(null);
      setIssueSubject('');
      setIssueDesc('');
      setIssuePhotoUrl('');
      await loadAccountData();
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Unable to submit report', 'error');
    } finally {
      setSubmittingIssue(false);
    }
  };

  const handleSubmitRiderRating = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!riderReviewOrderId) return;
    try {
      await apiFetch('/api/customer/rider-reviews', {
        method: 'POST',
        body: JSON.stringify({
          orderId: riderReviewOrderId,
          politenessRating: rPolite,
          communicationRating: rComm,
          timelinessRating: rTime,
          handlingRating: rHandling,
          comment: rComment,
        }),
      });
      setRatedRiderOrderIds((prev) => [...prev, riderReviewOrderId]);
      setRiderReviewOrderId(null);
      setRComment('');
      pushToast('Thank you for rating your Diamond Market dispatch rider!', 'success');
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Could not submit rider review', 'error');
    }
  };

  const handleUploadReviewPhoto = async (file: File) => {
    setUploadingPhoto(true);
    try {
      const fd = new FormData();
      fd.append('image', file);
      const res = await apiFetch<{ url: string }>('/api/reviews/photo-upload', {
        method: 'POST',
        body: fd,
      });
      setPPhotos((prev) => [...prev, res.url].slice(0, 4));
      pushToast('Review photo attached.', 'success');
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Upload failed', 'error');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSubmitProductReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewTarget) return;
    try {
      const res = await apiFetch<{ message: string }>('/api/reviews', {
        method: 'POST',
        body: JSON.stringify({
          productId: reviewTarget.productId,
          orderId: reviewTarget.orderId,
          rating: pRating,
          qualityRating: pQuality,
          accuracyRating: pAccuracy,
          sizeFitFeedback: pFit,
          title: pTitle,
          comment: pComment,
          photos: pPhotos,
        }),
      });
      pushToast(res.message, 'success');
      setReviewTarget(null);
      setPTitle('');
      setPComment('');
      setPPhotos([]);
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Could not save review', 'error');
    }
  };

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (phone && !isValidNigerianPhone(phone)) {
      pushToast('Enter a valid Nigerian phone number (e.g., 07051959290)', 'error');
      return;
    }
    setSavingProfile(true);
    try {
      await updateProfileInfo(displayName, phone);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAddressSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidNigerianPhone(addrPhone)) {
      pushToast('Enter a valid Nigerian phone number (e.g., 07051959290)', 'error');
      return;
    }
    setSavingAddr(true);
    try {
      await saveAddress({
        id: `addr_${Date.now()}`,
        label: addrLabel,
        firstName: addrFirst,
        lastName: addrLast,
        phone: addrPhone,
        street: addrStreet,
        city: addrCity,
        state: addrState,
        country: 'NG',
        isDefault: addresses.length === 0,
      });
      setAddrStreet('');
      setAddrCity('');
    } finally {
      setSavingAddr(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!user.email) return;
    try {
      await resetUserPassword(user.email);
      pushToast(`Password reset email sent to ${user.email}`, 'success');
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Unable to send reset email', 'error');
    }
  };

  const selectedDelivery = selectedOrder ? deliveriesByOrderId[selectedOrder.id] : null;
  const selectedTimeline = selectedOrder
    ? buildCustomerDeliveryTimeline(selectedOrder, selectedDelivery)
    : null;

  return (
    <div className="bg-[#FAF8F3] min-h-screen py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#8C6D34]">
              Diamond Market · Customer Portal
            </p>
            <h1 className="font-display text-3xl font-bold text-[#111111] mt-1">
              Welcome, {profile?.displayName || user.displayName || user.email}
            </h1>
          </div>
          {isAdmin && (
            <button
              type="button"
              onClick={() => navigate('/admin')}
              className="px-5 py-2.5 bg-[#111111] text-[#C6A15B] text-xs font-bold uppercase tracking-wider rounded-full flex items-center gap-2 cursor-pointer self-start"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Open Admin Dashboard</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <aside className="lg:col-span-3 space-y-2">
            <div className="bg-white border border-[#E8E8E8] rounded-2xl p-2.5 space-y-1">
              {(
                [
                  { id: 'orders', label: 'Order History & Delivery', icon: Package },
                  { id: 'complaints', label: `Delivery Issues (${complaints.length})`, icon: AlertTriangle },
                  { id: 'profile', label: 'Profile Info', icon: User },
                  { id: 'addresses', label: 'Saved Addresses', icon: MapPin },
                  { id: 'security', label: 'Account Security', icon: Shield },
                ] as const
              ).map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setTab(item.id)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium cursor-pointer transition-colors ${
                      tab === item.id
                        ? 'bg-[#111111] text-white'
                        : 'text-[#333333] hover:bg-[#FAF8F3] hover:text-[#111111]'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => navigate('/wishlist')}
                className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-sm font-medium text-[#333333] hover:bg-[#FAF8F3] hover:text-[#111111] cursor-pointer"
              >
                <span className="flex items-center gap-3">
                  <Heart className="w-4 h-4" />
                  <span>Wishlist</span>
                </span>
                <span className="text-xs font-mono-num">{wishlistIds.length}</span>
              </button>

              <button
                type="button"
                onClick={logout}
                className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-rose-700 hover:bg-rose-50 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </aside>

          <div className="lg:col-span-9">
            {tab === 'orders' && (
              <div className="bg-white border border-[#E8E8E8] rounded-2xl p-6 space-y-5">
                <h2 className="font-display text-lg font-bold text-[#111111]">
                  Your Order History ({orders.length})
                </h2>

                {loadingOrders ? (
                  <p className="text-sm text-[#333333]/75">Loading your orders...</p>
                ) : orders.length === 0 ? (
                  <div className="bg-[#FAF8F3] border border-[#E8E8E8] rounded-2xl p-8 text-center">
                    <p className="text-sm font-semibold text-[#111111] mb-1">No orders yet</p>
                    <p className="text-xs text-[#333333]/75 mb-4">
                      Orders placed while signed in or with your matching billing email appear here.
                    </p>
                    <button
                      type="button"
                      onClick={() => navigate('/shop')}
                      className="px-5 py-2.5 bg-[#111111] text-white text-xs font-bold uppercase tracking-wider rounded-full cursor-pointer"
                    >
                      Explore Shoes &amp; Wears
                    </button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="border-b border-[#E8E8E8] text-xs text-[#333333]/70 uppercase">
                        <tr>
                          <th className="py-3 pr-4">Order</th>
                          <th className="py-3 pr-4">Date</th>
                          <th className="py-3 pr-4">Payment</th>
                          <th className="py-3 pr-4">Delivery Status</th>
                          <th className="py-3 pr-4 text-right">Total</th>
                          <th className="py-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E8E8E8]">
                        {orders.map((o) => {
                          const delStatus = deliveriesByOrderId[o.id]?.status || o.delivery.status;
                          return (
                            <tr key={o.id}>
                              <td className="py-3.5 pr-4 font-mono-num font-semibold text-[#111111]">
                                {o.orderNumber}
                              </td>
                              <td className="py-3.5 pr-4 text-xs text-[#333333]/75">
                                {formatDateShort(o.createdAt)}
                              </td>
                              <td className="py-3.5 pr-4 text-xs">
                                {o.paymentMethodTitle} ·{' '}
                                <span className="capitalize">{o.paymentStatus.replace(/_/g, ' ')}</span>
                              </td>
                              <td className="py-3.5 pr-4">
                                <span
                                  className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold border whitespace-nowrap ${getDeliveryStatusStyle(
                                    delStatus
                                  )}`}
                                >
                                  {getDeliveryStatusLabel(delStatus)}
                                </span>
                              </td>
                              <td className="py-3.5 pr-4 text-right font-mono-num font-bold">
                                {formatNaira(o.total)}
                              </td>
                              <td className="py-3.5 text-right">
                                <button
                                  type="button"
                                  onClick={() => setSelectedOrder(o)}
                                  className="text-xs font-semibold text-[#111111] underline hover:text-[#8C6D34] cursor-pointer whitespace-nowrap"
                                >
                                  Track &amp; Confirm
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {selectedOrder && selectedTimeline && (
                  <div className="mt-4 p-5 sm:p-6 bg-[#FAF8F3] border border-[#E8E8E8] rounded-3xl space-y-5">
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#E8E8E8]">
                      <div>
                        <p className="font-display font-bold text-lg text-[#111111]">
                          <span className="font-mono-num">{selectedOrder.orderNumber}</span> — Delivery &amp; Details
                        </p>
                        <p className="text-xs text-[#333333]/75">
                          {selectedOrder.billing.street}, {selectedOrder.billing.city},{' '}
                          {selectedOrder.billing.state}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedOrder(null)}
                        className="text-xs font-semibold underline cursor-pointer"
                      >
                        Close
                      </button>
                    </div>

                    {/* Action Callout: Awaiting Customer Confirmation */}
                    {selectedDelivery?.status === 'awaiting_customer_confirmation' &&
                      !selectedDelivery.confirmation.confirmed && (
                        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex flex-wrap items-center justify-between gap-3">
                          <div className="text-xs text-amber-950">
                            <p className="font-bold text-sm">Your package was marked delivered!</p>
                            <p>Please verify everything arrived cleanly and confirm receipt, or report an issue immediately.</p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={confirmingOrderId === selectedOrder.id}
                              onClick={() => handleConfirmDelivery(selectedOrder.id)}
                              className="px-5 py-2.5 bg-[#111111] text-white text-xs font-bold uppercase tracking-wider rounded-full cursor-pointer inline-flex items-center gap-1.5 whitespace-nowrap"
                            >
                              <PackageCheck className="w-4 h-4 text-[#C6A15B]" />
                              <span>
                                {confirmingOrderId === selectedOrder.id ? 'Confirming...' : 'Confirm Receipt'}
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setIssueOrder(selectedOrder)}
                              className="px-4 py-2.5 border border-rose-300 text-rose-800 bg-white text-xs font-semibold rounded-full cursor-pointer whitespace-nowrap"
                            >
                              Report Delivery Issue
                            </button>
                          </div>
                        </div>
                      )}

                    {/* Customer Delivery Confirmation Badge */}
                    {selectedDelivery?.confirmation.confirmed && (
                      <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center gap-3 text-xs text-emerald-900">
                        <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0" />
                        <span>
                          Receipt confirmed on{' '}
                          <strong>
                            {selectedDelivery.confirmation.confirmedAt
                              ? formatDateTime(selectedDelivery.confirmation.confirmedAt)
                              : 'record'}
                          </strong>
                          . Verified product and rider feedback unlocked below.
                        </span>
                      </div>
                    )}

                    {/* OTP Request / Preview Panel */}
                    {selectedDelivery?.otpRequired && !selectedDelivery.otpVerified && selectedDelivery.status !== 'cancelled' && (
                      <div className="p-4 rounded-2xl bg-white border border-[#C6A15B]/50 flex flex-wrap items-center justify-between gap-3">
                        <div className="space-y-1 text-xs">
                          <p className="font-bold text-[#111111] flex items-center gap-1.5">
                            <KeyRound className="w-4 h-4 text-[#C6A15B]" />
                            <span>One-Time Delivery Verification Code (OTP)</span>
                          </p>
                          <p className="text-[#333333]/75">
                            Share this 6-digit code ONLY with your rider when inspecting your items.
                          </p>
                          {otpPreview[selectedOrder.id] && (
                            <div className="inline-block mt-1 px-4 py-2 bg-[#111111] text-white rounded-xl font-mono-num text-lg font-bold tracking-[0.25em]">
                              {otpPreview[selectedOrder.id]}
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          disabled={otpLoading}
                          onClick={() => handleRequestOtp(selectedOrder.id)}
                          className="px-4 py-2.5 bg-[#111111] text-white text-xs font-bold uppercase tracking-wider rounded-full cursor-pointer whitespace-nowrap"
                        >
                          {otpLoading ? 'Sending...' : 'Send / Resend OTP'}
                        </button>
                      </div>
                    )}

                    {/* Assigned Rider Details Card */}
                    {selectedDelivery?.riderName && (
                      <div className="p-4 rounded-2xl bg-white border border-[#E8E8E8] flex flex-wrap items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-[#111111] text-[#C6A15B] flex items-center justify-center shrink-0">
                            <Truck className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-wider font-bold text-[#8C6D34]">
                              Assigned Dispatch Rider
                            </p>
                            <p className="font-bold text-sm text-[#111111]">
                              {selectedDelivery.riderName} ({selectedDelivery.riderCode})
                            </p>
                            {selectedDelivery.riderVehicle && (
                              <p className="text-[#333333]/75 capitalize">{selectedDelivery.riderVehicle}</p>
                            )}
                          </div>
                        </div>
                        {selectedDelivery.riderPhone && (
                          <div className="flex flex-wrap gap-2">
                            <a
                              href={`tel:${selectedDelivery.riderPhone}`}
                              className="px-3.5 py-2 rounded-full border border-[#E8E8E8] font-semibold text-[#111111] inline-flex items-center gap-1.5"
                            >
                              <Phone className="w-3.5 h-3.5 text-[#C6A15B]" />
                              <span>Call</span>
                            </a>
                            <a
                              href={buildWhatsAppUrl(
                                selectedDelivery.riderWhatsapp || selectedDelivery.riderPhone,
                                `Hello ${selectedDelivery.riderName}, regarding order ${selectedOrder.orderNumber}.`
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

                    {/* 9-Stage Factual Timeline */}
                    <div className="bg-white border border-[#E8E8E8] rounded-2xl p-4 space-y-3">
                      <p className="text-xs font-bold uppercase tracking-wider text-[#111111]">
                        Delivery Progress Timeline
                      </p>
                      <div className="space-y-2 border-l-2 border-[#E8E8E8] ml-2 pl-4">
                        {selectedTimeline.stages.map((st) => (
                          <div key={st.key} className="relative flex items-center justify-between gap-2 text-xs">
                            <span className="absolute -left-[25px] bg-white">
                              {st.completed ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                              ) : st.active ? (
                                <Circle className="w-4 h-4 text-[#C6A15B] fill-[#C6A15B]/30" />
                              ) : (
                                <Circle className="w-4 h-4 text-neutral-300" />
                              )}
                            </span>
                            <span className={st.completed || st.active ? 'font-semibold text-[#111111]' : 'text-[#333333]/55'}>
                              {st.label}
                            </span>
                            <span className="text-[11px] font-mono-num text-[#333333]/65">
                              {st.timestamp ? formatDateTime(st.timestamp) : 'Pending'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Items + Post-Delivery Product Review Action */}
                    <div className="divide-y divide-[#E8E8E8] bg-white rounded-2xl p-4 border border-[#E8E8E8]">
                      {selectedOrder.items.map((item, idx) => (
                        <div key={idx} className="py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                          <div>
                            <span className="font-semibold text-[#111111]">
                              {item.name} × {item.quantity}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            {(selectedDelivery?.status === 'delivered_customer_confirmed' ||
                              selectedDelivery?.status === 'awaiting_customer_confirmation') && (
                              <button
                                type="button"
                                onClick={() =>
                                  setReviewTarget({
                                    orderId: selectedOrder.id,
                                    productId: item.productId,
                                    productName: item.name,
                                  })
                                }
                                className="text-xs font-semibold text-[#8C6D34] underline hover:text-[#111111] cursor-pointer"
                              >
                                Write Verified Review
                              </button>
                            )}
                            <span className="font-mono-num font-semibold">{formatNaira(item.total)}</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2">
                      {selectedDelivery?.riderId &&
                        ['awaiting_customer_confirmation', 'delivered_customer_confirmed'].includes(
                          selectedDelivery.status
                        ) &&
                        !ratedRiderOrderIds.includes(selectedOrder.id) && (
                          <button
                            type="button"
                            onClick={() => setRiderReviewOrderId(selectedOrder.id)}
                            className="px-4 py-2 rounded-full border border-[#111111] text-xs font-semibold text-[#111111] hover:bg-[#111111] hover:text-white cursor-pointer inline-flex items-center gap-1.5"
                          >
                            <Star className="w-3.5 h-3.5 text-[#C6A15B]" />
                            <span>Rate Dispatch Rider ({selectedDelivery.riderName})</span>
                          </button>
                        )}
                      {selectedDelivery?.status !== 'cancelled' && (
                        <button
                          type="button"
                          onClick={() => setIssueOrder(selectedOrder)}
                          className="text-xs text-rose-700 font-semibold underline cursor-pointer ml-auto"
                        >
                          Report Delivery Problem
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {tab === 'complaints' && (
              <div className="bg-white border border-[#E8E8E8] rounded-2xl p-6 space-y-4">
                <h2 className="font-display text-lg font-bold text-[#111111]">
                  My Delivery Complaints &amp; Support Tickets ({complaints.length})
                </h2>
                {complaints.length === 0 ? (
                  <p className="text-xs text-[#333333]/75">
                    You have not opened any delivery issue tickets. If you ever experience a problem with an order delivery, select &ldquo;Report Delivery Problem&rdquo; from your Order Details.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {complaints.map((c) => (
                      <div key={c.id} className="p-4 rounded-2xl bg-[#FAF8F3] border border-[#E8E8E8] space-y-2 text-xs">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-mono-num font-bold text-[#111111]">
                            {c.complaintNumber} · Order {c.orderNumber}
                          </span>
                          <span className="px-2.5 py-0.5 rounded-full bg-white border border-[#E8E8E8] font-bold capitalize">
                            {c.status.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <p className="font-semibold text-[#111111]">{c.subject}</p>
                        <p className="text-[#333333]/80">{c.description}</p>
                        {c.resolutionSummary && (
                          <div className="p-3 bg-white border border-emerald-200 rounded-xl text-emerald-900">
                            <strong>Admin Resolution:</strong> {c.resolutionSummary}
                          </div>
                        )}
                        <p className="text-[11px] text-[#333333]/65">Submitted {formatDateTime(c.createdAt)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {tab === 'profile' && (
              <div className="bg-white border border-[#E8E8E8] rounded-2xl p-6 max-w-xl space-y-5">
                <h2 className="font-display text-lg font-bold text-[#111111]">
                  Personal Information
                </h2>
                <form onSubmit={handleProfileSave} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#111111] mb-1.5">
                      Email Address
                    </label>
                    <input
                      type="email"
                      disabled
                      value={user.email || ''}
                      className="w-full border border-[#E8E8E8] bg-[#FAF8F3] rounded-xl px-3.5 py-2.5 text-sm text-[#333333]/70"
                    />
                  </div>
                  <div>
                    <label htmlFor="prof-name" className="block text-xs font-semibold text-[#111111] mb-1.5">
                      Full Name
                    </label>
                    <input
                      id="prof-name"
                      type="text"
                      required
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="w-full border border-[#E8E8E8] rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#111111]"
                    />
                  </div>
                  <div>
                    <label htmlFor="prof-phone" className="block text-xs font-semibold text-[#111111] mb-1.5">
                      Nigerian Phone Number
                    </label>
                    <input
                      id="prof-phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="07051959290"
                      className="w-full border border-[#E8E8E8] rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#111111]"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={savingProfile}
                    className="px-6 py-2.5 bg-[#111111] text-white text-xs font-bold uppercase tracking-wider rounded-full hover:bg-[#2a2a2a] cursor-pointer"
                  >
                    {savingProfile ? 'Saving...' : 'Save Profile'}
                  </button>
                </form>
              </div>
            )}

            {tab === 'addresses' && (
              <div className="space-y-6">
                <div className="bg-white border border-[#E8E8E8] rounded-2xl p-6 space-y-4">
                  <h2 className="font-display text-lg font-bold text-[#111111]">
                    Saved Nigerian Delivery Addresses ({addresses.length})
                  </h2>
                  {addresses.length === 0 ? (
                    <p className="text-sm text-[#333333]/75">No saved addresses yet.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {addresses.map((addr) => (
                        <div
                          key={addr.id}
                          className="border border-[#E8E8E8] bg-[#FAF8F3]/60 rounded-2xl p-4 flex justify-between gap-3"
                        >
                          <div className="text-xs space-y-1">
                            <p className="font-bold text-[#111111]">{addr.label}</p>
                            <p>
                              {addr.firstName} {addr.lastName}
                            </p>
                            <p className="text-[#333333]/80">{addr.street}</p>
                            <p className="text-[#333333]/80">
                              {addr.city}, {addr.state}
                            </p>
                            <p className="font-mono-num text-[#111111]">{addr.phone}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeAddress(addr.id)}
                            aria-label="Delete address"
                            className="text-neutral-400 hover:text-rose-700 self-start p-1 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-white border border-[#E8E8E8] rounded-2xl p-6">
                  <h3 className="font-display text-base font-bold text-[#111111] mb-4">
                    Add New Delivery Address
                  </h3>
                  <form onSubmit={handleAddressSave} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <input
                      type="text"
                      required
                      value={addrLabel}
                      onChange={(e) => setAddrLabel(e.target.value)}
                      placeholder="Label (Home, Office)"
                      className="border border-[#E8E8E8] rounded-xl px-3.5 py-2.5 text-sm"
                    />
                    <input
                      type="tel"
                      required
                      value={addrPhone}
                      onChange={(e) => setAddrPhone(e.target.value)}
                      placeholder="07051959290"
                      className="border border-[#E8E8E8] rounded-xl px-3.5 py-2.5 text-sm"
                    />
                    <input
                      type="text"
                      required
                      value={addrFirst}
                      onChange={(e) => setAddrFirst(e.target.value)}
                      placeholder="First Name"
                      className="border border-[#E8E8E8] rounded-xl px-3.5 py-2.5 text-sm"
                    />
                    <input
                      type="text"
                      required
                      value={addrLast}
                      onChange={(e) => setAddrLast(e.target.value)}
                      placeholder="Last Name"
                      className="border border-[#E8E8E8] rounded-xl px-3.5 py-2.5 text-sm"
                    />
                    <input
                      type="text"
                      required
                      value={addrStreet}
                      onChange={(e) => setAddrStreet(e.target.value)}
                      placeholder="Street Address / Landmark"
                      className="sm:col-span-2 border border-[#E8E8E8] rounded-xl px-3.5 py-2.5 text-sm"
                    />
                    <input
                      type="text"
                      required
                      value={addrCity}
                      onChange={(e) => setAddrCity(e.target.value)}
                      placeholder="City / LGA (e.g. Ogbomoso)"
                      className="border border-[#E8E8E8] rounded-xl px-3.5 py-2.5 text-sm"
                    />
                    <select
                      value={addrState}
                      onChange={(e) => setAddrState(e.target.value)}
                      className="border border-[#E8E8E8] rounded-xl px-3.5 py-2.5 text-sm bg-white"
                    >
                      {NIGERIAN_STATES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                    <button
                      type="submit"
                      disabled={savingAddr}
                      className="sm:col-span-2 py-2.5 bg-[#111111] text-white text-xs font-bold uppercase tracking-wider rounded-full cursor-pointer"
                    >
                      {savingAddr ? 'Saving...' : 'Save Address'}
                    </button>
                  </form>
                </div>
              </div>
            )}

            {tab === 'security' && (
              <div className="bg-white border border-[#E8E8E8] rounded-2xl p-6 max-w-xl space-y-4">
                <h2 className="font-display text-lg font-bold text-[#111111]">
                  Account Security
                </h2>
                <div className="text-sm text-[#333333]/80 space-y-1">
                  <p>
                    Signed in as <strong className="text-[#111111]">{user.email}</strong>
                  </p>
                  <p>
                    Email Verification:{' '}
                    <strong className="text-[#111111]">
                      {user.emailVerified ? 'Verified' : 'Unverified'}
                    </strong>
                  </p>
                  <p>
                    Role:{' '}
                    <strong className="text-[#111111]">{isAdmin ? 'Administrator' : 'Customer'}</strong>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handlePasswordReset}
                  className="px-5 py-2.5 border border-[#111111] text-[#111111] text-xs font-bold uppercase tracking-wider rounded-full hover:bg-[#111111] hover:text-white transition-colors cursor-pointer"
                >
                  Send Password Reset Email
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Report Delivery Issue Modal */}
      {issueOrder && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <form
            onSubmit={handleSubmitComplaint}
            className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-[#111111]">
                Report Delivery Issue · {issueOrder.orderNumber}
              </h3>
              <button
                type="button"
                onClick={() => setIssueOrder(null)}
                className="text-xs underline cursor-pointer"
              >
                Cancel
              </button>
            </div>
            <select
              value={issueCat}
              onChange={(e) => setIssueCat(e.target.value as ComplaintCategory)}
              className="w-full border border-[#E8E8E8] rounded-xl px-3.5 py-2.5 text-sm bg-white"
            >
              <option value="order_not_received">Order Not Received</option>
              <option value="wrong_item">Wrong Item / Size</option>
              <option value="missing_item">Missing Item</option>
              <option value="damaged_item">Damaged Item</option>
              <option value="rider_misconduct">Rider Conduct</option>
              <option value="delivery_delay">Delivery Delay</option>
              <option value="other">Other</option>
            </select>
            <input
              type="text"
              required
              value={issueSubject}
              onChange={(e) => setIssueSubject(e.target.value)}
              placeholder="Summary subject"
              className="w-full border border-[#E8E8E8] rounded-xl px-3.5 py-2.5 text-sm"
            />
            <textarea
              rows={3}
              required
              value={issueDesc}
              onChange={(e) => setIssueDesc(e.target.value)}
              placeholder="Describe the issue clearly..."
              className="w-full border border-[#E8E8E8] rounded-xl p-3 text-sm"
            />
            <label className="px-4 py-2.5 border border-dashed border-[#C6A15B] rounded-xl flex items-center gap-2 text-xs font-semibold cursor-pointer">
              <Camera className="w-4 h-4 text-[#C6A15B]" />
              <span>{issuePhotoUrl ? 'Photo Attached (Replace)' : 'Attach Evidence Photo (Optional)'}</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleUploadComplaintPhoto(file);
                }}
              />
            </label>
            <button
              type="submit"
              disabled={submittingIssue}
              className="w-full py-3 bg-rose-700 text-white text-xs font-bold uppercase tracking-wider rounded-full cursor-pointer"
            >
              {submittingIssue ? 'Submitting...' : 'Submit Delivery Report'}
            </button>
          </form>
        </div>
      )}

      {/* Rider Rating Modal */}
      {riderReviewOrderId && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <form
            onSubmit={handleSubmitRiderRating}
            className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-[#111111]">Rate Dispatch Rider</h3>
              <button
                type="button"
                onClick={() => setRiderReviewOrderId(null)}
                className="text-xs underline cursor-pointer"
              >
                Cancel
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <label className="space-y-1">
                <span className="font-semibold">Politeness (1–5)</span>
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={rPolite}
                  onChange={(e) => setRPolite(Number(e.target.value))}
                  className="w-full border border-[#E8E8E8] rounded-xl px-3 py-2"
                />
              </label>
              <label className="space-y-1">
                <span className="font-semibold">Communication (1–5)</span>
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={rComm}
                  onChange={(e) => setRComm(Number(e.target.value))}
                  className="w-full border border-[#E8E8E8] rounded-xl px-3 py-2"
                />
              </label>
              <label className="space-y-1">
                <span className="font-semibold">Timeliness (1–5)</span>
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={rTime}
                  onChange={(e) => setRTime(Number(e.target.value))}
                  className="w-full border border-[#E8E8E8] rounded-xl px-3 py-2"
                />
              </label>
              <label className="space-y-1">
                <span className="font-semibold">Package Handling (1–5)</span>
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={rHandling}
                  onChange={(e) => setRHandling(Number(e.target.value))}
                  className="w-full border border-[#E8E8E8] rounded-xl px-3 py-2"
                />
              </label>
            </div>
            <textarea
              rows={2}
              value={rComment}
              onChange={(e) => setRComment(e.target.value)}
              placeholder="Optional delivery feedback..."
              className="w-full border border-[#E8E8E8] rounded-xl p-3 text-sm"
            />
            <button
              type="submit"
              className="w-full py-3 bg-[#111111] text-white text-xs font-bold uppercase tracking-wider rounded-full cursor-pointer"
            >
              Submit Rider Rating
            </button>
          </form>
        </div>
      )}

      {/* Enhanced Product Review Modal */}
      {reviewTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <form
            onSubmit={handleSubmitProductReview}
            className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-[#111111] truncate">
                Review: {reviewTarget.productName}
              </h3>
              <button
                type="button"
                onClick={() => setReviewTarget(null)}
                className="text-xs underline cursor-pointer"
              >
                Cancel
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <label className="space-y-1">
                <span className="font-semibold">Overall</span>
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={pRating}
                  onChange={(e) => setPRating(Number(e.target.value))}
                  className="w-full border border-[#E8E8E8] rounded-xl px-3 py-2"
                />
              </label>
              <label className="space-y-1">
                <span className="font-semibold">Quality</span>
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={pQuality}
                  onChange={(e) => setPQuality(Number(e.target.value))}
                  className="w-full border border-[#E8E8E8] rounded-xl px-3 py-2"
                />
              </label>
              <label className="space-y-1">
                <span className="font-semibold">Accuracy</span>
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={pAccuracy}
                  onChange={(e) => setPAccuracy(Number(e.target.value))}
                  className="w-full border border-[#E8E8E8] rounded-xl px-3 py-2"
                />
              </label>
              <label className="space-y-1">
                <span className="font-semibold">Size / Fit</span>
                <select
                  value={pFit}
                  onChange={(e) => setPFit(e.target.value as typeof pFit)}
                  className="w-full border border-[#E8E8E8] rounded-xl px-2 py-2 bg-white"
                >
                  <option value="true_to_size">True to Size</option>
                  <option value="runs_small">Runs Small</option>
                  <option value="runs_large">Runs Large</option>
                  <option value="comfortable">Comfortable</option>
                </select>
              </label>
            </div>
            <input
              type="text"
              value={pTitle}
              onChange={(e) => setPTitle(e.target.value)}
              placeholder="Review title (optional)"
              className="w-full border border-[#E8E8E8] rounded-xl px-3.5 py-2.5 text-sm"
            />
            <textarea
              rows={3}
              required
              value={pComment}
              onChange={(e) => setPComment(e.target.value)}
              placeholder="Tell other Diamond Market shoppers about material, sizing, and delivery..."
              className="w-full border border-[#E8E8E8] rounded-xl p-3 text-sm"
            />
            <label className="px-4 py-2.5 border border-dashed border-[#C6A15B] rounded-xl flex items-center gap-2 text-xs font-semibold cursor-pointer">
              <Camera className="w-4 h-4 text-[#C6A15B]" />
              <span>
                {uploadingPhoto
                  ? 'Uploading Photo...'
                  : pPhotos.length > 0
                  ? `${pPhotos.length} photo(s) attached — add more`
                  : 'Upload Product Photo (Optional)'}
              </span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleUploadReviewPhoto(file);
                }}
              />
            </label>
            <button
              type="submit"
              disabled={uploadingPhoto}
              className="w-full py-3 bg-[#111111] text-white text-xs font-bold uppercase tracking-wider rounded-full cursor-pointer"
            >
              Submit Verified Review
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
