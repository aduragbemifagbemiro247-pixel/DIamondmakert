import { AlertTriangle, BarChart3, DollarSign, Package, ShoppingCart, Users } from 'lucide-react';
import React from 'react';
import type { AdminAnalytics, Order } from '../../types/commerce.ts';
import { formatDateShort, formatNaira } from '../../utils/currency.ts';

interface Props {
  analytics: AdminAnalytics;
  recentOrders: Order[];
  onInspectOrder: (order: Order) => void;
}

export function AdminOverviewSection({ analytics, recentOrders, onInspectOrder }: Props) {
  const maxRevenue = Math.max(1, ...analytics.revenueSeries.map((d) => d.revenue));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="dm-admin-card bg-white border border-[#E8E8E8] rounded-2xl p-5">
          <div className="flex items-center justify-between text-xs text-[#333333]/75 mb-2">
            <span className="font-medium">Total Verified Revenue</span>
            <DollarSign className="w-4 h-4 text-[#C6A15B]" />
          </div>
          <p className="font-display text-2xl font-bold text-[#111111] font-mono-num">
            {formatNaira(analytics.totalRevenue)}
          </p>
          <p className="text-xs text-[#333333]/75 mt-2 font-mono-num">
            Today: {formatNaira(analytics.todayRevenue)} · Month: {formatNaira(analytics.monthRevenue)}
          </p>
        </div>

        <div className="dm-admin-card bg-white border border-[#E8E8E8] rounded-2xl p-5">
          <div className="flex items-center justify-between text-xs text-[#333333]/75 mb-2">
            <span className="font-medium">Orders Summary</span>
            <ShoppingCart className="w-4 h-4 text-[#C6A15B]" />
          </div>
          <p className="font-display text-2xl font-bold text-[#111111] font-mono-num">
            {analytics.totalOrders}
          </p>
          <p className="text-xs text-[#333333]/75 mt-2 font-mono-num">
            Pending {analytics.pendingOrders} · Processing {analytics.processingOrders} · Completed {analytics.completedOrders}
          </p>
        </div>

        <div className="dm-admin-card bg-white border border-[#E8E8E8] rounded-2xl p-5">
          <div className="flex items-center justify-between text-xs text-[#333333]/75 mb-2">
            <span className="font-medium">Catalog &amp; Inventory</span>
            <Package className="w-4 h-4 text-[#C6A15B]" />
          </div>
          <p className="font-display text-2xl font-bold text-[#111111] font-mono-num">
            {analytics.totalProducts} Pieces
          </p>
          <p
            className={`text-xs mt-2 font-medium flex items-center gap-1 ${
              analytics.lowStockProducts > 0 ? 'text-amber-700' : 'text-[#333333]/75'
            }`}
          >
            {analytics.lowStockProducts > 0 && <AlertTriangle className="w-3.5 h-3.5" />}
            <span>{analytics.lowStockProducts} low-stock SKU alerts</span>
          </p>
        </div>

        <div className="dm-admin-card bg-white border border-[#E8E8E8] rounded-2xl p-5">
          <div className="flex items-center justify-between text-xs text-[#333333]/75 mb-2">
            <span className="font-medium">Customer Directory</span>
            <Users className="w-4 h-4 text-[#C6A15B]" />
          </div>
          <p className="font-display text-2xl font-bold text-[#111111] font-mono-num">
            {analytics.totalCustomers}
          </p>
          <p className="text-xs text-[#333333]/75 mt-2 font-mono-num">
            Cancelled / Failed: {analytics.cancelledOrders}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 bg-white border border-[#E8E8E8] rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-display text-base font-bold text-[#111111]">
                Revenue &amp; Orders (Last 7 Days)
              </h3>
              <p className="text-xs text-[#333333]/75">
                Computed strictly from confirmed Diamond Market orders
              </p>
            </div>
            <BarChart3 className="w-4 h-4 text-[#C6A15B]" />
          </div>

          {analytics.totalOrders === 0 ? (
            <div className="h-52 bg-[#FAF8F3] rounded-xl flex flex-col items-center justify-center text-center p-6 border border-[#E8E8E8]">
              <p className="text-sm font-semibold text-[#111111]">No sales recorded yet</p>
              <p className="text-xs text-[#333333]/75 mt-1 max-w-sm">
                Real revenue and order volume bars appear here automatically as customers complete purchases.
              </p>
            </div>
          ) : (
            <div className="h-52 flex items-end gap-3 pt-4">
              {analytics.revenueSeries.map((point) => {
                const heightPct = Math.max(6, Math.round((point.revenue / maxRevenue) * 100));
                return (
                  <div key={point.date} className="flex-1 flex flex-col items-center gap-2">
                    <div className="w-full flex flex-col items-center justify-end h-36 bg-[#FAF8F3] rounded-xl p-1.5">
                      <div
                        className="w-full bg-[#111111] hover:bg-[#C6A15B] transition-all duration-300 rounded-lg"
                        style={{ height: `${heightPct}%` }}
                        title={`${point.date}: ${formatNaira(point.revenue)} (${point.orders} orders)`}
                      />
                    </div>
                    <div className="text-center">
                      <p className="text-[11px] font-mono-num text-[#333333]/75">
                        {point.date.slice(5)}
                      </p>
                      <p className="text-[10px] font-mono-num text-[#111111] font-semibold">
                        {point.orders} ord
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="lg:col-span-4 bg-white border border-[#E8E8E8] rounded-2xl p-6 space-y-5">
          <div>
            <h3 className="font-display text-base font-bold text-[#111111] mb-3">
              Payment Method Usage
            </h3>
            {analytics.paymentMethodUsage.length === 0 ? (
              <p className="text-xs text-[#333333]/75 bg-[#FAF8F3] rounded-xl p-4 border border-[#E8E8E8]">
                No checkout transactions recorded yet.
              </p>
            ) : (
              <div className="space-y-2.5">
                {analytics.paymentMethodUsage.map((pm) => (
                  <div key={pm.method} className="flex items-center justify-between text-xs border-b border-[#E8E8E8] pb-2">
                    <span className="font-medium text-[#111111]">{pm.label}</span>
                    <span className="font-mono-num text-[#333333]/75">
                      {pm.count} ord · {formatNaira(pm.revenue)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-[#E8E8E8]">
            <h3 className="font-display text-base font-bold text-[#111111] mb-3">
              Best-Selling Pieces
            </h3>
            {analytics.bestSellingProducts.length === 0 ? (
              <p className="text-xs text-[#333333]/75 bg-[#FAF8F3] rounded-xl p-4 border border-[#E8E8E8]">
                Confirmed paid sales will rank here automatically.
              </p>
            ) : (
              <div className="space-y-2.5">
                {analytics.bestSellingProducts.map((prod) => (
                  <div key={prod.id} className="flex items-center justify-between text-xs">
                    <span className="truncate pr-2 text-[#111111] font-medium">{prod.name}</span>
                    <span className="font-mono-num shrink-0 text-[#333333]/75">
                      {prod.salesCount} · {formatNaira(prod.revenue)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white border border-[#E8E8E8] rounded-2xl p-6">
        <h3 className="font-display text-base font-bold text-[#111111] mb-4">
          Recent Orders
        </h3>
        {recentOrders.length === 0 ? (
          <div className="bg-[#FAF8F3] border border-[#E8E8E8] rounded-xl p-8 text-center text-sm text-[#333333]/75">
            No orders placed yet. Orders completed by customers will appear here automatically.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="border-b border-[#E8E8E8] text-xs text-[#333333]/70 uppercase">
                <tr>
                  <th className="py-3 pr-4">Order</th>
                  <th className="py-3 pr-4">Customer</th>
                  <th className="py-3 pr-4">Date</th>
                  <th className="py-3 pr-4">Method</th>
                  <th className="py-3 pr-4">Payment</th>
                  <th className="py-3 pr-4">Order Status</th>
                  <th className="py-3 pr-4 text-right">Amount</th>
                  <th className="py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E8E8]">
                {recentOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-[#FAF8F3]/60">
                    <td className="py-3 pr-4 font-mono-num font-semibold text-[#111111]">
                      {order.orderNumber}
                    </td>
                    <td className="py-3 pr-4 text-xs">
                      <p className="font-medium text-[#111111]">
                        {order.billing.firstName} {order.billing.lastName}
                      </p>
                      <p className="text-[#333333]/75">{order.customerEmail}</p>
                    </td>
                    <td className="py-3 pr-4 text-xs text-[#333333]/75">
                      {formatDateShort(order.createdAt)}
                    </td>
                    <td className="py-3 pr-4 text-xs">{order.paymentMethodTitle}</td>
                    <td className="py-3 pr-4 text-xs capitalize">
                      {order.paymentStatus.replace(/_/g, ' ')}
                    </td>
                    <td className="py-3 pr-4 text-xs capitalize font-medium">{order.status}</td>
                    <td className="py-3 pr-4 text-right font-mono-num font-bold">
                      {formatNaira(order.total)}
                    </td>
                    <td className="py-3 text-right">
                      <button
                        type="button"
                        onClick={() => onInspectOrder(order)}
                        className="text-xs font-semibold text-[#111111] underline hover:text-[#8C6D34] cursor-pointer"
                      >
                        Manage
                      </button>
                    </td>
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
