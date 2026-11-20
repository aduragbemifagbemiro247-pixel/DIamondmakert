import {
  AlertTriangle,
  BellRing,
  CheckCircle2,
  Clock,
  Eye,
  Mail,
  MapPin,
  PackageCheck,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Truck,
  UserPlus,
  Wallet,
  X,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { apiFetch } from '../../lib/api.ts';
import type {
  DeliveryAnalytics,
  DeliveryRecord,
  DeliverySettings,
  DeliveryStatus,
  DeliveryType,
  EmailLogEntry,
  Order,
  Rider,
} from '../../types/commerce.ts';
import { formatDateTime, formatNaira } from '../../utils/currency.ts';
import {
  DELIVERY_STATUS_LABELS,
  getDeliveryStatusLabel,
  getDeliveryStatusStyle,
} from '../../utils/deliveryStatus.ts';

interface Props {
  mode: 'deliveries' | 'delivery_settings';
  deliveries: DeliveryRecord[];
  riders: Rider[];
  orders: Order[];
  deliverySettings: DeliverySettings;
  deliveryAnalytics: DeliveryAnalytics;
  emailLogs: EmailLogEntry[];
  onRefresh: () => Promise<void>;
  onRefreshPublicStore: () => Promise<void>;
  pushToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

const ALL_DELIVERY_STATUSES: DeliveryStatus[] = [
  'pending_delivery',
  'preparing_order',
  'ready_for_pickup',
  'rider_assigned',
  'picked_up',
  'out_for_delivery',
  'arrived_at_destination',
  'awaiting_customer_confirmation',
  'delivered_customer_confirmed',
  'delivery_failed',
  'delivery_disputed',
  'returned_to_store',
  'cancelled',
];

export function AdminDeliveriesSection({
  mode,
  deliveries,
  riders,
  orders,
  deliverySettings,
  deliveryAnalytics,
  emailLogs,
  onRefresh,
  onRefreshPublicStore,
  pushToast,
}: Props) {
  const [subTab, setSubTab] = useState<'queue' | 'analytics' | 'emails'>('queue');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [riderFilter, setRiderFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Modals
  const [assignModal, setAssignModal] = useState<DeliveryRecord | null>(null);
  const [assignRiderId, setAssignRiderId] = useState('');
  const [assignNote, setAssignNote] = useState('');
  const [assigning, setAssigning] = useState(false);

  const [editModal, setEditModal] = useState<DeliveryRecord | null>(null);
  const [editStatus, setEditStatus] = useState<DeliveryStatus>('pending_delivery');
  const [editFee, setEditFee] = useState<number>(0);
  const [editEta, setEditEta] = useState('');
  const [editCourier, setEditCourier] = useState('');
  const [editTracking, setEditTracking] = useState('');
  const [editType, setEditType] = useState<DeliveryType>('local');
  const [editOtpRequired, setEditOtpRequired] = useState(false);
  const [editNote, setEditNote] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const [inspectModal, setInspectModal] = useState<DeliveryRecord | null>(null);
  const [codModal, setCodModal] = useState<DeliveryRecord | null>(null);
  const [confirmCodPaid, setConfirmCodPaid] = useState(true);
  const [savingCod, setSavingCod] = useState(false);

  const [runningReminders, setRunningReminders] = useState(false);
  const [remindingId, setRemindingId] = useState<string | null>(null);
  const [previewEmail, setPreviewEmail] = useState<EmailLogEntry | null>(null);

  // Delivery Settings State
  const [dsDraft, setDsDraft] = useState<DeliverySettings>(deliverySettings);
  const [savingSettings, setSavingSettings] = useState(false);

  const activeRiders = useMemo(() => riders.filter((r) => r.status === 'active'), [riders]);

  const orderById = useMemo(() => {
    const map = new Map<string, Order>();
    orders.forEach((o) => map.set(o.id, o));
    return map;
  }, [orders]);

  const filteredDeliveries = useMemo(() => {
    const q = search.trim().toLowerCase();
    return deliveries.filter((d) => {
      if (statusFilter !== 'all' && d.status !== statusFilter) return false;
      if (typeFilter !== 'all' && d.deliveryType !== typeFilter) return false;
      if (riderFilter === 'unassigned' && d.riderId) return false;
      if (riderFilter !== 'all' && riderFilter !== 'unassigned' && d.riderId !== riderFilter) return false;
      if (dateFrom && d.createdAt.slice(0, 10) < dateFrom) return false;
      if (dateTo && d.createdAt.slice(0, 10) > dateTo) return false;
      if (q) {
        const hay = `${d.orderNumber} ${d.recipientName} ${d.customerPhone} ${d.addressCity} ${d.addressState} ${d.addressStreet} ${d.riderName || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [deliveries, statusFilter, typeFilter, riderFilter, dateFrom, dateTo, search]);

  const openAssign = (d: DeliveryRecord) => {
    setAssignModal(d);
    setAssignRiderId(d.riderId || activeRiders[0]?.id || '');
    setAssignNote('');
  };

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignModal || !assignRiderId) {
      pushToast('Please select an active rider.', 'error');
      return;
    }
    setAssigning(true);
    try {
      await apiFetch(`/api/admin/deliveries/${assignModal.id}/assign`, {
        method: 'POST',
        body: JSON.stringify({ riderId: assignRiderId, note: assignNote.trim() || undefined }),
      });
      setAssignModal(null);
      await onRefresh();
      pushToast(`Rider assigned to ${assignModal.orderNumber}.`, 'success');
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Failed to assign rider', 'error');
    } finally {
      setAssigning(false);
    }
  };

  const openEdit = (d: DeliveryRecord) => {
    setEditModal(d);
    setEditStatus(d.status);
    setEditFee(d.deliveryFee);
    setEditEta(d.estimatedDeliveryDate || '');
    setEditCourier(d.courier || '');
    setEditTracking(d.trackingNumber || '');
    setEditType(d.deliveryType);
    setEditOtpRequired(Boolean(d.otpRequired));
    setEditNote('');
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editModal) return;
    setSavingEdit(true);
    try {
      await apiFetch(`/api/admin/deliveries/${editModal.id}/status`, {
        method: 'PUT',
        body: JSON.stringify({
          status: editStatus,
          deliveryFee: Number(editFee) || 0,
          estimatedDeliveryDate: editEta.trim(),
          courier: editCourier.trim(),
          trackingNumber: editTracking.trim(),
          deliveryType: editType,
          otpRequired: editOtpRequired,
          note: editNote.trim() || undefined,
        }),
      });
      setEditModal(null);
      await onRefresh();
      pushToast(`Delivery ${editModal.orderNumber} updated.`, 'success');
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Failed to update delivery', 'error');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleCodSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!codModal) return;
    setSavingCod(true);
    try {
      await apiFetch(`/api/admin/deliveries/${codModal.id}/cod-collected`, {
        method: 'POST',
        body: JSON.stringify({ collected: true, confirmPaymentPaid: confirmCodPaid }),
      });
      setCodModal(null);
      await onRefresh();
      pushToast(`COD settlement recorded for ${codModal.orderNumber}.`, 'success');
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Failed to record COD collection', 'error');
    } finally {
      setSavingCod(false);
    }
  };

  const handleSendReminder = async (d: DeliveryRecord) => {
    setRemindingId(d.id);
    try {
      await apiFetch(`/api/admin/deliveries/${d.id}/remind`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      await onRefresh();
      pushToast(`Confirmation reminder queued for ${d.orderNumber}.`, 'success');
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Unable to send reminder', 'error');
    } finally {
      setRemindingId(null);
    }
  };

  const handleRunReminders = async () => {
    setRunningReminders(true);
    try {
      const res = await apiFetch<{ remindersSent: number }>('/api/admin/deliveries/run-reminders', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      await onRefresh();
      pushToast(`Reminder check complete: ${res.remindersSent} overdue reminder(s) sent.`, 'info');
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Reminder sweep failed', 'error');
    } finally {
      setRunningReminders(false);
    }
  };

  const handleSaveDeliverySettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await apiFetch('/api/admin/delivery-settings', {
        method: 'PUT',
        body: JSON.stringify(dsDraft),
      });
      await Promise.all([onRefresh(), onRefreshPublicStore()]);
      pushToast('Delivery, OTP & notification settings saved.', 'success');
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Failed to save delivery settings', 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  if (mode === 'delivery_settings') {
    return (
      <form onSubmit={handleSaveDeliverySettings} className="space-y-6 text-xs">
        <div className="bg-white border border-[#E8E8E8] rounded-2xl p-6 space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-lg font-bold text-[#111111]">
                Delivery Zones, Fees &amp; Dispatch Rules
              </h2>
              <p className="text-[#333333]/75 mt-0.5">
                Configure Ogbomoso local delivery, interstate dispatch, nationwide shipping, store pickup, and rider assignment.
              </p>
            </div>
            <Settings2 className="w-5 h-5 text-[#C6A15B] shrink-0" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block font-semibold mb-1">Ogbomoso Local Fee (₦)</label>
              <input
                type="number"
                min={0}
                value={dsDraft.ogbomosoLocalFee}
                onChange={(e) => setDsDraft({ ...dsDraft, ogbomosoLocalFee: Number(e.target.value) })}
                className="w-full border border-[#E8E8E8] rounded-xl px-3 py-2 font-mono-num"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Interstate Fee (₦)</label>
              <input
                type="number"
                min={0}
                value={dsDraft.interstateDefaultFee}
                onChange={(e) => setDsDraft({ ...dsDraft, interstateDefaultFee: Number(e.target.value) })}
                className="w-full border border-[#E8E8E8] rounded-xl px-3 py-2 font-mono-num"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Nationwide Fee (₦)</label>
              <input
                type="number"
                min={0}
                value={dsDraft.nationwideDefaultFee}
                onChange={(e) => setDsDraft({ ...dsDraft, nationwideDefaultFee: Number(e.target.value) })}
                className="w-full border border-[#E8E8E8] rounded-xl px-3 py-2 font-mono-num"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Free Delivery Threshold (₦)</label>
              <input
                type="number"
                min={0}
                value={dsDraft.freeDeliveryThreshold}
                onChange={(e) => setDsDraft({ ...dsDraft, freeDeliveryThreshold: Number(e.target.value) })}
                className="w-full border border-[#E8E8E8] rounded-xl px-3 py-2 font-mono-num"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block font-semibold mb-1">Local Transit Window</label>
              <input
                type="text"
                value={dsDraft.estimatedTimes.local}
                onChange={(e) =>
                  setDsDraft({
                    ...dsDraft,
                    estimatedTimes: { ...dsDraft.estimatedTimes, local: e.target.value },
                  })
                }
                className="w-full border border-[#E8E8E8] rounded-xl px-3 py-2"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Interstate Window</label>
              <input
                type="text"
                value={dsDraft.estimatedTimes.interstate}
                onChange={(e) =>
                  setDsDraft({
                    ...dsDraft,
                    estimatedTimes: { ...dsDraft.estimatedTimes, interstate: e.target.value },
                  })
                }
                className="w-full border border-[#E8E8E8] rounded-xl px-3 py-2"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Nationwide Window</label>
              <input
                type="text"
                value={dsDraft.estimatedTimes.nationwide}
                onChange={(e) =>
                  setDsDraft({
                    ...dsDraft,
                    estimatedTimes: { ...dsDraft.estimatedTimes, nationwide: e.target.value },
                  })
                }
                className="w-full border border-[#E8E8E8] rounded-xl px-3 py-2"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Rider Auto-Assign Mode</label>
              <select
                value={dsDraft.autoAssignMode}
                onChange={(e) =>
                  setDsDraft({ ...dsDraft, autoAssignMode: e.target.value as 'manual' | 'round_robin' })
                }
                className="w-full border border-[#E8E8E8] rounded-xl px-3 py-2 bg-white"
              >
                <option value="manual">Manual Assignment by Admin</option>
                <option value="round_robin">Auto Round-Robin (Active Riders)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-[#E8E8E8]">
            <div>
              <label className="block font-semibold mb-1">Store Pickup Address (Ogbomoso)</label>
              <input
                type="text"
                value={dsDraft.pickupAddress}
                onChange={(e) => setDsDraft({ ...dsDraft, pickupAddress: e.target.value })}
                className="w-full border border-[#E8E8E8] rounded-xl px-3 py-2"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Store Pickup Instructions</label>
              <input
                type="text"
                value={dsDraft.pickupInstructions}
                onChange={(e) => setDsDraft({ ...dsDraft, pickupInstructions: e.target.value })}
                className="w-full border border-[#E8E8E8] rounded-xl px-3 py-2"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-5 pt-2">
            <label className="inline-flex items-center gap-2 font-semibold cursor-pointer">
              <input
                type="checkbox"
                checked={dsDraft.localDeliveryEnabled}
                onChange={(e) => setDsDraft({ ...dsDraft, localDeliveryEnabled: e.target.checked })}
                className="w-4 h-4 accent-[#111111]"
              />
              <span>Local Delivery Enabled</span>
            </label>
            <label className="inline-flex items-center gap-2 font-semibold cursor-pointer">
              <input
                type="checkbox"
                checked={dsDraft.interstateDeliveryEnabled}
                onChange={(e) => setDsDraft({ ...dsDraft, interstateDeliveryEnabled: e.target.checked })}
                className="w-4 h-4 accent-[#111111]"
              />
              <span>Interstate Delivery Enabled</span>
            </label>
            <label className="inline-flex items-center gap-2 font-semibold cursor-pointer">
              <input
                type="checkbox"
                checked={dsDraft.nationwideDeliveryEnabled}
                onChange={(e) => setDsDraft({ ...dsDraft, nationwideDeliveryEnabled: e.target.checked })}
                className="w-4 h-4 accent-[#111111]"
              />
              <span>Nationwide Delivery Enabled</span>
            </label>
            <label className="inline-flex items-center gap-2 font-semibold cursor-pointer">
              <input
                type="checkbox"
                checked={dsDraft.pickupEnabled}
                onChange={(e) => setDsDraft({ ...dsDraft, pickupEnabled: e.target.checked })}
                className="w-4 h-4 accent-[#111111]"
              />
              <span>In-Store Pickup Enabled</span>
            </label>
          </div>
        </div>

        {/* OTP, Confirmation & Email Automation */}
        <div className="bg-white border border-[#E8E8E8] rounded-2xl p-6 space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-lg font-bold text-[#111111]">
                OTP Handshake, Proof of Delivery &amp; Automated Emails
              </h2>
              <p className="text-[#333333]/75 mt-0.5">
                Control 6-digit delivery verification codes, evidence requirements, reminder intervals, and customer receipt emails.
              </p>
            </div>
            <ShieldCheck className="w-5 h-5 text-[#C6A15B] shrink-0" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block font-semibold mb-1">OTP Requirement Scope</label>
              <select
                value={dsDraft.otpScope}
                onChange={(e) =>
                  setDsDraft({ ...dsDraft, otpScope: e.target.value as 'all' | 'cod_only' | 'above_threshold' })
                }
                className="w-full border border-[#E8E8E8] rounded-xl px-3 py-2 bg-white"
              >
                <option value="all">All Orders</option>
                <option value="cod_only">Pay on Delivery (COD) Only</option>
                <option value="above_threshold">Orders Above Threshold (₦)</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold mb-1">OTP Threshold (₦)</label>
              <input
                type="number"
                min={0}
                value={dsDraft.otpThresholdAmount}
                onChange={(e) => setDsDraft({ ...dsDraft, otpThresholdAmount: Number(e.target.value) })}
                className="w-full border border-[#E8E8E8] rounded-xl px-3 py-2 font-mono-num"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">OTP Expiry (Minutes)</label>
              <input
                type="number"
                min={10}
                value={dsDraft.otpExpiryMinutes}
                onChange={(e) => setDsDraft({ ...dsDraft, otpExpiryMinutes: Number(e.target.value) })}
                className="w-full border border-[#E8E8E8] rounded-xl px-3 py-2 font-mono-num"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Max OTP Attempts</label>
              <input
                type="number"
                min={3}
                max={10}
                value={dsDraft.otpMaxAttempts}
                onChange={(e) => setDsDraft({ ...dsDraft, otpMaxAttempts: Number(e.target.value) })}
                className="w-full border border-[#E8E8E8] rounded-xl px-3 py-2 font-mono-num"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold mb-1">1st Confirmation Reminder (Hours after delivery)</label>
              <input
                type="number"
                min={1}
                value={dsDraft.reminderFirstAfterHours}
                onChange={(e) => setDsDraft({ ...dsDraft, reminderFirstAfterHours: Number(e.target.value) })}
                className="w-full border border-[#E8E8E8] rounded-xl px-3 py-2 font-mono-num"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">2nd Confirmation Reminder (Hours after 1st)</label>
              <input
                type="number"
                min={1}
                value={dsDraft.reminderSecondAfterHours}
                onChange={(e) => setDsDraft({ ...dsDraft, reminderSecondAfterHours: Number(e.target.value) })}
                className="w-full border border-[#E8E8E8] rounded-xl px-3 py-2 font-mono-num"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-5 pt-2">
            <label className="inline-flex items-center gap-2 font-semibold cursor-pointer">
              <input
                type="checkbox"
                checked={dsDraft.otpEnabled}
                onChange={(e) => setDsDraft({ ...dsDraft, otpEnabled: e.target.checked })}
                className="w-4 h-4 accent-[#111111]"
              />
              <span>Enable 6-Digit Delivery OTP</span>
            </label>
            <label className="inline-flex items-center gap-2 font-semibold cursor-pointer">
              <input
                type="checkbox"
                checked={dsDraft.requireCustomerConfirmation}
                onChange={(e) => setDsDraft({ ...dsDraft, requireCustomerConfirmation: e.target.checked })}
                className="w-4 h-4 accent-[#111111]"
              />
              <span>Require Customer Confirmation</span>
            </label>
            <label className="inline-flex items-center gap-2 font-semibold cursor-pointer">
              <input
                type="checkbox"
                checked={dsDraft.collectDeliveryPhoto}
                onChange={(e) => setDsDraft({ ...dsDraft, collectDeliveryPhoto: e.target.checked })}
                className="w-4 h-4 accent-[#111111]"
              />
              <span>Collect Rider Proof Photo</span>
            </label>
            <label className="inline-flex items-center gap-2 font-semibold cursor-pointer">
              <input
                type="checkbox"
                checked={dsDraft.collectDeliveryLocation}
                onChange={(e) => setDsDraft({ ...dsDraft, collectDeliveryLocation: e.target.checked })}
                className="w-4 h-4 accent-[#111111]"
              />
              <span>Allow Optional GPS Proof</span>
            </label>
            <label className="inline-flex items-center gap-2 font-semibold cursor-pointer">
              <input
                type="checkbox"
                checked={dsDraft.enableAutomatedEmails}
                onChange={(e) => setDsDraft({ ...dsDraft, enableAutomatedEmails: e.target.checked })}
                className="w-4 h-4 accent-[#111111]"
              />
              <span>Enable Automated Lifecycle Emails</span>
            </label>
            <label className="inline-flex items-center gap-2 font-semibold cursor-pointer">
              <input
                type="checkbox"
                checked={dsDraft.enableDisputeWorkflow}
                onChange={(e) => setDsDraft({ ...dsDraft, enableDisputeWorkflow: e.target.checked })}
                className="w-4 h-4 accent-[#111111]"
              />
              <span>Enable Delivery Issue Disputes</span>
            </label>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={savingSettings}
              className="px-6 py-2.5 bg-[#111111] text-white text-xs font-bold uppercase tracking-wider rounded-full hover:bg-[#C6A15B] hover:text-[#111111] cursor-pointer"
            >
              {savingSettings ? 'Saving Settings...' : 'Save Delivery & OTP Settings'}
            </button>
          </div>
        </div>
      </form>
    );
  }

  return (
    <div className="space-y-6">
      {/* Real Delivery KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Total Deliveries', value: String(deliveryAnalytics.totalDeliveries), sub: `${deliveryAnalytics.pendingDeliveries} pending` },
          { label: 'Active Transit', value: String(deliveryAnalytics.assignedDeliveries + deliveryAnalytics.outForDeliveryCount), sub: `${deliveryAnalytics.outForDeliveryCount} out now` },
          { label: 'Completed', value: String(deliveryAnalytics.completedDeliveries), sub: `${deliveryAnalytics.customerConfirmedCount} customer confirmed` },
          {
            label: 'Success Rate',
            value: deliveryAnalytics.deliverySuccessRate !== null ? `${deliveryAnalytics.deliverySuccessRate}%` : '—',
            sub: `${deliveryAnalytics.failedDeliveries} failed`,
          },
          {
            label: 'Avg Delivery Time',
            value: deliveryAnalytics.averageDeliveryHours !== null ? `${deliveryAnalytics.averageDeliveryHours} hrs` : '—',
            sub: `${deliveryAnalytics.disputedDeliveries} disputed`,
          },
          {
            label: 'Delivery Fees',
            value: formatNaira(deliveryAnalytics.totalDeliveryFeesCollected),
            sub: `${deliveryAnalytics.openComplaints} open issues`,
          },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-white border border-[#E8E8E8] rounded-2xl p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#8C6D34]">{kpi.label}</p>
            <p className="font-mono-num text-xl font-bold text-[#111111] mt-1">{kpi.value}</p>
            <p className="text-[11px] text-[#333333]/75 mt-0.5">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Sub-navigation + Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSubTab('queue')}
            className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap cursor-pointer ${
              subTab === 'queue' ? 'bg-[#111111] text-white' : 'bg-white border border-[#E8E8E8] text-[#111111]'
            }`}
          >
            Deliveries Queue ({deliveries.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab('analytics')}
            className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap cursor-pointer ${
              subTab === 'analytics' ? 'bg-[#111111] text-white' : 'bg-white border border-[#E8E8E8] text-[#111111]'
            }`}
          >
            Rider Performance Reports
          </button>
          <button
            type="button"
            onClick={() => setSubTab('emails')}
            className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap cursor-pointer ${
              subTab === 'emails' ? 'bg-[#111111] text-white' : 'bg-white border border-[#E8E8E8] text-[#111111]'
            }`}
          >
            Automated Email Outbox ({emailLogs.length})
          </button>
        </div>

        <button
          type="button"
          disabled={runningReminders}
          onClick={handleRunReminders}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#FAF8F3] border border-[#C6A15B]/60 text-xs font-bold text-[#111111] hover:bg-[#C6A15B] cursor-pointer whitespace-nowrap"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${runningReminders ? 'animate-spin' : ''}`} />
          {runningReminders ? 'Checking Overdue...' : 'Run Overdue Reminders'}
        </button>
      </div>

      {subTab === 'queue' && (
        <div className="bg-white border border-[#E8E8E8] rounded-2xl p-5 space-y-4">
          {/* Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 text-xs">
            <div className="relative lg:col-span-2">
              <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Order #, customer, city, phone, rider..."
                className="w-full h-9 pl-9 pr-3 border border-[#E8E8E8] rounded-xl"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 px-3 border border-[#E8E8E8] rounded-xl bg-white"
            >
              <option value="all">All Statuses</option>
              {ALL_DELIVERY_STATUSES.map((st) => (
                <option key={st} value={st}>
                  {DELIVERY_STATUS_LABELS[st]}
                </option>
              ))}
            </select>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="h-9 px-3 border border-[#E8E8E8] rounded-xl bg-white"
            >
              <option value="all">All Delivery Types</option>
              <option value="local">Local (Ogbomoso)</option>
              <option value="interstate">Interstate</option>
              <option value="nationwide">Nationwide</option>
              <option value="pickup">Store Pickup</option>
            </select>
            <select
              value={riderFilter}
              onChange={(e) => setRiderFilter(e.target.value)}
              className="h-9 px-3 border border-[#E8E8E8] rounded-xl bg-white"
            >
              <option value="all">All Riders</option>
              <option value="unassigned">Unassigned Only</option>
              {riders.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.fullName} ({r.riderCode})
                </option>
              ))}
            </select>
            <div className="flex gap-1.5">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                aria-label="From date"
                className="w-1/2 h-9 px-2 border border-[#E8E8E8] rounded-xl text-[11px]"
              />
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                aria-label="To date"
                className="w-1/2 h-9 px-2 border border-[#E8E8E8] rounded-xl text-[11px]"
              />
            </div>
          </div>

          {filteredDeliveries.length === 0 ? (
            <div className="bg-[#FAF8F3] border border-[#E8E8E8] rounded-2xl p-10 text-center space-y-2">
              <Truck className="w-7 h-7 text-[#C6A15B] mx-auto" />
              <p className="font-display text-base font-bold text-[#111111]">
                No Delivery Records Found
              </p>
              <p className="text-xs text-[#333333]/75 max-w-md mx-auto">
                {deliveries.length === 0
                  ? 'Deliveries are automatically created whenever customers place orders at checkout.'
                  : 'No deliveries match the active search or filter criteria.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="border-b border-[#E8E8E8] text-[#333333]/75 uppercase">
                  <tr>
                    <th className="py-2.5 pr-4">Order</th>
                    <th className="py-2.5 pr-4">Destination</th>
                    <th className="py-2.5 pr-4">Assigned Rider</th>
                    <th className="py-2.5 pr-4">Status &amp; OTP</th>
                    <th className="py-2.5 pr-4">Payment / COD</th>
                    <th className="py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8E8E8]">
                  {filteredDeliveries.map((d) => {
                    const order = orderById.get(d.orderId);
                    const badge = getDeliveryStatusStyle(d.status);
                    return (
                      <tr key={d.id} className="hover:bg-[#FAF8F3]/60">
                        <td className="py-3 pr-4 align-top">
                          <p className="font-mono-num font-bold text-[#111111]">{d.orderNumber}</p>
                          <p className="text-[#333333]/75 capitalize">{d.deliveryType} · {formatNaira(d.deliveryFee)}</p>
                          {d.estimatedDeliveryDate && (
                            <p className="text-[11px] text-[#8C6D34] mt-0.5">ETA: {d.estimatedDeliveryDate}</p>
                          )}
                        </td>
                        <td className="py-3 pr-4 align-top max-w-[230px]">
                          <p className="font-semibold text-[#111111]">{d.recipientName}</p>
                          <p className="text-[#333333]/80 truncate">{d.addressStreet}</p>
                          <p className="text-[#333333]/75">
                            {d.addressCity}, {d.addressState} · <span className="font-mono-num">{d.customerPhone}</span>
                          </p>
                        </td>
                        <td className="py-3 pr-4 align-top">
                          {d.riderName ? (
                            <div>
                              <p className="font-semibold text-[#111111]">{d.riderName}</p>
                              <p className="font-mono-num text-[11px] text-[#8C6D34]">{d.riderCode}</p>
                              <p className="text-[11px] text-[#333333]/75">{d.riderPhone}</p>
                            </div>
                          ) : (
                            <span className="text-amber-700 font-semibold">Unassigned</span>
                          )}
                        </td>
                        <td className="py-3 pr-4 align-top space-y-1">
                          <span className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-semibold ${badge}`}>
                            {getDeliveryStatusLabel(d.status)}
                          </span>
                          <div className="flex flex-wrap gap-1.5 text-[10px]">
                            {d.otpRequired && (
                              <span
                                className={`px-2 py-0.5 rounded font-semibold ${
                                  d.otpVerified
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : 'bg-amber-50 text-amber-800'
                                }`}
                              >
                                {d.otpVerified ? 'OTP Verified' : 'OTP Pending'}
                              </span>
                            )}
                            {d.confirmation.confirmed && (
                              <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold">
                                Client Confirmed
                              </span>
                            )}
                            {d.evidence?.photoUrl && (
                              <span className="px-2 py-0.5 rounded bg-neutral-100 text-[#111111] font-semibold">
                                Photo Proof
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 pr-4 align-top">
                          {order ? (
                            <div>
                              <p className="font-semibold uppercase text-[11px]">{order.paymentMethod}</p>
                              <p className={`text-[11px] font-bold ${order.paymentStatus === 'paid' ? 'text-emerald-700' : 'text-amber-700'}`}>
                                {order.paymentStatus === 'paid' ? 'Paid' : 'Unpaid'}
                              </p>
                              {d.codAmountToCollect > 0 && (
                                <p className="font-mono-num text-[11px] text-[#333333]/80">
                                  COD {formatNaira(d.codAmountToCollect)} · {d.codCollected ? 'Collected' : 'Pending'}
                                </p>
                              )}
                            </div>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="py-3 text-right align-top">
                          <div className="flex flex-wrap justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => openAssign(d)}
                              className="px-2.5 py-1.5 rounded-lg border border-[#E8E8E8] bg-white hover:border-[#111111] font-semibold inline-flex items-center gap-1 cursor-pointer"
                            >
                              <UserPlus className="w-3 h-3" /> {d.riderId ? 'Reassign' : 'Assign'}
                            </button>
                            <button
                              type="button"
                              onClick={() => openEdit(d)}
                              className="px-2.5 py-1.5 rounded-lg border border-[#E8E8E8] bg-white hover:border-[#111111] font-semibold cursor-pointer"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => setInspectModal(d)}
                              className="px-2.5 py-1.5 rounded-lg border border-[#E8E8E8] bg-white hover:border-[#111111] font-semibold inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Eye className="w-3 h-3" /> Proof
                            </button>
                            {d.codAmountToCollect > 0 && order?.paymentStatus !== 'paid' && (
                              <button
                                type="button"
                                onClick={() => {
                                  setCodModal(d);
                                  setConfirmCodPaid(true);
                                }}
                                className="px-2.5 py-1.5 rounded-lg bg-[#C6A15B] text-[#111111] font-bold inline-flex items-center gap-1 cursor-pointer"
                              >
                                <Wallet className="w-3 h-3" /> COD
                              </button>
                            )}
                            {d.status === 'awaiting_customer_confirmation' && !d.confirmation.confirmed && (
                              <button
                                type="button"
                                disabled={remindingId === d.id}
                                onClick={() => handleSendReminder(d)}
                                className="px-2.5 py-1.5 rounded-lg bg-[#111111] text-white font-semibold inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                              >
                                <BellRing className="w-3 h-3" /> Remind
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {subTab === 'analytics' && (
        <div className="bg-white border border-[#E8E8E8] rounded-2xl p-6 space-y-4">
          <div>
            <h3 className="font-display text-lg font-bold text-[#111111]">
              Rider Performance &amp; Dispatch Metrics
            </h3>
            <p className="text-xs text-[#333333]/75">
              Calculated strictly from verified delivery records and customer rider reviews.
            </p>
          </div>
          {deliveryAnalytics.riderPerformance.length === 0 ? (
            <p className="text-sm text-[#333333]/75 bg-[#FAF8F3] border border-[#E8E8E8] rounded-xl p-8 text-center">
              No riders registered yet. Add dispatch riders under the Riders menu to track performance.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="border-b border-[#E8E8E8] text-[#333333]/75 uppercase">
                  <tr>
                    <th className="py-2.5 pr-4">Rider</th>
                    <th className="py-2.5 pr-4">Status</th>
                    <th className="py-2.5 pr-4">Assigned</th>
                    <th className="py-2.5 pr-4">Pending</th>
                    <th className="py-2.5 pr-4">Completed</th>
                    <th className="py-2.5 pr-4">Confirmed</th>
                    <th className="py-2.5 pr-4">Failed</th>
                    <th className="py-2.5">Rating</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8E8E8]">
                  {deliveryAnalytics.riderPerformance.map((rp) => (
                    <tr key={rp.riderId}>
                      <td className="py-3 pr-4">
                        <p className="font-bold text-[#111111]">{rp.fullName}</p>
                        <p className="font-mono-num text-[11px] text-[#8C6D34]">{rp.riderCode}</p>
                      </td>
                      <td className="py-3 pr-4 capitalize font-semibold">{rp.status}</td>
                      <td className="py-3 pr-4 font-mono-num font-semibold">{rp.totalAssigned}</td>
                      <td className="py-3 pr-4 font-mono-num">{rp.pending}</td>
                      <td className="py-3 pr-4 font-mono-num text-emerald-700 font-semibold">{rp.completed}</td>
                      <td className="py-3 pr-4 font-mono-num text-emerald-800 font-bold">{rp.confirmed}</td>
                      <td className="py-3 pr-4 font-mono-num text-rose-700">{rp.failed}</td>
                      <td className="py-3 font-mono-num font-semibold">
                        {rp.averageRating !== null ? `${rp.averageRating.toFixed(1)} ★ (${rp.reviewCount})` : 'No ratings yet'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {subTab === 'emails' && (
        <div className="bg-white border border-[#E8E8E8] rounded-2xl p-6 space-y-4">
          <div>
            <h3 className="font-display text-lg font-bold text-[#111111]">
              Transactional &amp; Delivery Email Outbox
            </h3>
            <p className="text-xs text-[#333333]/75">
              Every automated order, rider assignment, OTP, confirmation request, reminder, and complaint email dispatched by Diamond Market.
            </p>
          </div>
          {emailLogs.length === 0 ? (
            <div className="bg-[#FAF8F3] border border-[#E8E8E8] rounded-xl p-8 text-center text-xs text-[#333333]/75">
              No automated emails have been dispatched yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="border-b border-[#E8E8E8] text-[#333333]/75 uppercase">
                  <tr>
                    <th className="py-2.5 pr-4">Sent At</th>
                    <th className="py-2.5 pr-4">Recipient</th>
                    <th className="py-2.5 pr-4">Event / Order</th>
                    <th className="py-2.5 pr-4">Subject</th>
                    <th className="py-2.5 pr-4">Transport</th>
                    <th className="py-2.5 text-right">Preview</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8E8E8]">
                  {emailLogs.map((log) => (
                    <tr key={log.id}>
                      <td className="py-3 pr-4 font-mono-num text-[11px] text-[#333333]/75">
                        {formatDateTime(log.createdAt)}
                      </td>
                      <td className="py-3 pr-4 font-medium text-[#111111]">{log.to}</td>
                      <td className="py-3 pr-4">
                        <span className="font-mono-num font-bold text-[#8C6D34]">{log.orderNumber || '—'}</span>
                        <p className="text-[11px] text-[#333333]/75">{log.eventKey}</p>
                      </td>
                      <td className="py-3 pr-4 max-w-xs truncate font-medium">{log.subject}</td>
                      <td className="py-3 pr-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            log.delivered ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                          }`}
                        >
                          {log.transport}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setPreviewEmail(log)}
                          className="px-3 py-1.5 rounded-lg border border-[#E8E8E8] hover:border-[#111111] font-semibold inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Mail className="w-3 h-3" /> HTML
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Assign Rider Modal */}
      {assignModal && (
        <div className="fixed inset-0 z-50 bg-[#111111]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleAssignSubmit} className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 border border-[#E8E8E8]">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-[#111111]">
                Assign Rider · {assignModal.orderNumber}
              </h3>
              <button type="button" onClick={() => setAssignModal(null)} className="p-1.5 rounded-full hover:bg-[#FAF8F3]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-[#333333]/80">
              Destination: {assignModal.addressStreet}, {assignModal.addressCity}, {assignModal.addressState}
            </p>
            {activeRiders.length === 0 ? (
              <p className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
                No active riders found. Please register or activate a rider in the Riders module first.
              </p>
            ) : (
              <>
                <div className="text-xs">
                  <label className="block font-semibold mb-1">Select Active Dispatch Rider</label>
                  <select
                    required
                    value={assignRiderId}
                    onChange={(e) => setAssignRiderId(e.target.value)}
                    className="w-full border border-[#E8E8E8] rounded-xl px-3 py-2.5 bg-white"
                  >
                    <option value="">Choose a rider...</option>
                    {activeRiders.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.fullName} ({r.riderCode}) · {r.vehicleType} · {r.zoneCoverage.join(', ')}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="text-xs">
                  <label className="block font-semibold mb-1">Dispatch Note (Optional)</label>
                  <input
                    type="text"
                    value={assignNote}
                    onChange={(e) => setAssignNote(e.target.value)}
                    placeholder="e.g. Call customer 15 minutes before arrival"
                    className="w-full border border-[#E8E8E8] rounded-xl px-3 py-2"
                  />
                </div>
              </>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setAssignModal(null)}
                className="px-4 py-2 rounded-full border border-[#E8E8E8] text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={assigning || activeRiders.length === 0}
                className="px-5 py-2 rounded-full bg-[#111111] text-white text-xs font-bold uppercase tracking-wider disabled:opacity-50"
              >
                {assigning ? 'Assigning...' : 'Confirm Assignment'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Delivery Modal */}
      {editModal && (
        <div className="fixed inset-0 z-50 bg-[#111111]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleEditSubmit} className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 border border-[#E8E8E8] max-h-[90vh] overflow-y-auto text-xs">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-[#111111]">
                Update Delivery · {editModal.orderNumber}
              </h3>
              <button type="button" onClick={() => setEditModal(null)} className="p-1.5 rounded-full hover:bg-[#FAF8F3]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold mb-1">Delivery Status</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as DeliveryStatus)}
                  className="w-full border border-[#E8E8E8] rounded-xl px-3 py-2 bg-white"
                >
                  {ALL_DELIVERY_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {DELIVERY_STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold mb-1">Delivery Type</label>
                <select
                  value={editType}
                  onChange={(e) => setEditType(e.target.value as DeliveryType)}
                  className="w-full border border-[#E8E8E8] rounded-xl px-3 py-2 bg-white"
                >
                  <option value="local">Local (Ogbomoso)</option>
                  <option value="interstate">Interstate</option>
                  <option value="nationwide">Nationwide</option>
                  <option value="pickup">Store Pickup</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold mb-1">Delivery Fee (₦)</label>
                <input
                  type="number"
                  min={0}
                  value={editFee}
                  onChange={(e) => setEditFee(Number(e.target.value))}
                  className="w-full border border-[#E8E8E8] rounded-xl px-3 py-2 font-mono-num"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Estimated Delivery Date</label>
                <input
                  type="date"
                  value={editEta}
                  onChange={(e) => setEditEta(e.target.value)}
                  className="w-full border border-[#E8E8E8] rounded-xl px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Courier / Logistics Partner</label>
                <input
                  type="text"
                  value={editCourier}
                  onChange={(e) => setEditCourier(e.target.value)}
                  className="w-full border border-[#E8E8E8] rounded-xl px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Waybill / Tracking #</label>
                <input
                  type="text"
                  value={editTracking}
                  onChange={(e) => setEditTracking(e.target.value)}
                  className="w-full border border-[#E8E8E8] rounded-xl px-3 py-2 font-mono-num"
                />
              </div>
            </div>
            <label className="inline-flex items-center gap-2 font-semibold cursor-pointer">
              <input
                type="checkbox"
                checked={editOtpRequired}
                onChange={(e) => setEditOtpRequired(e.target.checked)}
                className="w-4 h-4 accent-[#111111]"
              />
              <span>Require 6-Digit Customer OTP Verification</span>
            </label>
            <div>
              <label className="block font-semibold mb-1">Update Note (History &amp; Customer Email)</label>
              <textarea
                rows={2}
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                placeholder="Reason for status update or note for customer..."
                className="w-full border border-[#E8E8E8] rounded-xl px-3 py-2"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditModal(null)}
                className="px-4 py-2 rounded-full border border-[#E8E8E8] font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingEdit}
                className="px-5 py-2 rounded-full bg-[#111111] text-white font-bold uppercase tracking-wider"
              >
                {savingEdit ? 'Saving...' : 'Save Delivery Update'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Inspect Proof & History Modal */}
      {inspectModal && (
        <div className="fixed inset-0 z-50 bg-[#111111]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 space-y-5 border border-[#E8E8E8] max-h-[90vh] overflow-y-auto text-xs">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display text-lg font-bold text-[#111111]">
                  Delivery Audit &amp; Proof · {inspectModal.orderNumber}
                </h3>
                <p className="text-[#333333]/75">{inspectModal.recipientName} · {inspectModal.addressCity}, {inspectModal.addressState}</p>
              </div>
              <button type="button" onClick={() => setInspectModal(null)} className="p-1.5 rounded-full hover:bg-[#FAF8F3]">
                <X className="w-4 h-4" />
              </button>
            </div>

            {inspectModal.deliveryInstructions && (
              <div className="p-3.5 rounded-xl bg-[#FAF8F3] border border-[#E8E8E8]">
                <p className="font-bold text-[#8C6D34] uppercase text-[10px]">Delivery Instructions</p>
                <p className="mt-0.5 text-[#111111]">{inspectModal.deliveryInstructions}</p>
              </div>
            )}

            {inspectModal.failureReason && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Failure Reason Reported</p>
                  <p>{inspectModal.failureReason}</p>
                </div>
              </div>
            )}

            <div className="p-4 rounded-2xl bg-[#FAF8F3] border border-[#E8E8E8] space-y-2">
              <p className="font-bold text-[#111111] flex items-center gap-1.5">
                <PackageCheck className="w-4 h-4 text-[#C6A15B]" /> Proof of Delivery &amp; Confirmation
              </p>
              {inspectModal.evidence?.submittedAt ? (
                <div className="space-y-2">
                  <p>
                    Recipient: <strong>{inspectModal.evidence.recipientName || inspectModal.recipientName}</strong> ·
                    By {inspectModal.evidence.submittedByRiderName || 'Rider'} on{' '}
                    {formatDateTime(inspectModal.evidence.submittedAt)}
                  </p>
                  {inspectModal.evidence.notes && <p className="text-[#333333]">Notes: {inspectModal.evidence.notes}</p>}
                  {inspectModal.evidence.locationLat && inspectModal.evidence.locationLng && (
                    <p className="inline-flex items-center gap-1 text-[#8C6D34] font-mono-num">
                      <MapPin className="w-3.5 h-3.5" />
                      GPS: {inspectModal.evidence.locationLat.toFixed(5)}, {inspectModal.evidence.locationLng.toFixed(5)}
                    </p>
                  )}
                  {inspectModal.evidence.photoUrl && (
                    <img
                      src={inspectModal.evidence.photoUrl}
                      alt="Delivery proof"
                      className="w-full max-h-60 object-cover rounded-xl border border-[#E8E8E8]"
                    />
                  )}
                </div>
              ) : (
                <p className="text-[#333333]/75">No delivery proof submitted yet.</p>
              )}

              <div className="pt-2 border-t border-[#E8E8E8] flex flex-wrap gap-3 text-[11px]">
                <span>
                  Customer Confirmed:{' '}
                  <strong className={inspectModal.confirmation.confirmed ? 'text-emerald-700' : 'text-amber-700'}>
                    {inspectModal.confirmation.confirmed
                      ? `Yes (${inspectModal.confirmation.confirmedBy}) at ${formatDateTime(inspectModal.confirmation.confirmedAt || '')}`
                      : 'Pending'}
                  </strong>
                </span>
                <span>Reminders sent: {inspectModal.confirmation.reminderCount}</span>
              </div>
            </div>

            <div className="space-y-2">
              <p className="font-bold text-[#111111] flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-[#C6A15B]" /> Complete Delivery History ({inspectModal.history.length})
              </p>
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {inspectModal.history.map((h) => (
                  <div key={h.id} className="p-3 rounded-xl border border-[#E8E8E8] bg-white">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-[#111111]">{getDeliveryStatusLabel(h.toStatus)}</span>
                      <span className="font-mono-num text-[11px] text-[#333333]/70">
                        {formatDateTime(h.timestamp)}
                      </span>
                    </div>
                    <p className="text-[#333333] mt-0.5">{h.note}</p>
                    <p className="text-[10px] text-[#8C6D34] uppercase mt-1">
                      Actor: {h.actorType} ({h.actorName})
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Record COD Settlement Modal */}
      {codModal && (
        <div className="fixed inset-0 z-50 bg-[#111111]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleCodSubmit} className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 border border-[#E8E8E8] text-xs">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-[#111111]">
                Confirm COD Settlement · {codModal.orderNumber}
              </h3>
              <button type="button" onClick={() => setCodModal(null)} className="p-1.5 rounded-full hover:bg-[#FAF8F3]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[#333333]">
              Amount due on delivery: <strong className="font-mono-num">{formatNaira(codModal.codAmountToCollect)}</strong>.
              Rider status: <strong>{codModal.codCollected ? 'Reported Collected' : 'Not yet marked collected'}</strong>.
            </p>
            <label className="flex items-start gap-2.5 p-3 rounded-xl bg-[#FAF8F3] border border-[#E8E8E8] cursor-pointer">
              <input
                type="checkbox"
                checked={confirmCodPaid}
                onChange={(e) => setConfirmCodPaid(e.target.checked)}
                className="w-4 h-4 mt-0.5 accent-[#111111]"
              />
              <span>
                <strong>Mark Order Payment as PAID</strong> (only check this after cash/POS remittance from the rider is verified by Finance/Admin).
              </span>
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCodModal(null)}
                className="px-4 py-2 rounded-full border border-[#E8E8E8] font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingCod}
                className="px-5 py-2 rounded-full bg-[#111111] text-white font-bold uppercase tracking-wider inline-flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-[#C6A15B]" />
                {savingCod ? 'Recording...' : 'Confirm Settlement'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Email HTML Preview Modal */}
      {previewEmail && (
        <div className="fixed inset-0 z-50 bg-[#111111]/65 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-5 space-y-3 border border-[#E8E8E8] max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-display text-base font-bold text-[#111111]">{previewEmail.subject}</h3>
                <p className="text-xs text-[#333333]/75">
                  To: {previewEmail.to} · {previewEmail.transport} · {formatDateTime(previewEmail.createdAt)}
                </p>
              </div>
              <button type="button" onClick={() => setPreviewEmail(null)} className="p-1.5 rounded-full hover:bg-[#FAF8F3]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <iframe
              title="Email Preview"
              sandbox=""
              srcDoc={previewEmail.htmlPreview}
              className="w-full flex-1 min-h-[420px] rounded-xl border border-[#E8E8E8] bg-[#FAF8F3]"
            />
          </div>
        </div>
      )}
    </div>
  );
}
