import {
  Bike,
  Edit3,
  History,
  Phone,
  Plus,
  Star,
  Upload,
  UserCheck,
  UserX,
  X,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { apiFetch } from '../../lib/api.ts';
import type {
  DeliveryAnalytics,
  DeliveryRecord,
  Rider,
  RiderReview,
  RiderStatus,
  VehicleType,
} from '../../types/commerce.ts';
import { formatDateShort, formatDateTime } from '../../utils/currency.ts';
import { getDeliveryStatusLabel } from '../../utils/deliveryStatus.ts';

interface Props {
  riders: Rider[];
  deliveries: DeliveryRecord[];
  riderReviews: RiderReview[];
  deliveryAnalytics: DeliveryAnalytics;
  onRefresh: () => Promise<void>;
  pushToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export function AdminRidersSection({
  riders,
  deliveries,
  riderReviews,
  deliveryAnalytics,
  onRefresh,
  pushToast,
}: Props) {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Rider | null>(null);
  const [historyRider, setHistoryRider] = useState<Rider | null>(null);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [vehicleType, setVehicleType] = useState<VehicleType>('motorcycle');
  const [vehicleReg, setVehicleReg] = useState('');
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [zonesText, setZonesText] = useState('Ogbomoso, Oyo State');
  const [status, setStatus] = useState<RiderStatus>('active');
  const [passcode, setPasscode] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [saving, setSaving] = useState(false);

  const perfByRiderId = useMemo(() => {
    const map = new Map(deliveryAnalytics.riderPerformance.map((rp) => [rp.riderId, rp]));
    return map;
  }, [deliveryAnalytics]);

  const openCreate = () => {
    setEditing(null);
    setFullName('');
    setEmail('');
    setPhone('');
    setWhatsapp('');
    setPhotoUrl('');
    setVehicleType('motorcycle');
    setVehicleReg('');
    setEmergencyName('');
    setEmergencyPhone('');
    setZonesText('Ogbomoso, Oyo State');
    setStatus('active');
    setPasscode('');
    setFormOpen(true);
  };

  const openEdit = (r: Rider) => {
    setEditing(r);
    setFullName(r.fullName);
    setEmail(r.email);
    setPhone(r.phone);
    setWhatsapp(r.whatsapp);
    setPhotoUrl(r.photoUrl || '');
    setVehicleType(r.vehicleType);
    setVehicleReg(r.vehicleRegistration || '');
    setEmergencyName(r.emergencyContactName || '');
    setEmergencyPhone(r.emergencyContactPhone || '');
    setZonesText((r.zoneCoverage || []).join(', '));
    setStatus(r.status);
    setPasscode('');
    setFormOpen(true);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const data = await apiFetch<{ url: string }>('/api/admin/rider-upload', {
        method: 'POST',
        body: formData,
      });
      setPhotoUrl(data.url);
      pushToast('Rider photo uploaded', 'success');
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Photo upload failed', 'error');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const zoneCoverage = zonesText
      .split(',')
      .map((z) => z.trim())
      .filter(Boolean);

    if (!editing && passcode.trim().length < 6) {
      pushToast('Passcode must be at least 6 characters for new riders.', 'error');
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        await apiFetch(`/api/admin/riders/${editing.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            fullName: fullName.trim(),
            email: email.trim(),
            phone: phone.trim(),
            whatsapp: whatsapp.trim() || phone.trim(),
            photoUrl: photoUrl.trim(),
            vehicleType,
            vehicleRegistration: vehicleReg.trim(),
            emergencyContactName: emergencyName.trim(),
            emergencyContactPhone: emergencyPhone.trim(),
            zoneCoverage,
            status,
            ...(passcode.trim().length >= 6 ? { passcode: passcode.trim() } : {}),
          }),
        });
        pushToast(`${fullName} updated.`, 'success');
      } else {
        await apiFetch('/api/admin/riders', {
          method: 'POST',
          body: JSON.stringify({
            fullName: fullName.trim(),
            email: email.trim(),
            phone: phone.trim(),
            whatsapp: whatsapp.trim() || phone.trim(),
            photoUrl: photoUrl.trim(),
            vehicleType,
            vehicleRegistration: vehicleReg.trim(),
            emergencyContactName: emergencyName.trim(),
            emergencyContactPhone: emergencyPhone.trim(),
            zoneCoverage,
            passcode: passcode.trim(),
          }),
        });
        pushToast(`${fullName} registered as Diamond Market dispatch rider.`, 'success');
      }
      setFormOpen(false);
      await onRefresh();
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Failed to save rider', 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (r: Rider) => {
    const next: RiderStatus = r.status === 'active' ? 'inactive' : 'active';
    try {
      await apiFetch(`/api/admin/riders/${r.id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: next }),
      });
      await onRefresh();
      pushToast(`${r.fullName} marked ${next}.`, 'info');
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Status update failed', 'error');
    }
  };

  const activeCount = riders.filter((r) => r.status === 'active').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white border border-[#E8E8E8] rounded-2xl p-6">
        <div>
          <h2 className="font-display text-lg font-bold text-[#111111]">
            Dispatch Rider Management ({riders.length})
          </h2>
          <p className="text-xs text-[#333333]/75 mt-0.5">
            {activeCount} active rider(s) · Average rider rating:{' '}
            {deliveryAnalytics.averageRiderRating !== null
              ? `${deliveryAnalytics.averageRiderRating.toFixed(1)} ★`
              : 'No ratings yet'}
            . Riders sign in privately at <span className="font-mono-num font-semibold">/rider</span>.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="px-5 py-2.5 rounded-full bg-[#111111] text-white text-xs font-bold uppercase tracking-wider hover:bg-[#C6A15B] hover:text-[#111111] inline-flex items-center gap-2 cursor-pointer whitespace-nowrap"
        >
          <Plus className="w-4 h-4" /> Register New Rider
        </button>
      </div>

      {riders.length === 0 ? (
        <div className="bg-white border border-[#E8E8E8] rounded-2xl p-10 text-center space-y-2">
          <Bike className="w-8 h-8 text-[#C6A15B] mx-auto" />
          <p className="font-display text-base font-bold text-[#111111]">No Dispatch Riders Registered</p>
          <p className="text-xs text-[#333333]/75 max-w-md mx-auto">
            Register your first rider to assign orders, collect delivery proof photos, verify 6-digit OTP codes, and track delivery ratings.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {riders.map((r) => {
            const perf = perfByRiderId.get(r.id);
            return (
              <div key={r.id} className="bg-white border border-[#E8E8E8] rounded-2xl p-5 space-y-4 text-xs">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {r.photoUrl ? (
                      <img
                        src={r.photoUrl}
                        alt={r.fullName}
                        className="w-12 h-12 rounded-full object-cover border border-[#E8E8E8] shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-[#111111] text-[#C6A15B] flex items-center justify-center font-display font-bold text-base shrink-0">
                        {r.fullName.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-[#111111] truncate">{r.fullName}</p>
                      <p className="font-mono-num text-[11px] font-bold text-[#8C6D34]">{r.riderCode}</p>
                      <p className="text-[11px] text-[#333333]/75 truncate">{r.email}</p>
                    </div>
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase shrink-0 ${
                      r.status === 'active'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-neutral-100 text-neutral-600 border border-[#E8E8E8]'
                    }`}
                  >
                    {r.status}
                  </span>
                </div>

                <div className="space-y-1 text-[#333333]/85 bg-[#FAF8F3] rounded-xl p-3 border border-[#E8E8E8]">
                  <p className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1"><Phone className="w-3 h-3 text-[#C6A15B]" /> Phone</span>
                    <span className="font-mono-num font-semibold text-[#111111]">{r.phone}</span>
                  </p>
                  <p className="flex items-center justify-between">
                    <span>Vehicle</span>
                    <span className="capitalize font-semibold text-[#111111]">
                      {r.vehicleType}{r.vehicleRegistration ? ` (${r.vehicleRegistration})` : ''}
                    </span>
                  </p>
                  <p className="flex items-center justify-between gap-2">
                    <span>Coverage</span>
                    <span className="truncate font-medium text-[#111111]">{(r.zoneCoverage || []).join(', ')}</span>
                  </p>
                  <p className="flex items-center justify-between">
                    <span>Registered</span>
                    <span>{formatDateShort(r.registeredAt)}</span>
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2 rounded-xl border border-[#E8E8E8]">
                    <p className="font-mono-num text-sm font-bold text-[#111111]">{perf?.totalAssigned ?? 0}</p>
                    <p className="text-[10px] text-[#333333]/70 uppercase">Assigned</p>
                  </div>
                  <div className="p-2 rounded-xl border border-[#E8E8E8]">
                    <p className="font-mono-num text-sm font-bold text-emerald-700">{perf?.completed ?? 0}</p>
                    <p className="text-[10px] text-[#333333]/70 uppercase">Completed</p>
                  </div>
                  <div className="p-2 rounded-xl border border-[#E8E8E8]">
                    <p className="font-mono-num text-sm font-bold text-[#8C6D34] inline-flex items-center justify-center gap-0.5">
                      {perf?.averageRating !== null && perf?.averageRating !== undefined ? (
                        <>
                          {perf.averageRating.toFixed(1)} <Star className="w-3 h-3 fill-[#C6A15B] text-[#C6A15B]" />
                        </>
                      ) : (
                        '—'
                      )}
                    </p>
                    <p className="text-[10px] text-[#333333]/70 uppercase">Rating</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => openEdit(r)}
                    className="flex-1 py-2 rounded-lg border border-[#E8E8E8] hover:border-[#111111] font-semibold inline-flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" /> Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => setHistoryRider(r)}
                    className="flex-1 py-2 rounded-lg border border-[#E8E8E8] hover:border-[#111111] font-semibold inline-flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <History className="w-3.5 h-3.5" /> History
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleStatus(r)}
                    className={`px-3 py-2 rounded-lg font-semibold inline-flex items-center gap-1 cursor-pointer ${
                      r.status === 'active'
                        ? 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                        : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                    }`}
                  >
                    {r.status === 'active' ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                    {r.status === 'active' ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Register / Edit Modal */}
      {formOpen && (
        <div className="fixed inset-0 z-50 bg-[#111111]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleSubmit} className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 border border-[#E8E8E8] max-h-[90vh] overflow-y-auto text-xs">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-[#111111]">
                {editing ? `Edit Rider · ${editing.riderCode}` : 'Register Dispatch Rider'}
              </h3>
              <button type="button" onClick={() => setFormOpen(false)} className="p-1.5 rounded-full hover:bg-[#FAF8F3]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-4">
              {photoUrl ? (
                <img src={photoUrl} alt="" className="w-14 h-14 rounded-full object-cover border border-[#E8E8E8]" />
              ) : (
                <div className="w-14 h-14 rounded-full bg-[#FAF8F3] border border-[#E8E8E8] flex items-center justify-center text-[#8C6D34]">
                  <Bike className="w-5 h-5" />
                </div>
              )}
              <label className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#E8E8E8] hover:border-[#111111] font-semibold cursor-pointer">
                <Upload className="w-3.5 h-3.5" />
                <span>{uploadingPhoto ? 'Uploading...' : 'Upload Profile Photo'}</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full border border-[#E8E8E8] rounded-xl px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Sign-In Email *</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full border border-[#E8E8E8] rounded-xl px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Phone Number *</label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full border border-[#E8E8E8] rounded-xl px-3 py-2 font-mono-num"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">WhatsApp Number</label>
                <input
                  type="tel"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="Defaults to phone number"
                  className="w-full border border-[#E8E8E8] rounded-xl px-3 py-2 font-mono-num"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Vehicle Type</label>
                <select
                  value={vehicleType}
                  onChange={(e) => setVehicleType(e.target.value as VehicleType)}
                  className="w-full border border-[#E8E8E8] rounded-xl px-3 py-2 bg-white"
                >
                  <option value="motorcycle">Motorcycle</option>
                  <option value="bicycle">Bicycle</option>
                  <option value="car">Car</option>
                  <option value="van">Delivery Van</option>
                  <option value="dispatch_partner">Dispatch Partner</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold mb-1">Vehicle Plate / Reg #</label>
                <input
                  type="text"
                  value={vehicleReg}
                  onChange={(e) => setVehicleReg(e.target.value)}
                  className="w-full border border-[#E8E8E8] rounded-xl px-3 py-2 font-mono-num"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Emergency Contact Name</label>
                <input
                  type="text"
                  value={emergencyName}
                  onChange={(e) => setEmergencyName(e.target.value)}
                  className="w-full border border-[#E8E8E8] rounded-xl px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Emergency Contact Phone</label>
                <input
                  type="tel"
                  value={emergencyPhone}
                  onChange={(e) => setEmergencyPhone(e.target.value)}
                  className="w-full border border-[#E8E8E8] rounded-xl px-3 py-2 font-mono-num"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block font-semibold mb-1">Zone Coverage (comma-separated)</label>
                <input
                  type="text"
                  value={zonesText}
                  onChange={(e) => setZonesText(e.target.value)}
                  placeholder="Ogbomoso, Ibadan, Lagos"
                  className="w-full border border-[#E8E8E8] rounded-xl px-3 py-2"
                />
              </div>
              {editing && (
                <div>
                  <label className="block font-semibold mb-1">Account Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as RiderStatus)}
                    className="w-full border border-[#E8E8E8] rounded-xl px-3 py-2 bg-white"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>
              )}
              <div className={editing ? '' : 'sm:col-span-2'}>
                <label className="block font-semibold mb-1">
                  {editing ? 'Reset Passcode (Optional, min 6 chars)' : 'Rider Portal Passcode * (min 6 chars)'}
                </label>
                <input
                  type="password"
                  required={!editing}
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  placeholder={editing ? 'Leave blank to keep existing passcode' : 'Minimum 6 characters'}
                  className="w-full border border-[#E8E8E8] rounded-xl px-3 py-2"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="px-4 py-2 rounded-full border border-[#E8E8E8] font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 rounded-full bg-[#111111] text-white font-bold uppercase tracking-wider"
              >
                {saving ? 'Saving...' : editing ? 'Save Changes' : 'Register Rider'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Rider History & Feedback Modal */}
      {historyRider && (
        <div className="fixed inset-0 z-50 bg-[#111111]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 space-y-5 border border-[#E8E8E8] max-h-[90vh] overflow-y-auto text-xs">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display text-lg font-bold text-[#111111]">
                  {historyRider.fullName} ({historyRider.riderCode}) · Delivery History &amp; Ratings
                </h3>
                <p className="text-[#333333]/75">{historyRider.email} · {historyRider.phone}</p>
              </div>
              <button type="button" onClick={() => setHistoryRider(null)} className="p-1.5 rounded-full hover:bg-[#FAF8F3]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <h4 className="font-bold uppercase tracking-wider text-[#8C6D34] text-[11px]">
                Assigned Deliveries ({deliveries.filter((d) => d.riderId === historyRider.id).length})
              </h4>
              {deliveries.filter((d) => d.riderId === historyRider.id).length === 0 ? (
                <p className="p-4 rounded-xl bg-[#FAF8F3] border border-[#E8E8E8] text-[#333333]/75">
                  No deliveries assigned to this rider yet.
                </p>
              ) : (
                <div className="space-y-2 max-h-52 overflow-y-auto">
                  {deliveries
                    .filter((d) => d.riderId === historyRider.id)
                    .map((d) => (
                      <div key={d.id} className="p-3 rounded-xl border border-[#E8E8E8] flex items-center justify-between gap-3">
                        <div>
                          <p className="font-mono-num font-bold text-[#111111]">{d.orderNumber}</p>
                          <p className="text-[#333333]/75">
                            {d.recipientName} · {d.addressCity}, {d.addressState}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="font-semibold text-[#111111]">{getDeliveryStatusLabel(d.status)}</span>
                          <p className="text-[11px] text-[#333333]/70">{formatDateTime(d.updatedAt)}</p>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <h4 className="font-bold uppercase tracking-wider text-[#8C6D34] text-[11px]">
                Customer Ratings ({riderReviews.filter((rv) => rv.riderId === historyRider.id).length})
              </h4>
              {riderReviews.filter((rv) => rv.riderId === historyRider.id).length === 0 ? (
                <p className="p-4 rounded-xl bg-[#FAF8F3] border border-[#E8E8E8] text-[#333333]/75">
                  No customer rider ratings submitted yet.
                </p>
              ) : (
                <div className="space-y-2 max-h-52 overflow-y-auto">
                  {riderReviews
                    .filter((rv) => rv.riderId === historyRider.id)
                    .map((rv) => (
                      <div key={rv.id} className="p-3 rounded-xl border border-[#E8E8E8] bg-[#FAF8F3] space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-[#111111]">
                            {rv.customerDisplayName} · Order {rv.orderNumber}
                          </span>
                          <span className="font-mono-num font-bold text-[#8C6D34]">
                            {rv.overallRating.toFixed(1)} ★
                          </span>
                        </div>
                        {rv.comment && <p className="text-[#333333]">{rv.comment}</p>}
                        <p className="text-[10px] text-[#333333]/75">
                          Politeness {rv.politenessRating}/5 · Communication {rv.communicationRating}/5 · Timeliness {rv.timelinessRating}/5 · Handling {rv.handlingRating}/5
                        </p>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
