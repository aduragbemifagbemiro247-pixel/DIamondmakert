import {
  BarChart3,
  Bell,
  Bike,
  Boxes,
  CreditCard,
  FolderTree,
  Globe,
  LayoutDashboard,
  Lock,
  LogOut,
  Menu,
  MessageSquare,
  MessageSquareWarning,
  Package,
  Settings,
  Shield,
  ShoppingCart,
  Sliders,
  Tag,
  Truck,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { BrandLogo } from '../components/BrandLogo.tsx';
import { useStore } from '../context/StoreContext.tsx';
import { apiFetch } from '../lib/api.ts';
import type {
  AdminAnalytics,
  AuditLogEntry,
  Category,
  CmsAdminState,
  ConnectionStatus,
  Coupon,
  CustomerRecord,
  DeliveryAnalytics,
  DeliveryComplaint,
  DeliveryRecord,
  DeliverySettings,
  EmailLogEntry,
  Order,
  PaymentGatewaysSettings,
  Product,
  ProductReview,
  Rider,
  RiderReview,
  ShippingZone,
  StoreNotification,
  StoreSettings,
} from '../types/commerce.ts';
import { AdminCatalogSection } from './admin/AdminCatalogSection.tsx';
import { AdminComplaintsSection } from './admin/AdminComplaintsSection.tsx';
import { AdminDeliveriesSection } from './admin/AdminDeliveriesSection.tsx';
import { AdminOrdersSection } from './admin/AdminOrdersSection.tsx';
import { AdminOverviewSection } from './admin/AdminOverviewSection.tsx';
import { AdminRidersSection } from './admin/AdminRidersSection.tsx';
import { AdminSettingsSection } from './admin/AdminSettingsSection.tsx';
import { AdminWebsiteEditorSection } from './admin/AdminWebsiteEditorSection.tsx';

type AdminMenuId =
  | 'dashboard'
  | 'website_editor'
  | 'products'
  | 'categories'
  | 'inventory'
  | 'orders'
  | 'deliveries'
  | 'riders'
  | 'complaints'
  | 'customers'
  | 'payments'
  | 'coupons'
  | 'reviews'
  | 'reports'
  | 'store_settings'
  | 'delivery_settings'
  | 'payment_settings'
  | 'shipping_settings'
  | 'notifications'
  | 'security';

interface AdminOverviewResponse {
  connection: ConnectionStatus;
  analytics: AdminAnalytics;
  recentOrders: Order[];
  products: Product[];
  categories: Category[];
  orders: Order[];
  customers: CustomerRecord[];
  coupons: Coupon[];
  reviews: ProductReview[];
  riderReviews: RiderReview[];
  deliveries: DeliveryRecord[];
  riders: Rider[];
  complaints: DeliveryComplaint[];
  deliverySettings: DeliverySettings;
  deliveryAnalytics: DeliveryAnalytics;
  emailLogs: EmailLogEntry[];
  shippingZones: ShippingZone[];
  paymentGateways: PaymentGatewaysSettings;
  storeSettings: StoreSettings;
  notifications: StoreNotification[];
  auditLogs: AuditLogEntry[];
  cmsState: CmsAdminState;
}

export function AdminDashboardPage() {
  const { user, authReady, isAdmin, logout, navigate, refreshStore, pushToast } = useStore();
  const [activeMenu, setActiveMenu] = useState<AdminMenuId>('dashboard');
  const [data, setData] = useState<AdminOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const loadAdminData = useCallback(async () => {
    try {
      const res = await apiFetch<AdminOverviewResponse>('/api/admin/overview');
      setData(res);
      setAccessDenied(null);
    } catch (err) {
      setAccessDenied(err instanceof Error ? err.message : 'Administrator access denied.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authReady) return;
    if (!user) {
      setLoading(false);
      setAccessDenied('Please sign in with an authorized administrator account.');
      return;
    }
    loadAdminData();
  }, [authReady, user, loadAdminData]);

  if (loading || !authReady) {
    return (
      <div className="min-h-screen bg-[#111111] text-white flex flex-col lg:flex-row">
        <div className="hidden lg:block w-64 shrink-0 border-r border-white/10 p-5 space-y-4">
          <div className="dm-skeleton h-8 w-40 rounded-xl" />
          <div className="space-y-2 pt-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="dm-skeleton h-9 w-full rounded-xl" />
            ))}
          </div>
        </div>
        <div className="flex-1 p-6 lg:p-10 space-y-6 max-w-6xl w-full mx-auto">
          <div className="dm-skeleton h-8 w-64 rounded-xl" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="dm-skeleton h-28 rounded-2xl border border-white/10" />
            ))}
          </div>
          <div className="dm-skeleton h-64 rounded-2xl border border-white/10" />
          <p className="text-xs text-neutral-400">Verifying Diamond Market administrator privileges...</p>
        </div>
      </div>
    );
  }

  if (accessDenied || !isAdmin || !data) {
    return (
      <div className="min-h-screen bg-[#FAF8F3] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-[#E8E8E8] rounded-3xl p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-[#111111] text-[#C6A15B] flex items-center justify-center mx-auto">
            <Lock className="w-5 h-5" />
          </div>
          <h1 className="font-display text-xl font-bold text-[#111111]">
            Diamond Market Admin Portal
          </h1>
          <p className="text-sm text-[#333333]/80">
            {accessDenied || 'You do not have verified administrator privileges to access /admin.'}
          </p>
          <div className="flex gap-3 justify-center pt-2">
            {!user && (
              <button
                type="button"
                onClick={() => navigate('/auth')}
                className="px-5 py-2.5 bg-[#111111] text-white text-xs font-bold uppercase tracking-wider rounded-full cursor-pointer"
              >
                Administrator Sign In
              </button>
            )}
            <button
              type="button"
              onClick={() => navigate('/')}
              className="px-5 py-2.5 border border-[#E8E8E8] text-[#111111] text-xs font-semibold rounded-full cursor-pointer"
            >
              Back to Storefront
            </button>
          </div>
        </div>
      </div>
    );
  }

  const unreadCount = data.notifications.filter((n) => !n.read).length;
  const openComplaintsCount = (data.complaints || []).filter((c) =>
    ['open', 'under_investigation', 'awaiting_customer'].includes(c.status)
  ).length;

  const menuItems: { id: AdminMenuId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'website_editor', label: 'Website Editor', icon: Globe },
    { id: 'products', label: 'Products', icon: Package },
    { id: 'categories', label: 'Categories', icon: FolderTree },
    { id: 'inventory', label: 'Inventory', icon: Boxes },
    { id: 'orders', label: 'Orders', icon: ShoppingCart },
    { id: 'deliveries', label: 'Deliveries', icon: Truck },
    { id: 'riders', label: 'Riders', icon: Bike },
    { id: 'complaints', label: 'Delivery Issues', icon: MessageSquareWarning },
    { id: 'customers', label: 'Customers', icon: Users },
    { id: 'payments', label: 'Payments', icon: Wallet },
    { id: 'coupons', label: 'Coupons', icon: Tag },
    { id: 'reviews', label: 'Reviews & Testimonials', icon: MessageSquare },
    { id: 'reports', label: 'Reports & Analytics', icon: BarChart3 },
    { id: 'store_settings', label: 'Store Settings', icon: Settings },
    { id: 'delivery_settings', label: 'Delivery & OTP Rules', icon: Sliders },
    { id: 'payment_settings', label: 'Payment Settings', icon: CreditCard },
    { id: 'shipping_settings', label: 'Shipping Zones', icon: Truck },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'security', label: 'Security', icon: Shield },
  ];

  const activeLabel = menuItems.find((m) => m.id === activeMenu)?.label || 'Dashboard';

  return (
    <div className="min-h-screen bg-[#FAF8F3] flex flex-col lg:flex-row">
      <aside
        className={`no-print bg-[#111111] text-neutral-300 w-full lg:w-64 shrink-0 border-r border-white/10 ${
          mobileNavOpen ? 'block' : 'hidden lg:flex lg:flex-col'
        }`}
      >
        <div className="px-5 h-16 flex items-center justify-between border-b border-white/10">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="cursor-pointer focus:outline-none"
          >
            <BrandLogo variant="dark" compact showSubtext={false} />
          </button>
          <button
            type="button"
            onClick={() => setMobileNavOpen(false)}
            className="lg:hidden text-neutral-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const active = activeMenu === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveMenu(item.id);
                  setMobileNavOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all duration-200 cursor-pointer ${
                  active
                    ? 'bg-[#C6A15B] text-[#111111] font-bold shadow-sm translate-x-0.5'
                    : 'text-neutral-300 hover:bg-[#1E1E1E] hover:text-white hover:translate-x-0.5'
                }`}
              >
                <span className="flex items-center gap-3 truncate">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </span>
                {item.id === 'notifications' && unreadCount > 0 && (
                  <span className="font-mono-num text-[10px] font-bold bg-[#111111] text-[#C6A15B] px-1.5 py-0.5 rounded transition-transform duration-200">
                    {unreadCount}
                  </span>
                )}
                {item.id === 'complaints' && openComplaintsCount > 0 && (
                  <span className="font-mono-num text-[10px] font-bold bg-rose-700 text-white px-1.5 py-0.5 rounded transition-transform duration-200">
                    {openComplaintsCount}
                  </span>
                )}
              </button>
            );
          })}

          <div className="pt-3 mt-3 border-t border-white/10">
            <button
              type="button"
              onClick={logout}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium text-rose-400 hover:bg-[#1E1E1E] cursor-pointer"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              <span>Logout</span>
            </button>
          </div>
        </nav>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="no-print bg-white border-b border-[#E8E8E8] h-16 px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open admin navigation"
              className="lg:hidden p-2 -ml-2 text-[#111111]"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <p className="text-xs text-[#8C6D34] font-semibold">Diamond Admin / {activeLabel}</p>
              <h1 className="font-display text-base font-bold text-[#111111]">{activeLabel}</h1>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <button
              type="button"
              onClick={() => setActiveMenu('store_settings')}
              className="hidden sm:inline-block font-medium text-[#333333]/75 hover:text-[#111111] cursor-pointer"
            >
              Backend: {data.connection.connected ? 'Live WooCommerce' : 'Development Sandbox'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="px-4 py-2 border border-[#E8E8E8] rounded-full font-semibold text-[#111111] hover:border-[#111111] cursor-pointer whitespace-nowrap"
            >
              View Storefront
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {activeMenu === 'dashboard' && (
            <AdminOverviewSection
              analytics={data.analytics}
              recentOrders={data.recentOrders}
              onInspectOrder={(order) => {
                setSelectedOrder(order);
                setActiveMenu('orders');
              }}
            />
          )}

          {activeMenu === 'website_editor' && data.cmsState && (
            <AdminWebsiteEditorSection
              cmsState={data.cmsState}
              categories={data.categories}
              storeSettings={data.storeSettings}
              onRefresh={loadAdminData}
              onRefreshPublicStore={refreshStore}
              pushToast={pushToast}
            />
          )}

          {(activeMenu === 'products' || activeMenu === 'categories' || activeMenu === 'inventory') && (
            <AdminCatalogSection
              mode={activeMenu}
              products={data.products}
              categories={data.categories}
              onRefresh={async () => {
                await Promise.all([loadAdminData(), refreshStore()]);
              }}
              onNavigateProduct={(slug) => navigate(`/product/${slug}`)}
              pushToast={pushToast}
            />
          )}

          {(activeMenu === 'orders' || activeMenu === 'customers' || activeMenu === 'payments') && (
            <AdminOrdersSection
              mode={activeMenu}
              orders={data.orders}
              customers={data.customers}
              selectedOrder={selectedOrder}
              setSelectedOrder={setSelectedOrder}
              onRefresh={loadAdminData}
              pushToast={pushToast}
            />
          )}

          {(activeMenu === 'deliveries' || activeMenu === 'delivery_settings') && (
            <AdminDeliveriesSection
              mode={activeMenu}
              deliveries={data.deliveries || []}
              riders={data.riders || []}
              orders={data.orders}
              deliverySettings={data.deliverySettings}
              deliveryAnalytics={data.deliveryAnalytics}
              emailLogs={data.emailLogs || []}
              onRefresh={loadAdminData}
              onRefreshPublicStore={refreshStore}
              pushToast={pushToast}
            />
          )}

          {activeMenu === 'riders' && (
            <AdminRidersSection
              riders={data.riders || []}
              deliveries={data.deliveries || []}
              riderReviews={data.riderReviews || []}
              deliveryAnalytics={data.deliveryAnalytics}
              onRefresh={loadAdminData}
              pushToast={pushToast}
            />
          )}

          {activeMenu === 'complaints' && (
            <AdminComplaintsSection
              complaints={data.complaints || []}
              deliveries={data.deliveries || []}
              onRefresh={loadAdminData}
              pushToast={pushToast}
            />
          )}

          {(activeMenu === 'coupons' ||
            activeMenu === 'reviews' ||
            activeMenu === 'reports' ||
            activeMenu === 'store_settings' ||
            activeMenu === 'payment_settings' ||
            activeMenu === 'shipping_settings' ||
            activeMenu === 'notifications' ||
            activeMenu === 'security') && (
            <AdminSettingsSection
              section={activeMenu}
              paymentGateways={data.paymentGateways}
              shippingZones={data.shippingZones}
              coupons={data.coupons}
              reviews={data.reviews}
              riderReviews={data.riderReviews || []}
              storeSettings={data.storeSettings}
              notifications={data.notifications}
              auditLogs={data.auditLogs}
              analytics={data.analytics}
              connection={data.connection}
              onRefresh={loadAdminData}
              onRefreshPublicStore={refreshStore}
              pushToast={pushToast}
            />
          )}
        </main>
      </div>
    </div>
  );
}
