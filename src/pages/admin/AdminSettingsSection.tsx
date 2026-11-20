import { Award, Check, CheckCircle2, Flag, Globe, Lock, ShieldCheck, Star, Trash2, Upload, XCircle } from 'lucide-react';
import React, { useState } from 'react';
import { NIGERIAN_STATES } from '../../data/nigeria.ts';
import { apiFetch } from '../../lib/api.ts';
import type {
  AdminAnalytics,
  AuditLogEntry,
  ConnectionStatus,
  Coupon,
  PaymentGatewaysSettings,
  PaymentMethodId,
  ProductReview,
  RiderReview,
  ShippingZone,
  StoreNotification,
  StoreSettings,
} from '../../types/commerce.ts';
import { formatDateTime, formatNaira } from '../../utils/currency.ts';

interface Props {
  section:
    | 'coupons'
    | 'reviews'
    | 'reports'
    | 'store_settings'
    | 'payment_settings'
    | 'shipping_settings'
    | 'notifications'
    | 'security';
  paymentGateways: PaymentGatewaysSettings;
  shippingZones: ShippingZone[];
  coupons: Coupon[];
  reviews: ProductReview[];
  riderReviews?: RiderReview[];
  storeSettings: StoreSettings;
  notifications: StoreNotification[];
  auditLogs: AuditLogEntry[];
  analytics: AdminAnalytics;
  connection: ConnectionStatus;
  onRefresh: () => Promise<void>;
  onRefreshPublicStore: () => Promise<void>;
  pushToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export function AdminSettingsSection({
  section,
  paymentGateways,
  shippingZones,
  coupons,
  reviews,
  riderReviews = [],
  storeSettings,
  notifications,
  auditLogs,
  analytics,
  connection,
  onRefresh,
  onRefreshPublicStore,
  pushToast,
}: Props) {
  const [gwDraft, setGwDraft] = useState<PaymentGatewaysSettings>(paymentGateways);
  const [paystackSecret, setPaystackSecret] = useState('');
  const [flwSecret, setFlwSecret] = useState('');
  const [flwHash, setFlwHash] = useState('');
  const [savingGw, setSavingGw] = useState<PaymentMethodId | null>(null);

  const [storeDraft, setStoreDraft] = useState<StoreSettings>(storeSettings);
  const [savingStore, setSavingStore] = useState(false);
  const [uploadingHero, setUploadingHero] = useState(false);

  const [wcUrl, setWcUrl] = useState(connection.woocommerceUrl || '');
  const [wcKey, setWcKey] = useState('');
  const [wcSecret, setWcSecret] = useState('');
  const [wpBridgeSecret, setWpBridgeSecret] = useState('');
  const [connectingWc, setConnectingWc] = useState(false);

  const [coupCode, setCoupCode] = useState('');
  const [coupType, setCoupType] = useState<'percent' | 'fixed_cart'>('percent');
  const [coupAmount, setCoupAmount] = useState(10);
  const [coupMin, setCoupMin] = useState(25000);
  const [coupExpiry, setCoupExpiry] = useState('2027-12-31');

  const [zoneName, setZoneName] = useState('');
  const [zoneRate, setZoneRate] = useState(3500);
  const [zoneFreeMin, setZoneFreeMin] = useState(150000);
  const [zoneDays, setZoneDays] = useState('1–3 business days');
  const [zoneStates, setZoneStates] = useState<string[]>(['Oyo']);

  const saveGateway = async (id: PaymentMethodId, payload: Record<string, unknown>) => {
    setSavingGw(id);
    try {
      await apiFetch(`/api/admin/payment-gateways/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      setPaystackSecret('');
      setFlwSecret('');
      setFlwHash('');
      await Promise.all([onRefresh(), onRefreshPublicStore()]);
      pushToast(`${id.toUpperCase()} payment configuration saved & synced to checkout`, 'success');
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Failed to save payment gateway', 'error');
    } finally {
      setSavingGw(null);
    }
  };

  if (section === 'payment_settings') {
    return (
      <div className="space-y-6">
        <div className="bg-white border border-[#E8E8E8] rounded-2xl p-6">
          <h2 className="font-display text-lg font-bold text-[#111111]">
            Payment Methods Configuration
          </h2>
          <p className="text-xs text-[#333333]/75 mt-1">
            Enable, disable, and configure Nigerian Naira (₦) gateways. Changes apply immediately to customer checkout.
          </p>
        </div>

        {/* 1. Paystack */}
        <div className="bg-white border border-[#E8E8E8] rounded-2xl p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <h3 className="font-display text-base font-bold text-[#111111]">Paystack</h3>
                <span className={`text-xs font-semibold ${gwDraft.paystack.enabled ? 'text-emerald-700' : 'text-neutral-500'}`}>
                  · {gwDraft.paystack.enabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              <p className="text-xs text-[#333333]/75 mt-0.5">{gwDraft.paystack.description}</p>
            </div>
            <label className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer">
              <input
                type="checkbox"
                checked={gwDraft.paystack.enabled}
                onChange={(e) => {
                  const enabled = e.target.checked;
                  setGwDraft({ ...gwDraft, paystack: { ...gwDraft.paystack, enabled } });
                  saveGateway('paystack', { enabled });
                }}
                className="w-4 h-4 accent-[#111111]"
              />
              <span>Enable Paystack</span>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs pt-2 border-t border-[#E8E8E8]">
            <div>
              <label className="block font-semibold mb-1">Environment Mode</label>
              <select
                value={gwDraft.paystack.testMode ? 'test' : 'live'}
                onChange={(e) =>
                  setGwDraft({
                    ...gwDraft,
                    paystack: { ...gwDraft.paystack, testMode: e.target.value === 'test' },
                  })
                }
                className="w-full border border-[#E8E8E8] rounded-xl px-3 py-2 bg-white"
              >
                <option value="test">Test Mode (Sandbox)</option>
                <option value="live">Live Production Mode</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold mb-1">Public Key (pk_...)</label>
              <input
                type="text"
                value={gwDraft.paystack.publicKey}
                onChange={(e) =>
                  setGwDraft({
                    ...gwDraft,
                    paystack: { ...gwDraft.paystack, publicKey: e.target.value },
                  })
                }
                placeholder="pk_test_..."
                className="w-full border border-[#E8E8E8] rounded-xl px-3 py-2 font-mono-num"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">
                Secret Key {gwDraft.paystack.hasSecretKey ? `(${gwDraft.paystack.secretKeyMasked})` : '(Not set)'}
              </label>
              <input
                type="password"
                value={paystackSecret}
                onChange={(e) => setPaystackSecret(e.target.value)}
                placeholder="sk_test_... (leave blank to keep)"
                className="w-full border border-[#E8E8E8] rounded-xl px-3 py-2 font-mono-num"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              disabled={savingGw === 'paystack'}
              onClick={() =>
                saveGateway('paystack', {
                  enabled: gwDraft.paystack.enabled,
                  testMode: gwDraft.paystack.testMode,
                  publicKey: gwDraft.paystack.publicKey,
                  ...(paystackSecret ? { secretKey: paystackSecret } : {}),
                })
              }
              className="px-5 py-2 bg-[#111111] text-white text-xs font-bold uppercase tracking-wider rounded-full hover:bg-[#C6A15B] hover:text-[#111111] cursor-pointer"
            >
              {savingGw === 'paystack' ? 'Saving...' : 'Save Paystack'}
            </button>
          </div>
        </div>

        {/* 2. Flutterwave */}
        <div className="bg-white border border-[#E8E8E8] rounded-2xl p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <h3 className="font-display text-base font-bold text-[#111111]">Flutterwave</h3>
                <span className={`text-xs font-semibold ${gwDraft.flutterwave.enabled ? 'text-emerald-700' : 'text-neutral-500'}`}>
                  · {gwDraft.flutterwave.enabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              <p className="text-xs text-[#333333]/75 mt-0.5">{gwDraft.flutterwave.description}</p>
            </div>
            <label className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer">
              <input
                type="checkbox"
                checked={gwDraft.flutterwave.enabled}
                onChange={(e) => {
                  const enabled = e.target.checked;
                  setGwDraft({ ...gwDraft, flutterwave: { ...gwDraft.flutterwave, enabled } });
                  saveGateway('flutterwave', { enabled });
                }}
                className="w-4 h-4 accent-[#111111]"
              />
              <span>Enable Flutterwave</span>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs pt-2 border-t border-[#E8E8E8]">
            <div>
              <label className="block font-semibold mb-1">Environment Mode</label>
              <select
                value={gwDraft.flutterwave.testMode ? 'test' : 'live'}
                onChange={(e) =>
                  setGwDraft({
                    ...gwDraft,
                    flutterwave: { ...gwDraft.flutterwave, testMode: e.target.value === 'test' },
                  })
                }
                className="w-full border border-[#E8E8E8] rounded-xl px-3 py-2 bg-white"
              >
                <option value="test">Test Mode</option>
                <option value="live">Live Production</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold mb-1">Public Key</label>
              <input
                type="text"
                value={gwDraft.flutterwave.publicKey}
                onChange={(e) =>
                  setGwDraft({
                    ...gwDraft,
                    flutterwave: { ...gwDraft.flutterwave, publicKey: e.target.value },
                  })
                }
                placeholder="FLWPUBK_TEST-..."
                className="w-full border border-[#E8E8E8] rounded-xl px-3 py-2 font-mono-num"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">
                Secret Key {gwDraft.flutterwave.hasSecretKey ? `(${gwDraft.flutterwave.secretKeyMasked})` : '(Not set)'}
              </label>
              <input
                type="password"
                value={flwSecret}
                onChange={(e) => setFlwSecret(e.target.value)}
                placeholder="FLWSECK_TEST-..."
                className="w-full border border-[#E8E8E8] rounded-xl px-3 py-2 font-mono-num"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">
                Webhook Secret Hash {gwDraft.flutterwave.hasWebhookHash ? '(Set)' : '(Not set)'}
              </label>
              <input
                type="password"
                value={flwHash}
                onChange={(e) => setFlwHash(e.target.value)}
                placeholder="verif-hash"
                className="w-full border border-[#E8E8E8] rounded-xl px-3 py-2 font-mono-num"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              disabled={savingGw === 'flutterwave'}
              onClick={() =>
                saveGateway('flutterwave', {
                  enabled: gwDraft.flutterwave.enabled,
                  testMode: gwDraft.flutterwave.testMode,
                  publicKey: gwDraft.flutterwave.publicKey,
                  ...(flwSecret ? { secretKey: flwSecret } : {}),
                  ...(flwHash ? { webhookHash: flwHash } : {}),
                })
              }
              className="px-5 py-2 bg-[#111111] text-white text-xs font-bold uppercase tracking-wider rounded-full hover:bg-[#C6A15B] hover:text-[#111111] cursor-pointer"
            >
              {savingGw === 'flutterwave' ? 'Saving...' : 'Save Flutterwave'}
            </button>
          </div>
        </div>

        {/* 3. Bank Transfer */}
        <div className="bg-white border border-[#E8E8E8] rounded-2xl p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <h3 className="font-display text-base font-bold text-[#111111]">Direct Bank Transfer</h3>
                <span className={`text-xs font-semibold ${gwDraft.bacs.enabled ? 'text-emerald-700' : 'text-neutral-500'}`}>
                  · {gwDraft.bacs.enabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              <p className="text-xs text-[#333333]/75 mt-0.5">{gwDraft.bacs.description}</p>
            </div>
            <label className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer">
              <input
                type="checkbox"
                checked={gwDraft.bacs.enabled}
                onChange={(e) => {
                  const enabled = e.target.checked;
                  setGwDraft({ ...gwDraft, bacs: { ...gwDraft.bacs, enabled } });
                  saveGateway('bacs', { enabled });
                }}
                className="w-4 h-4 accent-[#111111]"
              />
              <span>Enable Bank Transfer</span>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs pt-2 border-t border-[#E8E8E8]">
            <div>
              <label className="block font-semibold mb-1">Bank Name</label>
              <input
                type="text"
                value={gwDraft.bacs.bankName}
                onChange={(e) =>
                  setGwDraft({ ...gwDraft, bacs: { ...gwDraft.bacs, bankName: e.target.value } })
                }
                className="w-full border border-[#E8E8E8] rounded-xl px-3 py-2"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Account Name</label>
              <input
                type="text"
                value={gwDraft.bacs.accountName}
                onChange={(e) =>
                  setGwDraft({ ...gwDraft, bacs: { ...gwDraft.bacs, accountName: e.target.value } })
                }
                className="w-full border border-[#E8E8E8] rounded-xl px-3 py-2"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">NUBAN Account Number</label>
              <input
                type="text"
                value={gwDraft.bacs.accountNumber}
                onChange={(e) =>
                  setGwDraft({ ...gwDraft, bacs: { ...gwDraft.bacs, accountNumber: e.target.value } })
                }
                className="w-full border border-[#E8E8E8] rounded-xl px-3 py-2 font-mono-num"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Deadline (Hours)</label>
              <input
                type="number"
                min={1}
                value={gwDraft.bacs.paymentDeadlineHours}
                onChange={(e) =>
                  setGwDraft({
                    ...gwDraft,
                    bacs: { ...gwDraft.bacs, paymentDeadlineHours: Number(e.target.value) },
                  })
                }
                className="w-full border border-[#E8E8E8] rounded-xl px-3 py-2 font-mono-num"
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-4">
              <label className="block font-semibold mb-1">Transfer Instructions</label>
              <input
                type="text"
                value={gwDraft.bacs.instructions}
                onChange={(e) =>
                  setGwDraft({ ...gwDraft, bacs: { ...gwDraft.bacs, instructions: e.target.value } })
                }
                className="w-full border border-[#E8E8E8] rounded-xl px-3 py-2"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              disabled={savingGw === 'bacs'}
              onClick={() => saveGateway('bacs', gwDraft.bacs as unknown as Record<string, unknown>)}
              className="px-5 py-2 bg-[#111111] text-white text-xs font-bold uppercase tracking-wider rounded-full hover:bg-[#C6A15B] hover:text-[#111111] cursor-pointer"
            >
              {savingGw === 'bacs' ? 'Saving...' : 'Save Bank Transfer'}
            </button>
          </div>
        </div>

        {/* 4. COD */}
        <div className="bg-white border border-[#E8E8E8] rounded-2xl p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <h3 className="font-display text-base font-bold text-[#111111]">Pay on Delivery (COD)</h3>
                <span className={`text-xs font-semibold ${gwDraft.cod.enabled ? 'text-emerald-700' : 'text-neutral-500'}`}>
                  · {gwDraft.cod.enabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              <p className="text-xs text-[#333333]/75 mt-0.5">{gwDraft.cod.description}</p>
            </div>
            <label className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer">
              <input
                type="checkbox"
                checked={gwDraft.cod.enabled}
                onChange={(e) => {
                  const enabled = e.target.checked;
                  setGwDraft({ ...gwDraft, cod: { ...gwDraft.cod, enabled } });
                  saveGateway('cod', { enabled });
                }}
                className="w-4 h-4 accent-[#111111]"
              />
              <span>Enable COD</span>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs pt-2 border-t border-[#E8E8E8]">
            <div>
              <label className="block font-semibold mb-1">Minimum Order (₦)</label>
              <input
                type="number"
                min={0}
                value={gwDraft.cod.minOrderAmount}
                onChange={(e) =>
                  setGwDraft({
                    ...gwDraft,
                    cod: { ...gwDraft.cod, minOrderAmount: Number(e.target.value) },
                  })
                }
                className="w-full border border-[#E8E8E8] rounded-xl px-3 py-2 font-mono-num"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Maximum Order (₦)</label>
              <input
                type="number"
                min={0}
                value={gwDraft.cod.maxOrderAmount}
                onChange={(e) =>
                  setGwDraft({
                    ...gwDraft,
                    cod: { ...gwDraft.cod, maxOrderAmount: Number(e.target.value) },
                  })
                }
                className="w-full border border-[#E8E8E8] rounded-xl px-3 py-2 font-mono-num"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Additional Fee (₦)</label>
              <input
                type="number"
                min={0}
                value={gwDraft.cod.additionalFee}
                onChange={(e) =>
                  setGwDraft({
                    ...gwDraft,
                    cod: { ...gwDraft.cod, additionalFee: Number(e.target.value) },
                  })
                }
                className="w-full border border-[#E8E8E8] rounded-xl px-3 py-2 font-mono-num"
              />
            </div>
            <div className="sm:col-span-3">
              <label className="block font-semibold mb-1">Supported Nigerian States (Comma separated, or ALL)</label>
              <input
                type="text"
                value={gwDraft.cod.supportedStates.join(', ')}
                onChange={(e) =>
                  setGwDraft({
                    ...gwDraft,
                    cod: {
                      ...gwDraft.cod,
                      supportedStates: e.target.value
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean),
                    },
                  })
                }
                className="w-full border border-[#E8E8E8] rounded-xl px-3 py-2"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              disabled={savingGw === 'cod'}
              onClick={() => saveGateway('cod', gwDraft.cod as unknown as Record<string, unknown>)}
              className="px-5 py-2 bg-[#111111] text-white text-xs font-bold uppercase tracking-wider rounded-full hover:bg-[#C6A15B] hover:text-[#111111] cursor-pointer"
            >
              {savingGw === 'cod' ? 'Saving...' : 'Save COD Settings'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (section === 'shipping_settings') {
    const handleAddZone = async (e: React.FormEvent) => {
      e.preventDefault();
      await apiFetch('/api/admin/shipping-zones', {
        method: 'POST',
        body: JSON.stringify({
          id: `zone-${Date.now().toString().slice(-5)}`,
          name: zoneName,
          states: zoneStates,
          flatRate: zoneRate,
          freeShippingMinOrder: zoneFreeMin || null,
          pickupAvailable: false,
          estimatedDays: zoneDays,
          enabled: true,
        }),
      });
      setZoneName('');
      await Promise.all([onRefresh(), onRefreshPublicStore()]);
      pushToast('Shipping zone saved', 'success');
    };

    const handleDeleteZone = async (id: string) => {
      await apiFetch(`/api/admin/shipping-zones/${id}`, { method: 'DELETE' });
      await Promise.all([onRefresh(), onRefreshPublicStore()]);
      pushToast('Shipping zone removed', 'info');
    };

    return (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 bg-white border border-[#E8E8E8] rounded-2xl p-6">
          <h2 className="font-display text-lg font-bold text-[#111111] mb-4">
            Add Nigerian Shipping Zone
          </h2>
          <form onSubmit={handleAddZone} className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold mb-1">Zone Name</label>
              <input
                type="text"
                required
                value={zoneName}
                onChange={(e) => setZoneName(e.target.value)}
                placeholder="Ibadan & Oyo Express"
                className="w-full border border-[#E8E8E8] rounded-xl px-3 py-2"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold mb-1">Flat Rate (₦)</label>
                <input
                  type="number"
                  min={0}
                  value={zoneRate}
                  onChange={(e) => setZoneRate(Number(e.target.value))}
                  className="w-full border border-[#E8E8E8] rounded-xl px-3 py-2 font-mono-num"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Free Shipping Over (₦)</label>
                <input
                  type="number"
                  min={0}
                  value={zoneFreeMin}
                  onChange={(e) => setZoneFreeMin(Number(e.target.value))}
                  className="w-full border border-[#E8E8E8] rounded-xl px-3 py-2 font-mono-num"
                />
              </div>
            </div>
            <div>
              <label className="block font-semibold mb-1">Estimated Transit Time</label>
              <input
                type="text"
                value={zoneDays}
                onChange={(e) => setZoneDays(e.target.value)}
                className="w-full border border-[#E8E8E8] rounded-xl px-3 py-2"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Primary State</label>
              <select
                value={zoneStates[0] || 'Oyo'}
                onChange={(e) => setZoneStates([e.target.value])}
                className="w-full border border-[#E8E8E8] rounded-xl px-3 py-2 bg-white"
              >
                <option value="ALL">ALL (Nationwide Fallback)</option>
                {NIGERIAN_STATES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className="w-full py-2.5 bg-[#111111] text-white text-xs font-bold uppercase tracking-wider rounded-full cursor-pointer"
            >
              Save Shipping Zone
            </button>
          </form>
        </div>

        <div className="lg:col-span-7 bg-white border border-[#E8E8E8] rounded-2xl p-6">
          <h2 className="font-display text-lg font-bold text-[#111111] mb-4">
            Active Shipping Zones ({shippingZones.length})
          </h2>
          <div className="divide-y divide-[#E8E8E8]">
            {shippingZones.map((z) => (
              <div key={z.id} className="py-4 flex items-start justify-between gap-4">
                <div className="text-xs space-y-1">
                  <p className="text-sm font-bold text-[#111111]">{z.name}</p>
                  <p className="text-[#333333]/75">States: {z.states.join(', ')}</p>
                  <p className="font-mono-num">
                    Rate: <strong>{formatNaira(z.flatRate)}</strong>
                    {z.freeShippingMinOrder
                      ? ` · Free over ${formatNaira(z.freeShippingMinOrder)}`
                      : ''}
                    {' · '}
                    {z.estimatedDays}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteZone(z.id)}
                  className="text-neutral-400 hover:text-rose-700 p-1 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (section === 'coupons') {
    const handleSaveCoupon = async (e: React.FormEvent) => {
      e.preventDefault();
      await apiFetch('/api/admin/coupons', {
        method: 'POST',
        body: JSON.stringify({
          code: coupCode.trim().toUpperCase(),
          type: coupType,
          amount: coupAmount,
          description: `${coupType === 'percent' ? `${coupAmount}%` : formatNaira(coupAmount)} discount`,
          minSpend: coupMin,
          expiryDate: coupExpiry,
          active: true,
        }),
      });
      setCoupCode('');
      await onRefresh();
      pushToast('Coupon saved', 'success');
    };

    const handleDeleteCoupon = async (id: string) => {
      await apiFetch(`/api/admin/coupons/${id}`, { method: 'DELETE' });
      await onRefresh();
      pushToast('Coupon deleted', 'info');
    };

    return (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 bg-white border border-[#E8E8E8] rounded-2xl p-6">
          <h2 className="font-display text-lg font-bold text-[#111111] mb-4">Create Promo Code</h2>
          <form onSubmit={handleSaveCoupon} className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold mb-1">Coupon Code</label>
              <input
                type="text"
                required
                value={coupCode}
                onChange={(e) => setCoupCode(e.target.value.toUpperCase())}
                placeholder="DIAMOND15"
                className="w-full border border-[#E8E8E8] rounded-xl px-3 py-2 font-mono-num uppercase"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold mb-1">Discount Type</label>
                <select
                  value={coupType}
                  onChange={(e) => setCoupType(e.target.value as 'percent' | 'fixed_cart')}
                  className="w-full border border-[#E8E8E8] rounded-xl px-3 py-2 bg-white"
                >
                  <option value="percent">Percentage (%)</option>
                  <option value="fixed_cart">Fixed Cart (₦)</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold mb-1">Amount</label>
                <input
                  type="number"
                  min={1}
                  value={coupAmount}
                  onChange={(e) => setCoupAmount(Number(e.target.value))}
                  className="w-full border border-[#E8E8E8] rounded-xl px-3 py-2 font-mono-num"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold mb-1">Minimum Spend (₦)</label>
                <input
                  type="number"
                  min={0}
                  value={coupMin}
                  onChange={(e) => setCoupMin(Number(e.target.value))}
                  className="w-full border border-[#E8E8E8] rounded-xl px-3 py-2 font-mono-num"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Expiry Date</label>
                <input
                  type="date"
                  value={coupExpiry}
                  onChange={(e) => setCoupExpiry(e.target.value)}
                  className="w-full border border-[#E8E8E8] rounded-xl px-3 py-2"
                />
              </div>
            </div>
            <button
              type="submit"
              className="w-full py-2.5 bg-[#111111] text-white text-xs font-bold uppercase tracking-wider rounded-full cursor-pointer"
            >
              Create Coupon
            </button>
          </form>
        </div>

        <div className="lg:col-span-7 bg-white border border-[#E8E8E8] rounded-2xl p-6">
          <h2 className="font-display text-lg font-bold text-[#111111] mb-4">
            Active Coupons ({coupons.length})
          </h2>
          <div className="divide-y divide-[#E8E8E8]">
            {coupons.map((c) => (
              <div key={c.id} className="py-3.5 flex items-center justify-between gap-4 text-xs">
                <div>
                  <p className="font-mono-num text-sm font-bold text-[#111111]">{c.code}</p>
                  <p className="text-[#333333]/75 mt-0.5">
                    {c.description} · Min {formatNaira(c.minSpend)} · Used {c.usageCount} times
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteCoupon(c.id)}
                  className="text-neutral-400 hover:text-rose-700 p-1 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (section === 'reviews') {
    const moderate = async (id: string, status: ProductReview['status']) => {
      await apiFetch(`/api/admin/reviews/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      });
      await Promise.all([onRefresh(), onRefreshPublicStore()]);
      pushToast(`Review marked ${status}`, 'success');
    };

    const toggleFeature = async (id: string, featured: boolean) => {
      await apiFetch(`/api/admin/reviews/${id}/feature`, {
        method: 'PUT',
        body: JSON.stringify({ featured }),
      });
      await Promise.all([onRefresh(), onRefreshPublicStore()]);
      pushToast(featured ? 'Featured on Homepage Testimonials' : 'Removed from Homepage Highlights', 'info');
    };

    const removeRev = async (id: string) => {
      await apiFetch(`/api/admin/reviews/${id}`, { method: 'DELETE' });
      await Promise.all([onRefresh(), onRefreshPublicStore()]);
      pushToast('Review deleted', 'info');
    };

    const moderateRiderRev = async (
      id: string,
      patch: { status?: RiderReview['status']; featuredTestimonial?: boolean }
    ) => {
      await apiFetch(`/api/admin/rider-reviews/${id}`, {
        method: 'PUT',
        body: JSON.stringify(patch),
      });
      await Promise.all([onRefresh(), onRefreshPublicStore()]);
      pushToast('Rider testimonial updated', 'success');
    };

    return (
      <div className="space-y-6">
        <div className="bg-white border border-[#E8E8E8] rounded-2xl p-6">
          <h2 className="font-display text-lg font-bold text-[#111111] mb-4">
            Product Reviews &amp; Verified Testimonials ({reviews.length})
          </h2>
          {reviews.length === 0 ? (
            <p className="text-sm text-[#333333]/75 bg-[#FAF8F3] rounded-xl p-8 text-center border border-[#E8E8E8]">
              No customer reviews submitted yet.
            </p>
          ) : (
            <div className="divide-y divide-[#E8E8E8]">
              {reviews.map((r) => (
                <div key={r.id} className="py-4 flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                  <div className="text-xs space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-[#111111]">
                        {r.reviewerName} ({r.rating}/5 ★)
                      </span>
                      <span className="text-[#333333]/75">on {r.productName || r.productId}</span>
                      <span className="uppercase text-[10px] font-bold px-2 py-0.5 rounded bg-[#FAF8F3] border border-[#E8E8E8] text-[#8C6D34]">
                        {r.status}
                      </span>
                      {r.verifiedPurchase && (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                          Verified Buyer {r.orderNumber ? `· ${r.orderNumber}` : ''}
                        </span>
                      )}
                      {r.featuredTestimonial && (
                        <span className="text-[10px] font-bold bg-[#111111] text-[#C6A15B] px-2 py-0.5 rounded inline-flex items-center gap-1">
                          <Award className="w-3 h-3" /> Featured
                        </span>
                      )}
                      {r.reported && (
                        <span className="text-[10px] font-bold bg-rose-50 text-rose-700 px-2 py-0.5 rounded inline-flex items-center gap-1">
                          <Flag className="w-3 h-3" /> Flagged{r.reportReason ? `: ${r.reportReason}` : ''}
                        </span>
                      )}
                    </div>
                    {r.title && <p className="font-semibold text-[#111111]">{r.title}</p>}
                    <p className="text-[#333333]">{r.comment}</p>
                    {(r.qualityRating || r.accuracyRating || r.sizeFitFeedback) && (
                      <p className="text-[11px] text-[#333333]/75">
                        {r.qualityRating ? `Quality ${r.qualityRating}/5 · ` : ''}
                        {r.accuracyRating ? `Accuracy ${r.accuracyRating}/5 · ` : ''}
                        {r.sizeFitFeedback ? `Fit: ${r.sizeFitFeedback.replace(/_/g, ' ')}` : ''}
                      </p>
                    )}
                    {r.photos && r.photos.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {r.photos.map((photo, idx) => (
                          <img
                            key={idx}
                            src={photo}
                            alt=""
                            className="w-12 h-12 rounded-lg object-cover border border-[#E8E8E8]"
                          />
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => moderate(r.id, 'approved')}
                      className="px-3 py-1.5 bg-emerald-700 text-white text-xs rounded-full flex items-center gap-1 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" /> Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleFeature(r.id, !r.featuredTestimonial)}
                      className={`px-3 py-1.5 text-xs rounded-full flex items-center gap-1 cursor-pointer border ${
                        r.featuredTestimonial
                          ? 'bg-[#C6A15B] text-[#111111] border-[#C6A15B] font-bold'
                          : 'bg-white border-[#E8E8E8] text-[#111111]'
                      }`}
                    >
                      <Star className="w-3.5 h-3.5" /> {r.featuredTestimonial ? 'Unfeature' : 'Feature'}
                    </button>
                    <button
                      type="button"
                      onClick={() => moderate(r.id, 'rejected')}
                      className="px-3 py-1.5 bg-neutral-200 text-[#111111] text-xs rounded-full flex items-center gap-1 cursor-pointer"
                    >
                      <XCircle className="w-3.5 h-3.5" /> Reject
                    </button>
                    <button
                      type="button"
                      onClick={() => removeRev(r.id)}
                      className="p-1.5 text-neutral-400 hover:text-rose-700 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border border-[#E8E8E8] rounded-2xl p-6">
          <h2 className="font-display text-lg font-bold text-[#111111] mb-4">
            Rider Delivery Ratings &amp; Testimonials ({riderReviews.length})
          </h2>
          {riderReviews.length === 0 ? (
            <p className="text-sm text-[#333333]/75 bg-[#FAF8F3] rounded-xl p-8 text-center border border-[#E8E8E8]">
              No customer rider ratings submitted yet. Customers can rate their rider after confirming delivery.
            </p>
          ) : (
            <div className="divide-y divide-[#E8E8E8]">
              {riderReviews.map((rr) => (
                <div key={rr.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-[#111111]">
                        {rr.customerDisplayName} rated {rr.riderName} ({rr.overallRating.toFixed(1)}/5 ★)
                      </span>
                      <span className="font-mono-num text-[#8C6D34]">{rr.orderNumber}</span>
                      <span className="uppercase text-[10px] font-bold px-2 py-0.5 rounded bg-[#FAF8F3] border border-[#E8E8E8]">
                        {rr.status}
                      </span>
                      {rr.featuredTestimonial && (
                        <span className="text-[10px] font-bold bg-[#111111] text-[#C6A15B] px-2 py-0.5 rounded">
                          Featured
                        </span>
                      )}
                    </div>
                    {rr.comment && <p className="text-[#333333]">{rr.comment}</p>}
                    <p className="text-[11px] text-[#333333]/75">
                      Politeness {rr.politenessRating}/5 · Communication {rr.communicationRating}/5 · Timeliness {rr.timelinessRating}/5 · Handling {rr.handlingRating}/5
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => moderateRiderRev(rr.id, { status: 'approved' })}
                      className="px-3 py-1.5 bg-emerald-700 text-white text-xs rounded-full cursor-pointer"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => moderateRiderRev(rr.id, { featuredTestimonial: !rr.featuredTestimonial })}
                      className={`px-3 py-1.5 text-xs rounded-full border cursor-pointer ${
                        rr.featuredTestimonial
                          ? 'bg-[#C6A15B] text-[#111111] border-[#C6A15B] font-bold'
                          : 'bg-white border-[#E8E8E8] text-[#111111]'
                      }`}
                    >
                      {rr.featuredTestimonial ? 'Unfeature' : 'Feature'}
                    </button>
                    <button
                      type="button"
                      onClick={() => moderateRiderRev(rr.id, { status: 'rejected' })}
                      className="px-3 py-1.5 bg-neutral-200 text-[#111111] text-xs rounded-full cursor-pointer"
                    >
                      Hide
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (section === 'reports') {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-[#E8E8E8] rounded-2xl p-6">
          <h2 className="font-display text-lg font-bold text-[#111111] mb-4">
            Sales by Category
          </h2>
          {analytics.salesByCategory.length === 0 ? (
            <p className="text-xs text-[#333333]/75 bg-[#FAF8F3] p-6 rounded-xl border border-[#E8E8E8]">
              No confirmed category sales yet.
            </p>
          ) : (
            <div className="space-y-3">
              {analytics.salesByCategory.map((cat) => (
                <div key={cat.category} className="flex justify-between text-xs border-b border-[#E8E8E8] pb-2">
                  <span className="font-semibold text-[#111111]">{cat.category}</span>
                  <span className="font-mono-num">
                    {cat.orders} items · {formatNaira(cat.revenue)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border border-[#E8E8E8] rounded-2xl p-6">
          <h2 className="font-display text-lg font-bold text-[#111111] mb-4">
            Payment Gateway Adoption
          </h2>
          {analytics.paymentMethodUsage.length === 0 ? (
            <p className="text-xs text-[#333333]/75 bg-[#FAF8F3] p-6 rounded-xl border border-[#E8E8E8]">
              No orders recorded yet.
            </p>
          ) : (
            <div className="space-y-3">
              {analytics.paymentMethodUsage.map((m) => (
                <div key={m.method} className="flex justify-between text-xs border-b border-[#E8E8E8] pb-2">
                  <span className="font-semibold text-[#111111]">{m.label}</span>
                  <span className="font-mono-num">
                    {m.count} orders · {formatNaira(m.revenue)} confirmed
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (section === 'store_settings') {
    const handleHeroImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setUploadingHero(true);
      try {
        const form = new FormData();
        form.append('image', file);
        const res = await apiFetch<{ url: string }>('/api/admin/upload', {
          method: 'POST',
          body: form,
        });
        setStoreDraft((prev) => ({ ...prev, heroImage: res.url }));
        pushToast('Hero image uploaded', 'success');
      } catch (err) {
        pushToast(err instanceof Error ? err.message : 'Upload failed', 'error');
      } finally {
        setUploadingHero(false);
      }
    };

    const handleSaveStore = async (e: React.FormEvent) => {
      e.preventDefault();
      setSavingStore(true);
      try {
        await apiFetch('/api/admin/store-settings', {
          method: 'PUT',
          body: JSON.stringify(storeDraft),
        });
        await Promise.all([onRefresh(), onRefreshPublicStore()]);
        pushToast('Diamond Market settings updated', 'success');
      } finally {
        setSavingStore(false);
      }
    };

    const handleConnectWoo = async (e: React.FormEvent) => {
      e.preventDefault();
      setConnectingWc(true);
      try {
        const res = await apiFetch<{ connection: ConnectionStatus }>('/api/admin/woocommerce-connect', {
          method: 'POST',
          body: JSON.stringify({
            woocommerceUrl: wcUrl,
            consumerKey: wcKey,
            consumerSecret: wcSecret,
            bridgeSecret: wpBridgeSecret,
          }),
        });
        pushToast(res.connection.message, res.connection.connected ? 'success' : 'info');
        await Promise.all([onRefresh(), onRefreshPublicStore()]);
      } catch (err) {
        pushToast(err instanceof Error ? err.message : 'Connection failed', 'error');
      } finally {
        setConnectingWc(false);
      }
    };

    return (
      <div className="space-y-6">
        <div className="bg-[#111111] text-white rounded-2xl p-6 space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[#C6A15B] flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5" /> WordPress &amp; WooCommerce Backend Bridge
            </p>
            <h2 className="font-display text-lg font-bold mt-1">
              {connection.connected ? 'Connected to Live WooCommerce' : 'Development Sandbox Mode'}
            </h2>
            <p className="text-xs text-neutral-300 mt-1">{connection.message}</p>
          </div>

          <form onSubmit={handleConnectWoo} className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-2">
            <div>
              <label className="block font-semibold text-neutral-300 mb-1">WordPress Site URL</label>
              <input
                type="url"
                value={wcUrl}
                onChange={(e) => setWcUrl(e.target.value)}
                placeholder="https://diamondmarket.ng"
                className="w-full bg-[#1E1E1E] border border-white/15 rounded-xl px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block font-semibold text-neutral-300 mb-1">WP Bridge Secret</label>
              <input
                type="password"
                value={wpBridgeSecret}
                onChange={(e) => setWpBridgeSecret(e.target.value)}
                placeholder="Shared secret from diamond-market-commerce-bridge plugin"
                className="w-full bg-[#1E1E1E] border border-white/15 rounded-xl px-3 py-2 text-white font-mono-num"
              />
            </div>
            <div>
              <label className="block font-semibold text-neutral-300 mb-1">WooCommerce Consumer Key</label>
              <input
                type="text"
                value={wcKey}
                onChange={(e) => setWcKey(e.target.value)}
                placeholder="ck_..."
                className="w-full bg-[#1E1E1E] border border-white/15 rounded-xl px-3 py-2 text-white font-mono-num"
              />
            </div>
            <div>
              <label className="block font-semibold text-neutral-300 mb-1">WooCommerce Consumer Secret</label>
              <input
                type="password"
                value={wcSecret}
                onChange={(e) => setWcSecret(e.target.value)}
                placeholder="cs_..."
                className="w-full bg-[#1E1E1E] border border-white/15 rounded-xl px-3 py-2 text-white font-mono-num"
              />
            </div>
            <div className="sm:col-span-2 flex justify-end">
              <button
                type="submit"
                disabled={connectingWc}
                className="px-5 py-2.5 bg-[#C6A15B] text-[#111111] font-bold uppercase tracking-wider rounded-full hover:bg-white cursor-pointer"
              >
                {connectingWc ? 'Testing Connection...' : 'Save & Test WooCommerce Connection'}
              </button>
            </div>
          </form>
        </div>

        {/* Complete Storefront Identity, Hero & Policies Editor */}
        <form onSubmit={handleSaveStore} className="bg-white border border-[#E8E8E8] rounded-2xl p-6 space-y-6 text-xs">
          <div>
            <h2 className="font-display text-lg font-bold text-[#111111]">
              Diamond Market Identity, Hero &amp; Store Policies
            </h2>
            <p className="text-[#333333]/75 mt-0.5">
              Customize homepage copy, hero visual, announcement bar, contact details, business hours, and default store policies.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold mb-1">Store Name</label>
              <input
                type="text"
                value={storeDraft.storeName}
                onChange={(e) => setStoreDraft({ ...storeDraft, storeName: e.target.value })}
                className="w-full border border-[#E8E8E8] rounded-xl px-3 py-2"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Store Email</label>
              <input
                type="email"
                value={storeDraft.storeEmail}
                onChange={(e) => setStoreDraft({ ...storeDraft, storeEmail: e.target.value })}
                className="w-full border border-[#E8E8E8] rounded-xl px-3 py-2"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Phone Number</label>
              <input
                type="text"
                value={storeDraft.phone}
                onChange={(e) => setStoreDraft({ ...storeDraft, phone: e.target.value })}
                className="w-full border border-[#E8E8E8] rounded-xl px-3 py-2 font-mono-num"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">WhatsApp Number</label>
              <input
                type="text"
                value={storeDraft.whatsapp}
                onChange={(e) => setStoreDraft({ ...storeDraft, whatsapp: e.target.value })}
                className="w-full border border-[#E8E8E8] rounded-xl px-3 py-2 font-mono-num"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Store Location / City &amp; State</label>
              <input
                type="text"
                value={storeDraft.address}
                onChange={(e) => setStoreDraft({ ...storeDraft, address: e.target.value })}
                className="w-full border border-[#E8E8E8] rounded-xl px-3 py-2"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Business Hours (Optional)</label>
              <input
                type="text"
                value={storeDraft.businessHours || ''}
                onChange={(e) => setStoreDraft({ ...storeDraft, businessHours: e.target.value })}
                placeholder="Leave blank if not set (e.g. Mon–Sat: 9am–6pm)"
                className="w-full border border-[#E8E8E8] rounded-xl px-3 py-2"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-[#E8E8E8] space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-bold text-[#111111]">
                Announcement Bar &amp; Hero Section
              </h3>
              <label className="flex items-center gap-2 cursor-pointer font-semibold">
                <input
                  type="checkbox"
                  checked={storeDraft.announcementEnabled}
                  onChange={(e) =>
                    setStoreDraft({ ...storeDraft, announcementEnabled: e.target.checked })
                  }
                />
                <span>Show Announcement Bar</span>
              </label>
            </div>
            <div>
              <label className="block font-semibold mb-1">Announcement Bar Text</label>
              <input
                type="text"
                value={storeDraft.announcementBar}
                onChange={(e) => setStoreDraft({ ...storeDraft, announcementBar: e.target.value })}
                className="w-full border border-[#E8E8E8] rounded-xl px-3 py-2"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold mb-1">Hero Eyebrow</label>
                <input
                  type="text"
                  value={storeDraft.heroEyebrow}
                  onChange={(e) => setStoreDraft({ ...storeDraft, heroEyebrow: e.target.value })}
                  className="w-full border border-[#E8E8E8] rounded-xl px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Hero Headline</label>
                <input
                  type="text"
                  value={storeDraft.heroTitle}
                  onChange={(e) => setStoreDraft({ ...storeDraft, heroTitle: e.target.value })}
                  className="w-full border border-[#E8E8E8] rounded-xl px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Primary CTA Button Label</label>
                <input
                  type="text"
                  value={storeDraft.heroCtaLabel}
                  onChange={(e) => setStoreDraft({ ...storeDraft, heroCtaLabel: e.target.value })}
                  className="w-full border border-[#E8E8E8] rounded-xl px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Secondary CTA Button Label</label>
                <input
                  type="text"
                  value={storeDraft.heroSecondaryCtaLabel || ''}
                  onChange={(e) =>
                    setStoreDraft({ ...storeDraft, heroSecondaryCtaLabel: e.target.value })
                  }
                  className="w-full border border-[#E8E8E8] rounded-xl px-3 py-2"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold mb-1">Hero Subtitle</label>
              <textarea
                rows={2}
                value={storeDraft.heroSubtitle}
                onChange={(e) => setStoreDraft({ ...storeDraft, heroSubtitle: e.target.value })}
                className="w-full border border-[#E8E8E8] rounded-xl px-3 py-2"
              />
            </div>

            <div className="flex flex-wrap items-center gap-4">
              {storeDraft.heroImage && (
                <img
                  src={storeDraft.heroImage}
                  alt="Hero preview"
                  className="w-36 h-20 rounded-xl object-cover border border-[#E8E8E8]"
                />
              )}
              <label className="inline-flex items-center gap-2 px-4 py-2 border border-[#E8E8E8] rounded-full font-semibold cursor-pointer hover:border-[#111111]">
                <Upload className="w-3.5 h-3.5" />
                <span>{uploadingHero ? 'Uploading Hero...' : 'Upload Custom Hero Image'}</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleHeroImageUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          <div className="pt-4 border-t border-[#E8E8E8] space-y-3">
            <h3 className="font-display text-base font-bold text-[#111111]">
              Promo Banner, About &amp; Default Store Return Policy
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold mb-1">Promo Banner Title</label>
                <input
                  type="text"
                  value={storeDraft.promoBannerTitle}
                  onChange={(e) =>
                    setStoreDraft({ ...storeDraft, promoBannerTitle: e.target.value })
                  }
                  className="w-full border border-[#E8E8E8] rounded-xl px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Footer Tagline</label>
                <input
                  type="text"
                  value={storeDraft.footerTagline || ''}
                  onChange={(e) => setStoreDraft({ ...storeDraft, footerTagline: e.target.value })}
                  className="w-full border border-[#E8E8E8] rounded-xl px-3 py-2"
                />
              </div>
            </div>
            <div>
              <label className="block font-semibold mb-1">About Us Story (Contact Page)</label>
              <textarea
                rows={2}
                value={storeDraft.aboutUsText || ''}
                onChange={(e) => setStoreDraft({ ...storeDraft, aboutUsText: e.target.value })}
                className="w-full border border-[#E8E8E8] rounded-xl px-3 py-2"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold mb-1">Store Default Return Policy</label>
                <textarea
                  rows={3}
                  value={storeDraft.returnPolicyText}
                  onChange={(e) =>
                    setStoreDraft({ ...storeDraft, returnPolicyText: e.target.value })
                  }
                  className="w-full border border-[#E8E8E8] rounded-xl px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Shipping Policy</label>
                <textarea
                  rows={3}
                  value={storeDraft.shippingPolicyText}
                  onChange={(e) =>
                    setStoreDraft({ ...storeDraft, shippingPolicyText: e.target.value })
                  }
                  className="w-full border border-[#E8E8E8] rounded-xl px-3 py-2"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={savingStore}
              className="px-6 py-2.5 bg-[#111111] text-white text-xs font-bold uppercase tracking-wider rounded-full hover:bg-[#C6A15B] hover:text-[#111111] cursor-pointer"
            >
              {savingStore ? 'Saving Settings...' : 'Save Store Settings'}
            </button>
          </div>
        </form>
      </div>
    );
  }

  if (section === 'notifications') {
    const markAllRead = async () => {
      await apiFetch('/api/admin/notifications/read', { method: 'POST', body: JSON.stringify({}) });
      await onRefresh();
    };
    return (
      <div className="bg-white border border-[#E8E8E8] rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-[#111111]">
            Store Notifications ({notifications.length})
          </h2>
          {notifications.some((n) => !n.read) && (
            <button
              type="button"
              onClick={markAllRead}
              className="text-xs font-semibold text-[#111111] underline cursor-pointer"
            >
              Mark all as read
            </button>
          )}
        </div>
        {notifications.length === 0 ? (
          <p className="text-sm text-[#333333]/75 bg-[#FAF8F3] rounded-xl p-8 text-center border border-[#E8E8E8]">
            No store notifications yet. Alerts trigger on new orders, bank transfer proofs, COD orders, and low stock.
          </p>
        ) : (
          <div className="divide-y divide-[#E8E8E8]">
            {notifications.map((n) => (
              <div key={n.id} className="py-3.5 flex items-start justify-between gap-4 text-xs">
                <div>
                  <p className={`font-semibold ${n.read ? 'text-[#333333]/70' : 'text-[#111111]'}`}>
                    {n.title}
                  </p>
                  <p className="text-[#333333]/75 mt-0.5">{n.message}</p>
                </div>
                <span className="text-[#333333]/70 shrink-0">{formatDateTime(n.createdAt)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border border-[#E8E8E8] rounded-2xl p-6 space-y-3">
        <div className="flex items-center gap-2 text-[#111111]">
          <ShieldCheck className="w-5 h-5 text-[#C6A15B]" />
          <h2 className="font-display text-lg font-bold">Server-Side Security &amp; Access Control</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs pt-2">
          <div className="p-4 bg-[#FAF8F3] border border-[#E8E8E8] rounded-xl space-y-1">
            <p className="font-bold text-[#111111] flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" /> Firebase ID Token Verification
            </p>
            <p className="text-[#333333]/75">Every /api/admin/* request verifies JWT signatures server-side.</p>
          </div>
          <div className="p-4 bg-[#FAF8F3] border border-[#E8E8E8] rounded-xl space-y-1">
            <p className="font-bold text-[#111111] flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-emerald-700" /> Secret Key Isolation
            </p>
            <p className="text-[#333333]/75">Paystack, Flutterwave, and WooCommerce secrets never leave the server.</p>
          </div>
          <div className="p-4 bg-[#FAF8F3] border border-[#E8E8E8] rounded-xl space-y-1">
            <p className="font-bold text-[#111111]">Strict Admin Allowlist</p>
            <p className="text-[#333333]/75">Only verified administrator emails can access /admin operations.</p>
          </div>
        </div>
      </div>

      <div className="bg-white border border-[#E8E8E8] rounded-2xl p-6">
        <h3 className="font-display text-base font-bold text-[#111111] mb-4">
          Administrator Audit Log ({auditLogs.length})
        </h3>
        {auditLogs.length === 0 ? (
          <p className="text-xs text-[#333333]/75">No administrative actions logged yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="border-b border-[#E8E8E8] text-[#333333]/70 uppercase">
                <tr>
                  <th className="py-2.5 pr-4">Timestamp</th>
                  <th className="py-2.5 pr-4">Administrator</th>
                  <th className="py-2.5 pr-4">Action</th>
                  <th className="py-2.5 pr-4">Resource</th>
                  <th className="py-2.5">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E8E8]">
                {auditLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="py-2.5 pr-4 font-mono-num text-[#333333]/75">
                      {formatDateTime(log.createdAt)}
                    </td>
                    <td className="py-2.5 pr-4 font-medium">{log.actorEmail}</td>
                    <td className="py-2.5 pr-4 font-mono-num font-semibold">{log.action}</td>
                    <td className="py-2.5 pr-4 font-mono-num text-[#333333]/75">{log.resource}</td>
                    <td className="py-2.5 text-[#333333]/75">{log.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
