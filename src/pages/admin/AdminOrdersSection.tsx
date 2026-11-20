import { CheckCircle2, Download, Printer, Search, X } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { BrandLogo } from '../../components/BrandLogo.tsx';
import { apiFetch } from '../../lib/api.ts';
import type { CustomerRecord, DeliveryStatus, Order, OrderStatus } from '../../types/commerce.ts';
import { formatDateShort, formatDateTime, formatNaira } from '../../utils/currency.ts';
import { DELIVERY_STATUS_LABELS } from '../../utils/deliveryStatus.ts';

interface Props {
  mode: 'orders' | 'customers' | 'payments';
  orders: Order[];
  customers: CustomerRecord[];
  selectedOrder: Order | null;
  setSelectedOrder: (o: Order | null) => void;
  onRefresh: () => Promise<void>;
  pushToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export function AdminOrdersSection({
  mode,
  orders,
  customers,
  selectedOrder,
  setSelectedOrder,
  onRefresh,
  pushToast,
}: Props) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const [nextStatus, setNextStatus] = useState<OrderStatus>('processing');
  const [courier, setCourier] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [deliveryStatus, setDeliveryStatus] = useState<DeliveryStatus>('pending_delivery');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [adminNote, setAdminNote] = useState('');
  const [saving, setSaving] = useState(false);

  const openOrder = (order: Order) => {
    setSelectedOrder(order);
    setNextStatus(order.status);
    setCourier(order.delivery.courier || '');
    setTrackingNumber(order.delivery.trackingNumber || '');
    setDeliveryStatus(order.delivery.status || 'pending_delivery');
    setDeliveryNotes(order.delivery.notes || '');
    setAdminNote('');
  };

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (mode === 'payments' && o.paymentStatus === 'paid') return false;
      if (statusFilter !== 'all' && o.status !== statusFilter) return false;
      if (search.trim()) {
        const needle = search.trim().toLowerCase();
        return (
          o.orderNumber.toLowerCase().includes(needle) ||
          o.customerEmail.toLowerCase().includes(needle) ||
          `${o.billing.firstName} ${o.billing.lastName}`.toLowerCase().includes(needle) ||
          o.paymentReference.toLowerCase().includes(needle)
        );
      }
      return true;
    });
  }, [orders, mode, statusFilter, search]);

  const handleSaveOrderChanges = async () => {
    if (!selectedOrder) return;
    setSaving(true);
    try {
      const res = await apiFetch<{ order: Order }>(`/api/admin/orders/${selectedOrder.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          status: nextStatus,
          delivery: {
            courier,
            trackingNumber,
            status: deliveryStatus,
            notes: deliveryNotes,
          },
          note: adminNote,
          isCustomerVisible: true,
        }),
      });
      setSelectedOrder(res.order);
      setAdminNote('');
      pushToast(`Order ${res.order.orderNumber} updated`, 'success');
      await onRefresh();
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Update failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmManualPayment = async (order: Order) => {
    if (
      !window.confirm(
        `Confirm you have received ${formatNaira(order.total)} for ${order.orderNumber} (${
          order.paymentMethodTitle
        })?`
      )
    ) {
      return;
    }
    try {
      const res = await apiFetch<{ order: Order }>(
        `/api/admin/orders/${order.id}/confirm-payment`,
        {
          method: 'POST',
          body: JSON.stringify({
            note: `Payment manually verified by Diamond Market admin for ${order.paymentMethodTitle}.`,
          }),
        }
      );
      setSelectedOrder(res.order);
      pushToast(`Payment confirmed for ${res.order.orderNumber}`, 'success');
      await onRefresh();
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Payment confirmation failed', 'error');
    }
  };

  const exportCsv = () => {
    const headers = ['Order Number', 'Date', 'Customer', 'Email', 'State', 'Payment Method', 'Payment Status', 'Order Status', 'Total NGN'];
    const rows = filteredOrders.map((o) => [
      o.orderNumber,
      o.createdAt,
      `${o.billing.firstName} ${o.billing.lastName}`,
      o.customerEmail,
      o.billing.state,
      o.paymentMethodTitle,
      o.paymentStatus,
      o.status,
      String(o.total),
    ]);
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `diamond-market-orders-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (mode === 'customers') {
    return (
      <div className="bg-white border border-[#E8E8E8] rounded-2xl p-6">
        <h2 className="font-display text-lg font-bold text-[#111111] mb-4">
          Customers ({customers.length})
        </h2>
        {customers.length === 0 ? (
          <p className="text-sm text-[#333333]/75 bg-[#FAF8F3] rounded-xl p-8 text-center">
            No customers registered or checked out yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="border-b border-[#E8E8E8] text-xs text-[#333333]/70 uppercase">
                <tr>
                  <th className="py-3 pr-4">Name</th>
                  <th className="py-3 pr-4">Email</th>
                  <th className="py-3 pr-4">Phone</th>
                  <th className="py-3 pr-4">Location</th>
                  <th className="py-3 pr-4 text-right">Orders</th>
                  <th className="py-3 text-right">Total Spent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E8E8]">
                {customers.map((c) => (
                  <tr key={c.id}>
                    <td className="py-3 pr-4 font-semibold text-[#111111]">
                      {c.firstName} {c.lastName}
                    </td>
                    <td className="py-3 pr-4 text-xs text-[#333333]/75">{c.email}</td>
                    <td className="py-3 pr-4 font-mono-num text-xs">{c.phone || '—'}</td>
                    <td className="py-3 pr-4 text-xs text-[#333333]/75">
                      {c.city ? `${c.city}, ${c.state}` : '—'}
                    </td>
                    <td className="py-3 pr-4 text-right font-mono-num">{c.ordersCount}</td>
                    <td className="py-3 text-right font-mono-num font-bold">
                      {formatNaira(c.totalSpent)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border border-[#E8E8E8] rounded-2xl p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-bold text-[#111111]">
              {mode === 'payments'
                ? 'Payments Awaiting Confirmation (Bank Transfer & COD)'
                : `Orders Management (${filteredOrders.length})`}
            </h2>
            <p className="text-xs text-[#333333]/75">
              {mode === 'payments'
                ? 'Manually verify bank transfer receipts and COD settlements before marking orders paid.'
                : 'Search, update status, assign courier tracking, and print Diamond Market invoices.'}
            </p>
          </div>
          <button
            type="button"
            onClick={exportCsv}
            className="px-4 py-2 border border-[#E8E8E8] rounded-full text-xs font-semibold text-[#111111] hover:border-[#111111] flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search order #, email, customer, or reference..."
              className="w-full border border-[#E8E8E8] rounded-full pl-9 pr-3 py-2 text-xs focus:outline-none focus:border-[#111111]"
            />
            <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-[#E8E8E8] rounded-full px-4 py-2 text-xs bg-white"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending payment</option>
            <option value="on-hold">On hold</option>
            <option value="processing">Processing</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="failed">Failed</option>
            <option value="refunded">Refunded</option>
          </select>
        </div>

        {filteredOrders.length === 0 ? (
          <div className="bg-[#FAF8F3] rounded-xl p-8 text-center text-sm text-[#333333]/75">
            No matching orders found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="border-b border-[#E8E8E8] text-xs text-[#333333]/70 uppercase">
                <tr>
                  <th className="py-3 pr-4">Order</th>
                  <th className="py-3 pr-4">Customer</th>
                  <th className="py-3 pr-4">Date</th>
                  <th className="py-3 pr-4">Gateway</th>
                  <th className="py-3 pr-4">Payment Status</th>
                  <th className="py-3 pr-4">Order Status</th>
                  <th className="py-3 pr-4 text-right">Total</th>
                  <th className="py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E8E8]">
                {filteredOrders.map((o) => (
                  <tr key={o.id} className="hover:bg-[#FAF8F3]/60">
                    <td className="py-3 pr-4 font-mono-num font-semibold text-[#111111]">
                      {o.orderNumber}
                    </td>
                    <td className="py-3 pr-4 text-xs">
                      <p className="font-medium text-[#111111]">
                        {o.billing.firstName} {o.billing.lastName}
                      </p>
                      <p className="text-[#333333]/75">{o.billing.state}</p>
                    </td>
                    <td className="py-3 pr-4 text-xs text-[#333333]/75">
                      {formatDateShort(o.createdAt)}
                    </td>
                    <td className="py-3 pr-4 text-xs">{o.paymentMethodTitle}</td>
                    <td className="py-3 pr-4 text-xs capitalize">
                      <span
                        className={
                          o.paymentStatus === 'paid'
                            ? 'text-emerald-700 font-semibold'
                            : o.paymentStatus === 'failed'
                            ? 'text-rose-700 font-semibold'
                            : 'text-amber-700 font-semibold'
                        }
                      >
                        {o.paymentStatus.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-xs capitalize font-medium">{o.status}</td>
                    <td className="py-3 pr-4 text-right font-mono-num font-bold">
                      {formatNaira(o.total)}
                    </td>
                    <td className="py-3 text-right">
                      <button
                        type="button"
                        onClick={() => openOrder(o)}
                        className="text-xs font-semibold text-[#111111] underline hover:text-[#8C6D34] cursor-pointer"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-y-auto border border-[#E8E8E8] shadow-2xl">
            <div className="px-6 py-4 bg-[#111111] text-white flex items-center justify-between sticky top-0 z-10">
              <div>
                <p className="font-display text-base font-bold font-mono-num">
                  {selectedOrder.orderNumber}
                </p>
                <p className="text-xs text-neutral-400">
                  {formatDateTime(selectedOrder.createdAt)} · Ref: {selectedOrder.paymentReference}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="no-print px-3 py-1.5 bg-[#292929] text-white text-xs rounded-full flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Invoice</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedOrder(null)}
                  className="no-print p-1.5 text-neutral-400 hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6 text-sm">
              <div className="flex items-center justify-between pb-4 border-b border-[#E8E8E8]">
                <BrandLogo variant="light" compact />
                <span className="text-xs text-[#333333]/75">Ogbomoso, Oyo State · 07051959290</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-[#FAF8F3] border border-[#E8E8E8] rounded-2xl text-xs space-y-1">
                  <p className="font-bold text-[#111111] uppercase tracking-wider mb-1">
                    Customer &amp; Delivery
                  </p>
                  <p className="font-semibold text-[#111111]">
                    {selectedOrder.billing.firstName} {selectedOrder.billing.lastName}
                  </p>
                  <p>{selectedOrder.customerEmail}</p>
                  <p className="font-mono-num">{selectedOrder.billing.phone}</p>
                  <p className="pt-1 text-[#333333]/80">
                    {selectedOrder.billing.street}, {selectedOrder.billing.city},{' '}
                    {selectedOrder.billing.state}
                  </p>
                </div>

                <div className="p-4 bg-[#FAF8F3] border border-[#E8E8E8] rounded-2xl text-xs space-y-2">
                  <p className="font-bold text-[#111111] uppercase tracking-wider">
                    Payment Verification
                  </p>
                  <p>
                    Method: <strong>{selectedOrder.paymentMethodTitle}</strong>
                  </p>
                  <p>
                    Status:{' '}
                    <strong className="capitalize">
                      {selectedOrder.paymentStatus.replace(/_/g, ' ')}
                    </strong>
                  </p>
                  <p>
                    Total: <strong className="font-mono-num">{formatNaira(selectedOrder.total)}</strong>
                  </p>

                  {selectedOrder.transferReceiptUrl && (
                    <a
                      href={selectedOrder.transferReceiptUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-block underline font-semibold text-[#111111]"
                    >
                      View Uploaded Transfer Proof ↗
                    </a>
                  )}

                  {selectedOrder.paymentStatus !== 'paid' && (
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => handleConfirmManualPayment(selectedOrder)}
                        className="px-4 py-2 bg-[#C6A15B] text-[#111111] font-bold rounded-full hover:bg-[#b58f48] cursor-pointer inline-flex items-center gap-1.5"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Verify &amp; Confirm Payment</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-[#111111] mb-2">
                  Line Items
                </p>
                <div className="border border-[#E8E8E8] rounded-2xl divide-y divide-[#E8E8E8]">
                  {selectedOrder.items.map((item, idx) => (
                    <div key={idx} className="p-3 flex justify-between text-xs">
                      <span>
                        <strong>{item.name}</strong> ({item.sku}) × {item.quantity}
                      </span>
                      <span className="font-mono-num font-bold">{formatNaira(item.total)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="no-print border-t border-[#E8E8E8] pt-5 space-y-4">
                <p className="text-xs font-bold uppercase tracking-wider text-[#111111]">
                  Fulfillment &amp; Order Status Controls
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block font-semibold mb-1">Order Status</label>
                    <select
                      value={nextStatus}
                      onChange={(e) => setNextStatus(e.target.value as OrderStatus)}
                      className="w-full border border-[#E8E8E8] rounded-xl px-3 py-2 bg-white"
                    >
                      <option value="pending">Pending payment</option>
                      <option value="on-hold">On hold</option>
                      <option value="processing">Processing</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled (Restores stock)</option>
                      <option value="failed">Failed</option>
                      <option value="refunded">Refunded (Restores stock)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Delivery Stage</label>
                    <select
                      value={deliveryStatus}
                      onChange={(e) => setDeliveryStatus(e.target.value as DeliveryStatus)}
                      className="w-full border border-[#E8E8E8] rounded-xl px-3 py-2 bg-white"
                    >
                      {Object.entries(DELIVERY_STATUS_LABELS).map(([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Courier / Logistics Partner</label>
                    <input
                      type="text"
                      value={courier}
                      onChange={(e) => setCourier(e.target.value)}
                      placeholder="Diamond Courier / GIG Logistics / DHL"
                      className="w-full border border-[#E8E8E8] rounded-xl px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Tracking Number</label>
                    <input
                      type="text"
                      value={trackingNumber}
                      onChange={(e) => setTrackingNumber(e.target.value)}
                      placeholder="DM-9482019"
                      className="w-full border border-[#E8E8E8] rounded-xl px-3 py-2 font-mono-num"
                    />
                  </div>
                </div>
                <div className="text-xs">
                  <label className="block font-semibold mb-1">Customer-Visible Order Note</label>
                  <input
                    type="text"
                    value={adminNote}
                    onChange={(e) => setAdminNote(e.target.value)}
                    placeholder="Optional update message..."
                    className="w-full border border-[#E8E8E8] rounded-xl px-3 py-2"
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={handleSaveOrderChanges}
                    className="px-5 py-2.5 bg-[#111111] text-white text-xs font-bold uppercase tracking-wider rounded-full hover:bg-[#C6A15B] hover:text-[#111111] cursor-pointer"
                  >
                    {saving ? 'Saving...' : 'Save Order & Delivery Update'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
