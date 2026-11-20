import { AlertTriangle, CheckCircle2, Eye, MessageSquareWarning, Search, X } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { apiFetch } from '../../lib/api.ts';
import type {
  ComplaintStatus,
  DeliveryComplaint,
  DeliveryRecord,
  DeliveryStatus,
} from '../../types/commerce.ts';
import { formatDateTime } from '../../utils/currency.ts';
import { DELIVERY_STATUS_LABELS, getDeliveryStatusLabel } from '../../utils/deliveryStatus.ts';

interface Props {
  complaints: DeliveryComplaint[];
  deliveries: DeliveryRecord[];
  onRefresh: () => Promise<void>;
  pushToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

const COMPLAINT_STATUS_LABELS: Record<ComplaintStatus, string> = {
  open: 'Open',
  under_investigation: 'Under Investigation',
  awaiting_customer: 'Awaiting Customer',
  resolved: 'Resolved',
  closed: 'Closed',
};

const COMPLAINT_STATUS_COLORS: Record<ComplaintStatus, string> = {
  open: 'bg-rose-50 text-rose-700 border border-rose-200',
  under_investigation: 'bg-amber-50 text-amber-800 border border-amber-200',
  awaiting_customer: 'bg-sky-50 text-sky-800 border border-sky-200',
  resolved: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  closed: 'bg-neutral-100 text-neutral-700 border border-[#E8E8E8]',
};

export function AdminComplaintsSection({
  complaints,
  deliveries,
  onRefresh,
  pushToast,
}: Props) {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [active, setActive] = useState<DeliveryComplaint | null>(null);

  const [nextStatus, setNextStatus] = useState<ComplaintStatus>('under_investigation');
  const [resolutionSummary, setResolutionSummary] = useState('');
  const [adminNote, setAdminNote] = useState('');
  const [nextDeliveryStatus, setNextDeliveryStatus] = useState<string>('');
  const [saving, setSaving] = useState(false);

  const deliveryMap = useMemo(() => {
    const map = new Map<string, DeliveryRecord>();
    deliveries.forEach((d) => {
      map.set(d.id, d);
      map.set(d.orderId, d);
    });
    return map;
  }, [deliveries]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return complaints.filter((c) => {
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      if (q) {
        const hay = `${c.complaintNumber} ${c.orderNumber} ${c.customerName} ${c.customerEmail} ${c.subject}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [complaints, statusFilter, search]);

  const openInspect = (c: DeliveryComplaint) => {
    setActive(c);
    setNextStatus(c.status);
    setResolutionSummary(c.resolutionSummary || '');
    setAdminNote('');
    setNextDeliveryStatus('');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!active) return;
    setSaving(true);
    try {
      await apiFetch(`/api/admin/complaints/${active.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          status: nextStatus,
          resolutionSummary: resolutionSummary.trim() || undefined,
          adminNote: adminNote.trim() || undefined,
          nextDeliveryStatus: (nextDeliveryStatus || undefined) as DeliveryStatus | undefined,
        }),
      });
      setActive(null);
      await onRefresh();
      pushToast(`Complaint ${active.complaintNumber} updated & customer notified.`, 'success');
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Failed to update complaint', 'error');
    } finally {
      setSaving(false);
    }
  };

  const openCount = complaints.filter((c) => ['open', 'under_investigation', 'awaiting_customer'].includes(c.status)).length;
  const linkedDelivery = active ? deliveryMap.get(active.deliveryId || active.orderId) : undefined;

  return (
    <div className="space-y-6">
      <div className="bg-white border border-[#E8E8E8] rounded-2xl p-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-lg font-bold text-[#111111]">
            Delivery Disputes &amp; Customer Complaints ({complaints.length})
          </h2>
          <p className="text-xs text-[#333333]/75 mt-0.5">
            {openCount} unresolved case(s). Resolving or updating sends a live status update email to the customer.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Ticket #, order #, customer..."
              className="h-9 pl-9 pr-3 border border-[#E8E8E8] rounded-xl"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 px-3 border border-[#E8E8E8] rounded-xl bg-white"
          >
            <option value="all">All Statuses</option>
            {Object.entries(COMPLAINT_STATUS_LABELS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white border border-[#E8E8E8] rounded-2xl p-10 text-center space-y-2">
          <MessageSquareWarning className="w-8 h-8 text-[#C6A15B] mx-auto" />
          <p className="font-display text-base font-bold text-[#111111]">No Delivery Complaints</p>
          <p className="text-xs text-[#333333]/75 max-w-md mx-auto">
            {complaints.length === 0
              ? 'Customer delivery issues submitted from customer dashboards or confirmation links appear here for investigation.'
              : 'No complaints match your current filter.'}
          </p>
        </div>
      ) : (
        <div className="bg-white border border-[#E8E8E8] rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="border-b border-[#E8E8E8] bg-[#FAF8F3] text-[#333333]/75 uppercase">
                <tr>
                  <th className="py-3 px-4">Ticket / Order</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Category &amp; Subject</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Submitted</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E8E8]">
                {filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-[#FAF8F3]/60">
                    <td className="py-3 px-4">
                      <p className="font-mono-num font-bold text-[#111111]">{c.complaintNumber}</p>
                      <p className="font-mono-num text-[11px] text-[#8C6D34]">{c.orderNumber}</p>
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-semibold text-[#111111]">{c.customerName}</p>
                      <p className="text-[11px] text-[#333333]/75">{c.customerPhone || c.customerEmail}</p>
                    </td>
                    <td className="py-3 px-4 max-w-xs">
                      <p className="font-bold text-[#111111] truncate">{c.subject}</p>
                      <p className="text-[11px] text-[#333333]/75 capitalize">{c.category.replace(/_/g, ' ')}</p>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${COMPLAINT_STATUS_COLORS[c.status]}`}>
                        {COMPLAINT_STATUS_LABELS[c.status]}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono-num text-[11px] text-[#333333]/75">
                      {formatDateTime(c.createdAt)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => openInspect(c)}
                        className="px-3 py-1.5 rounded-lg border border-[#E8E8E8] bg-white hover:border-[#111111] font-semibold inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" /> Investigate
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {active && (
        <div className="fixed inset-0 z-50 bg-[#111111]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleSave} className="bg-white rounded-3xl max-w-2xl w-full p-6 space-y-5 border border-[#E8E8E8] max-h-[90vh] overflow-y-auto text-xs">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono-num text-[11px] font-bold text-[#8C6D34]">
                  {active.complaintNumber} · Order {active.orderNumber}
                </p>
                <h3 className="font-display text-lg font-bold text-[#111111]">{active.subject}</h3>
                <p className="text-[#333333]/75">
                  Customer: {active.customerName} ({active.customerEmail} · {active.customerPhone})
                </p>
              </div>
              <button type="button" onClick={() => setActive(null)} className="p-1.5 rounded-full hover:bg-[#FAF8F3]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-[#FAF8F3] border border-[#E8E8E8] space-y-2">
              <p className="font-bold text-[#111111] uppercase text-[10px]">
                Customer Statement ({active.category.replace(/_/g, ' ')})
              </p>
              <p className="text-[#111111] leading-relaxed whitespace-pre-line">{active.description}</p>
              {active.evidenceUrls.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-2">
                  {active.evidenceUrls.map((url, idx) => (
                    <a key={idx} href={url} target="_blank" rel="noreferrer">
                      <img
                        src={url}
                        alt="Complaint evidence"
                        className="w-20 h-20 rounded-xl object-cover border border-[#E8E8E8]"
                      />
                    </a>
                  ))}
                </div>
              )}
            </div>

            {linkedDelivery && (
              <div className="p-4 rounded-2xl border border-[#E8E8E8] space-y-1.5">
                <p className="font-bold text-[#111111] flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-[#C6A15B]" /> Linked Delivery &amp; Rider Record
                </p>
                <p>
                  Current Status: <strong>{getDeliveryStatusLabel(linkedDelivery.status)}</strong> · Rider:{' '}
                  <strong>{linkedDelivery.riderName || 'Unassigned'}</strong>
                </p>
                {linkedDelivery.evidence?.photoUrl && (
                  <div className="pt-1">
                    <p className="text-[11px] text-[#333333]/75 mb-1">Rider Proof Photo:</p>
                    <img
                      src={linkedDelivery.evidence.photoUrl}
                      alt="Rider proof"
                      className="w-32 h-24 rounded-xl object-cover border border-[#E8E8E8]"
                    />
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold mb-1">Update Complaint Status</label>
                <select
                  value={nextStatus}
                  onChange={(e) => setNextStatus(e.target.value as ComplaintStatus)}
                  className="w-full border border-[#E8E8E8] rounded-xl px-3 py-2 bg-white"
                >
                  {Object.entries(COMPLAINT_STATUS_LABELS).map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold mb-1">Update Linked Delivery Status (Optional)</label>
                <select
                  value={nextDeliveryStatus}
                  onChange={(e) => setNextDeliveryStatus(e.target.value)}
                  className="w-full border border-[#E8E8E8] rounded-xl px-3 py-2 bg-white"
                >
                  <option value="">Keep current delivery status</option>
                  {Object.entries(DELIVERY_STATUS_LABELS).map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block font-semibold mb-1">Customer-Visible Resolution Summary</label>
              <textarea
                rows={2}
                value={resolutionSummary}
                onChange={(e) => setResolutionSummary(e.target.value)}
                placeholder="Explain action taken, replacement dispatched, or refund/exchange arrangement..."
                className="w-full border border-[#E8E8E8] rounded-xl px-3 py-2"
              />
            </div>

            <div>
              <label className="block font-semibold mb-1">Add Admin Investigation Note (Logged &amp; Emailed)</label>
              <input
                type="text"
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                placeholder="e.g. Verified warehouse packing slip, replacement pair scheduled for tomorrow."
                className="w-full border border-[#E8E8E8] rounded-xl px-3 py-2"
              />
            </div>

            {active.adminNotes.length > 0 && (
              <div className="space-y-1.5 max-h-32 overflow-y-auto">
                <p className="font-bold text-[#8C6D34] uppercase text-[10px]">Investigation History</p>
                {active.adminNotes.map((n) => (
                  <div key={n.id} className="p-2.5 rounded-xl bg-[#FAF8F3] border border-[#E8E8E8]">
                    <p>{n.note}</p>
                    <p className="text-[10px] text-[#333333]/70 mt-0.5">
                      {n.author} · {formatDateTime(n.createdAt)}
                    </p>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setActive(null)}
                className="px-4 py-2 rounded-full border border-[#E8E8E8] font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 rounded-full bg-[#111111] text-white font-bold uppercase tracking-wider inline-flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-[#C6A15B]" />
                {saving ? 'Updating...' : 'Save & Notify Customer'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
