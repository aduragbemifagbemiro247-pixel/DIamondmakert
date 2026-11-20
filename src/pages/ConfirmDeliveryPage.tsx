import { AlertTriangle, CheckCircle2, PackageCheck, Star, Truck } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useStore } from '../context/StoreContext.tsx';
import { apiFetch } from '../lib/api.ts';
import type { ComplaintCategory, DeliveryStatus } from '../types/commerce.ts';
import { formatDateTime } from '../utils/currency.ts';
import { getDeliveryStatusLabel, getDeliveryStatusStyle } from '../utils/deliveryStatus.ts';

interface ConfirmationPreview {
  orderId: string;
  orderNumber: string;
  deliveryStatus: DeliveryStatus;
  alreadyConfirmed: boolean;
  disputed: boolean;
  deliveredAt?: string;
  estimatedDeliveryDate?: string;
  riderId?: string | null;
  riderName?: string;
  riderVehicle?: string;
  items: {
    productId: string;
    name: string;
    quantity: number;
    image: string;
    attributes?: Record<string, string>;
  }[];
}

export function ConfirmDeliveryPage({ token }: { token: string }) {
  const { navigate, pushToast } = useStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ConfirmationPreview | null>(null);
  const [mode, setMode] = useState<'confirm' | 'issue'>(() =>
    typeof window !== 'undefined' && window.location.search.includes('mode=issue') ? 'issue' : 'confirm'
  );
  const [confirming, setConfirming] = useState(false);

  // Complaint state
  const [category, setCategory] = useState<ComplaintCategory>('order_not_received');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [submittingIssue, setSubmittingIssue] = useState(false);
  const [issueSubmittedNumber, setIssueSubmittedNumber] = useState<string | null>(null);

  // Post-confirmation Review state
  const [selectedProductId, setSelectedProductId] = useState('');
  const [prodRating, setProdRating] = useState(5);
  const [prodQuality, setProdQuality] = useState(5);
  const [prodAccuracy, setProdAccuracy] = useState(5);
  const [prodFit, setProdFit] = useState<'true_to_size' | 'runs_small' | 'runs_large' | 'comfortable'>('true_to_size');
  const [prodTitle, setProdTitle] = useState('');
  const [prodComment, setProdComment] = useState('');
  const [prodSent, setProdSent] = useState(false);

  const [riderPoliteness, setRiderPoliteness] = useState(5);
  const [riderComm, setRiderComm] = useState(5);
  const [riderTime, setRiderTime] = useState(5);
  const [riderHandling, setRiderHandling] = useState(5);
  const [riderComment, setRiderComment] = useState('');
  const [riderSent, setRiderSent] = useState(false);

  useEffect(() => {
    setLoading(true);
    apiFetch<ConfirmationPreview>(`/api/confirm-delivery/${encodeURIComponent(token)}`)
      .then((res) => {
        setPreview(res);
        if (res.items.length > 0) {
          setSelectedProductId(res.items[0].productId);
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Invalid confirmation link'))
      .finally(() => setLoading(false));
  }, [token]);

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      await apiFetch(`/api/confirm-delivery/${encodeURIComponent(token)}`, { method: 'POST' });
      const fresh = await apiFetch<ConfirmationPreview>(`/api/confirm-delivery/${encodeURIComponent(token)}`);
      setPreview(fresh);
      pushToast('Thank you! Your delivery receipt has been confirmed.', 'success');
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Could not confirm receipt', 'error');
    } finally {
      setConfirming(false);
    }
  };

  const handleSubmitIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingIssue(true);
    try {
      const res = await apiFetch<{ complaint: { complaintNumber: string } }>(
        `/api/confirm-delivery/${encodeURIComponent(token)}/issue`,
        {
          method: 'POST',
          body: JSON.stringify({ category, subject, description }),
        }
      );
      setIssueSubmittedNumber(res.complaint.complaintNumber);
      pushToast(`Issue reported (${res.complaint.complaintNumber}). Our team will reach out.`, 'success');
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Could not submit issue', 'error');
    } finally {
      setSubmittingIssue(false);
    }
  };

  const handleSubmitProductReview = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch(`/api/confirm-delivery/${encodeURIComponent(token)}/product-review`, {
        method: 'POST',
        body: JSON.stringify({
          productId: selectedProductId,
          rating: prodRating,
          qualityRating: prodQuality,
          accuracyRating: prodAccuracy,
          sizeFitFeedback: prodFit,
          title: prodTitle,
          comment: prodComment,
        }),
      });
      setProdSent(true);
      pushToast('Verified product review submitted!', 'success');
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Unable to save review', 'error');
    }
  };

  const handleSubmitRiderReview = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch(`/api/confirm-delivery/${encodeURIComponent(token)}/rider-review`, {
        method: 'POST',
        body: JSON.stringify({
          politenessRating: riderPoliteness,
          communicationRating: riderComm,
          timelinessRating: riderTime,
          handlingRating: riderHandling,
          comment: riderComment,
        }),
      });
      setRiderSent(true);
      pushToast('Thank you for rating your Diamond Market dispatch rider!', 'success');
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Unable to save rider rating', 'error');
    }
  };

  if (loading) {
    return (
      <div className="bg-[#FAF8F3] min-h-[70vh] flex items-center justify-center p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#333333]">
          Loading Confirmation Details...
        </p>
      </div>
    );
  }

  if (error || !preview) {
    return (
      <div className="bg-[#FAF8F3] min-h-[70vh] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-[#E8E8E8] rounded-3xl p-8 text-center space-y-4">
          <AlertTriangle className="w-8 h-8 text-rose-600 mx-auto" />
          <h1 className="font-display text-xl font-bold text-[#111111]">Link Unavailable</h1>
          <p className="text-xs text-[#333333]/80">{error || 'Invalid delivery confirmation link.'}</p>
          <button
            type="button"
            onClick={() => navigate('/track-order')}
            className="px-6 py-2.5 bg-[#111111] text-white text-xs font-bold uppercase tracking-wider rounded-full cursor-pointer"
          >
            Track Order
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#FAF8F3] min-h-[75vh] py-12">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 space-y-6">
        <div className="bg-white border border-[#E8E8E8] rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-[#E8E8E8]">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#8C6D34]">
                Diamond Market Delivery Confirmation
              </p>
              <h1 className="font-display text-2xl font-bold text-[#111111] mt-1 font-mono-num">
                Order {preview.orderNumber}
              </h1>
              {preview.deliveredAt && (
                <p className="text-xs text-[#333333]/75 mt-0.5">
                  Recorded delivered: {formatDateTime(preview.deliveredAt)}
                </p>
              )}
            </div>
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold border ${getDeliveryStatusStyle(
                preview.deliveryStatus
              )}`}
            >
              {getDeliveryStatusLabel(preview.deliveryStatus)}
            </span>
          </div>

          {preview.riderName && (
            <div className="p-4 rounded-2xl bg-[#FAF8F3] border border-[#E8E8E8] flex items-center gap-3 text-xs">
              <Truck className="w-4 h-4 text-[#C6A15B] shrink-0" />
              <span>
                Delivered by <strong>{preview.riderName}</strong>
                {preview.riderVehicle ? ` (${preview.riderVehicle})` : ''}
              </span>
            </div>
          )}

          <div className="divide-y divide-[#E8E8E8] border border-[#E8E8E8] rounded-2xl px-4">
            {preview.items.map((item, idx) => (
              <div key={idx} className="py-3 flex items-center gap-3">
                {item.image && (
                  <img
                    src={item.image}
                    alt={item.name}
                    className="w-12 h-12 rounded-xl object-cover border border-[#E8E8E8] shrink-0"
                  />
                )}
                <div className="min-w-0 flex-1 text-xs">
                  <p className="font-semibold text-[#111111] truncate">{item.name}</p>
                  <p className="text-[#333333]/75">
                    Qty: {item.quantity}
                    {item.attributes && Object.keys(item.attributes).length > 0
                      ? ` · ${Object.values(item.attributes).join(' / ')}`
                      : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {preview.alreadyConfirmed ? (
            <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-emerald-700 shrink-0" />
              <div className="text-xs text-emerald-900">
                <p className="font-bold text-sm">Delivery Confirmed</p>
                <p>Thank you for confirming receipt of your Diamond Market order. You can leave your feedback below.</p>
              </div>
            </div>
          ) : issueSubmittedNumber ? (
            <div className="p-5 rounded-2xl bg-amber-50 border border-amber-200 space-y-1 text-xs text-amber-950">
              <p className="font-bold text-sm">Issue Ticket Opened: {issueSubmittedNumber}</p>
              <p>Our customer resolution desk is reviewing your delivery record and will contact you shortly.</p>
            </div>
          ) : mode === 'confirm' ? (
            <div className="space-y-3">
              <p className="text-xs text-[#333333]">
                Please inspect your shoes, wears, or accessories carefully before confirming receipt.
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={confirming}
                  onClick={handleConfirm}
                  className="px-6 py-3 bg-[#111111] text-white text-xs font-bold uppercase tracking-wider rounded-full hover:bg-[#2a2a2a] cursor-pointer inline-flex items-center gap-2"
                >
                  <PackageCheck className="w-4 h-4 text-[#C6A15B]" />
                  <span>{confirming ? 'Confirming...' : 'I Confirm Receipt of Order'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMode('issue')}
                  className="px-5 py-3 border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-semibold rounded-full cursor-pointer"
                >
                  Report a Problem
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmitIssue} className="space-y-4 pt-2 border-t border-[#E8E8E8]">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-base font-bold text-[#111111]">Report Delivery Issue</h2>
                <button
                  type="button"
                  onClick={() => setMode('confirm')}
                  className="text-xs underline cursor-pointer"
                >
                  Back
                </button>
              </div>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ComplaintCategory)}
                className="w-full border border-[#E8E8E8] rounded-xl px-3.5 py-2.5 text-sm bg-white"
              >
                <option value="order_not_received">Order Marked Delivered But Not Received</option>
                <option value="wrong_item">Wrong Item / Wrong Size Delivered</option>
                <option value="missing_item">Missing Item From Package</option>
                <option value="damaged_item">Damaged Item on Arrival</option>
                <option value="rider_misconduct">Rider Conduct Issue</option>
                <option value="delivery_delay">Severe Delivery Delay</option>
                <option value="other">Other Delivery Issue</option>
              </select>
              <input
                type="text"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Brief issue summary"
                className="w-full border border-[#E8E8E8] rounded-xl px-3.5 py-2.5 text-sm"
              />
              <textarea
                rows={3}
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what happened in detail..."
                className="w-full border border-[#E8E8E8] rounded-xl p-3 text-sm"
              />
              <button
                type="submit"
                disabled={submittingIssue}
                className="px-6 py-3 bg-rose-700 text-white text-xs font-bold uppercase tracking-wider rounded-full cursor-pointer"
              >
                {submittingIssue ? 'Submitting Report...' : 'Submit Delivery Issue'}
              </button>
            </form>
          )}
        </div>

        {/* Post-Confirmation Verified Reviews */}
        {preview.alreadyConfirmed && (
          <div className="space-y-5">
            {!prodSent && (
              <form
                onSubmit={handleSubmitProductReview}
                className="bg-white border border-[#E8E8E8] rounded-3xl p-6 space-y-4"
              >
                <h2 className="font-display text-lg font-bold text-[#111111] flex items-center gap-2">
                  <Star className="w-4 h-4 text-[#C6A15B] fill-[#C6A15B]" />
                  <span>Rate Your Purchased Item</span>
                </h2>
                <select
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  className="w-full border border-[#E8E8E8] rounded-xl px-3.5 py-2.5 text-sm bg-white"
                >
                  {preview.items.map((it) => (
                    <option key={it.productId} value={it.productId}>
                      {it.name}
                    </option>
                  ))}
                </select>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <label className="space-y-1">
                    <span className="font-semibold">Overall (1–5)</span>
                    <input
                      type="number"
                      min={1}
                      max={5}
                      value={prodRating}
                      onChange={(e) => setProdRating(Number(e.target.value))}
                      className="w-full border border-[#E8E8E8] rounded-xl px-3 py-2"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="font-semibold">Quality (1–5)</span>
                    <input
                      type="number"
                      min={1}
                      max={5}
                      value={prodQuality}
                      onChange={(e) => setProdQuality(Number(e.target.value))}
                      className="w-full border border-[#E8E8E8] rounded-xl px-3 py-2"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="font-semibold">Accuracy (1–5)</span>
                    <input
                      type="number"
                      min={1}
                      max={5}
                      value={prodAccuracy}
                      onChange={(e) => setProdAccuracy(Number(e.target.value))}
                      className="w-full border border-[#E8E8E8] rounded-xl px-3 py-2"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="font-semibold">Size / Fit</span>
                    <select
                      value={prodFit}
                      onChange={(e) => setProdFit(e.target.value as typeof prodFit)}
                      className="w-full border border-[#E8E8E8] rounded-xl px-2.5 py-2 bg-white"
                    >
                      <option value="true_to_size">True to Size</option>
                      <option value="runs_small">Runs Small</option>
                      <option value="runs_large">Runs Large</option>
                      <option value="comfortable">Comfortable Fit</option>
                    </select>
                  </label>
                </div>
                <input
                  type="text"
                  value={prodTitle}
                  onChange={(e) => setProdTitle(e.target.value)}
                  placeholder="Review headline (optional)"
                  className="w-full border border-[#E8E8E8] rounded-xl px-3.5 py-2 text-sm"
                />
                <textarea
                  rows={3}
                  required
                  value={prodComment}
                  onChange={(e) => setProdComment(e.target.value)}
                  placeholder="Share how the craftsmanship, sizing, and comfort turned out..."
                  className="w-full border border-[#E8E8E8] rounded-xl p-3 text-sm"
                />
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-[#111111] text-white text-xs font-bold uppercase tracking-wider rounded-full cursor-pointer"
                >
                  Submit Product Review
                </button>
              </form>
            )}

            {preview.riderId && !riderSent && (
              <form
                onSubmit={handleSubmitRiderReview}
                className="bg-white border border-[#E8E8E8] rounded-3xl p-6 space-y-4"
              >
                <h2 className="font-display text-lg font-bold text-[#111111]">
                  Rate Dispatch Rider ({preview.riderName})
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <label className="space-y-1">
                    <span className="font-semibold">Politeness</span>
                    <input
                      type="number"
                      min={1}
                      max={5}
                      value={riderPoliteness}
                      onChange={(e) => setRiderPoliteness(Number(e.target.value))}
                      className="w-full border border-[#E8E8E8] rounded-xl px-3 py-2"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="font-semibold">Communication</span>
                    <input
                      type="number"
                      min={1}
                      max={5}
                      value={riderComm}
                      onChange={(e) => setRiderComm(Number(e.target.value))}
                      className="w-full border border-[#E8E8E8] rounded-xl px-3 py-2"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="font-semibold">Timeliness</span>
                    <input
                      type="number"
                      min={1}
                      max={5}
                      value={riderTime}
                      onChange={(e) => setRiderTime(Number(e.target.value))}
                      className="w-full border border-[#E8E8E8] rounded-xl px-3 py-2"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="font-semibold">Handling</span>
                    <input
                      type="number"
                      min={1}
                      max={5}
                      value={riderHandling}
                      onChange={(e) => setRiderHandling(Number(e.target.value))}
                      className="w-full border border-[#E8E8E8] rounded-xl px-3 py-2"
                    />
                  </label>
                </div>
                <textarea
                  rows={2}
                  value={riderComment}
                  onChange={(e) => setRiderComment(e.target.value)}
                  placeholder="Optional comment about your delivery experience..."
                  className="w-full border border-[#E8E8E8] rounded-xl p-3 text-sm"
                />
                <button
                  type="submit"
                  className="px-6 py-2.5 border border-[#111111] text-[#111111] hover:bg-[#111111] hover:text-white text-xs font-bold uppercase tracking-wider rounded-full cursor-pointer"
                >
                  Submit Rider Rating
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
