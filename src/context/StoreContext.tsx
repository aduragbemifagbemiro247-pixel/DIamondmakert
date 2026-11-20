import type { User } from 'firebase/auth';
import { onAuthStateChanged } from 'firebase/auth';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { apiFetch } from '../lib/api.ts';
import {
  addFirestoreWishlistItem,
  auth,
  type CustomerAddressDoc,
  type CustomerProfileDoc,
  deleteFirestoreAddress,
  ensureFirestoreUserProfile,
  fetchFirestoreAddresses,
  fetchFirestoreWishlist,
  logoutFirebaseUser,
  removeFirestoreWishlistItem,
  saveFirestoreAddress,
  updateFirestoreUserProfile,
} from '../lib/firebase.ts';
import type {
  CartItem,
  Category,
  CmsData,
  CmsPage,
  ConnectionStatus,
  PaymentMethodId,
  Product,
  ProductVariation,
  ShippingZone,
  StoreSettings,
} from '../types/commerce.ts';

export interface PublicGateway {
  id: PaymentMethodId;
  title: string;
  description: string;
  enabled: boolean;
  testMode?: boolean;
  instructions?: string;
  bankDetails?: {
    bankName: string;
    accountName: string;
    accountNumber: string;
    paymentDeadlineHours: number;
    requireProofUpload: boolean;
  };
  codRules?: {
    minOrderAmount: number;
    maxOrderAmount: number;
    supportedStates: string[];
    additionalFee: number;
  };
}

interface BootstrapResponse {
  settings: StoreSettings;
  categories: Category[];
  products: Product[];
  shippingZones: ShippingZone[];
  paymentGateways: PublicGateway[];
  connection: ConnectionStatus;
  cms?: CmsData;
  cmsPages?: CmsPage[];
}

interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  text: string;
}

interface StoreContextValue {
  pathname: string;
  navigate: (to: string) => void;
  loading: boolean;
  error: string | null;
  settings: StoreSettings | null;
  categories: Category[];
  products: Product[];
  shippingZones: ShippingZone[];
  paymentGateways: PublicGateway[];
  connection: ConnectionStatus | null;
  cms: CmsData | null;
  cmsPages: CmsPage[];
  isPreviewMode: boolean;
  refreshStore: () => Promise<void>;

  // Auth & Profile
  user: User | null;
  authReady: boolean;
  isAdmin: boolean;
  profile: CustomerProfileDoc | null;
  addresses: CustomerAddressDoc[];
  updateProfileInfo: (displayName: string, phone: string) => Promise<void>;
  saveAddress: (addr: CustomerAddressDoc) => Promise<void>;
  removeAddress: (id: string) => Promise<void>;
  logout: () => Promise<void>;

  // Cart
  cart: CartItem[];
  cartCount: number;
  cartSubtotal: number;
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
  addToCart: (product: Product, quantity?: number, variation?: ProductVariation) => boolean;
  updateCartQuantity: (key: string, quantity: number) => void;
  removeFromCart: (key: string) => void;
  clearCart: () => void;

  // Wishlist
  wishlistIds: string[];
  isInWishlist: (productId: string) => boolean;
  toggleWishlist: (productId: string) => Promise<void>;

  // Search query handoff
  searchQuery: string;
  setSearchQuery: (q: string) => void;

  // Toast
  toasts: ToastMessage[];
  pushToast: (text: string, type?: ToastMessage['type']) => void;
}

const StoreContext = createContext<StoreContextValue | null>(null);

const CART_STORAGE_KEY = 'diamond_cart_v1';
const WISHLIST_STORAGE_KEY = 'diamond_wishlist_v1';
const LEGACY_CART_STORAGE_KEY = 'zora_cart_v1';
const LEGACY_WISHLIST_STORAGE_KEY = 'zora_wishlist_v1';

function readStorageWithFallback<T>(primaryKey: string, legacyKey: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(primaryKey) ?? localStorage.getItem(legacyKey);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [pathname, setPathname] = useState<string>(() => window.location.pathname || '/');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [shippingZones, setShippingZones] = useState<ShippingZone[]>([]);
  const [paymentGateways, setPaymentGateways] = useState<PublicGateway[]>([]);
  const [connection, setConnection] = useState<ConnectionStatus | null>(null);
  const [publishedCms, setPublishedCms] = useState<CmsData | null>(null);
  const [publishedCmsPages, setPublishedCmsPages] = useState<CmsPage[]>([]);
  const [previewCms, setPreviewCms] = useState<CmsData | null>(null);

  const isPreviewMode =
    typeof window !== 'undefined' &&
    window.location.search.includes('cms_preview=1') &&
    window.parent !== window;

  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [profile, setProfile] = useState<CustomerProfileDoc | null>(null);
  const [addresses, setAddresses] = useState<CustomerAddressDoc[]>([]);

  const [cart, setCart] = useState<CartItem[]>(() =>
    readStorageWithFallback<CartItem[]>(CART_STORAGE_KEY, LEGACY_CART_STORAGE_KEY, [])
  );
  const [isCartOpen, setIsCartOpen] = useState(false);

  const [wishlistIds, setWishlistIds] = useState<string[]>(() =>
    readStorageWithFallback<string[]>(WISHLIST_STORAGE_KEY, LEGACY_WISHLIST_STORAGE_KEY, [])
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const pushToast = useCallback((text: string, type: ToastMessage['type'] = 'info') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev, { id, type, text }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4200);
  }, []);

  const navigate = useCallback(
    (to: string) => {
      const clean = to.startsWith('/') ? to : `/${to}`;
      const [rawPath, rawSearch] = clean.split('?');
      const nextUrl = isPreviewMode
        ? `${rawPath}${rawSearch ? `?${rawSearch}&cms_preview=1` : '?cms_preview=1'}`
        : clean;
      if (window.location.pathname + window.location.search !== nextUrl) {
        window.history.pushState({}, '', nextUrl);
      }
      setPathname(rawPath);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [isPreviewMode]
  );

  useEffect(() => {
    const onPopState = () => {
      setPathname(window.location.pathname || '/');
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    if (!isPreviewMode) return;
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const msg = event.data as {
        type?: string;
        cmsData?: CmsData | null;
        previewPath?: string;
      };
      if (msg?.type === 'DM_CMS_PREVIEW') {
        setPreviewCms(msg.cmsData || null);
        if (msg.previewPath) {
          const clean = msg.previewPath.startsWith('/') ? msg.previewPath : `/${msg.previewPath}`;
          setPathname(clean.split('?')[0]);
        }
      }
    };
    window.addEventListener('message', handleMessage);
    window.parent.postMessage({ type: 'DM_CMS_PREVIEW_READY' }, window.location.origin);
    return () => window.removeEventListener('message', handleMessage);
  }, [isPreviewMode]);

  const refreshStore = useCallback(async () => {
    try {
      const data = await apiFetch<BootstrapResponse>('/api/store/bootstrap');
      setSettings(data.settings);
      setCategories(data.categories);
      setProducts(data.products);
      setShippingZones(data.shippingZones);
      setPaymentGateways(data.paymentGateways);
      setConnection(data.connection);
      setPublishedCms(data.cms || null);
      setPublishedCmsPages(data.cmsPages || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reach store API.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshStore();
  }, [refreshStore]);

  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
      if (localStorage.getItem(LEGACY_CART_STORAGE_KEY)) {
        localStorage.removeItem(LEGACY_CART_STORAGE_KEY);
      }
    } catch {
      // ignore storage quota errors
    }
  }, [cart]);

  useEffect(() => {
    if (!user) {
      try {
        localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(wishlistIds));
        if (localStorage.getItem(LEGACY_WISHLIST_STORAGE_KEY)) {
          localStorage.removeItem(LEGACY_WISHLIST_STORAGE_KEY);
        }
      } catch {
        // ignore
      }
    }
  }, [wishlistIds, user]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (!firebaseUser) {
        setIsAdmin(false);
        setProfile(null);
        setAddresses([]);
        setAuthReady(true);
        return;
      }

      try {
        const session = await apiFetch<{
          authenticated: boolean;
          isAdmin: boolean;
          wooCustomerId?: number | null;
        }>('/api/auth/session', {
          method: 'POST',
          body: JSON.stringify({
            displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0],
          }),
        });
        setIsAdmin(Boolean(session.isAdmin));

        const [prof, addrs, remoteWish] = await Promise.all([
          ensureFirestoreUserProfile(firebaseUser, session.wooCustomerId ?? undefined),
          fetchFirestoreAddresses(firebaseUser.uid),
          fetchFirestoreWishlist(firebaseUser.uid),
        ]);
        setProfile(prof);
        setAddresses(addrs);

        const guestWish = readStorageWithFallback<string[]>(
          WISHLIST_STORAGE_KEY,
          LEGACY_WISHLIST_STORAGE_KEY,
          []
        );
        const merged = Array.from(new Set([...remoteWish, ...guestWish]));
        for (const pid of guestWish) {
          if (!remoteWish.includes(pid)) {
            await addFirestoreWishlistItem(firebaseUser.uid, pid).catch(() => {});
          }
        }
        setWishlistIds(merged);
      } catch (err) {
        console.error('Auth session sync error:', err);
      } finally {
        setAuthReady(true);
      }
    });

    return () => unsub();
  }, []);

  const addToCart = useCallback(
    (product: Product, quantity = 1, variation?: ProductVariation): boolean => {
      if (product.type === 'variable' && product.variations.length > 0 && !variation) {
        pushToast('Please select a size or option before adding to bag.', 'info');
        return false;
      }

      const unitPrice = variation
        ? variation.salePrice && variation.salePrice < variation.price
          ? variation.salePrice
          : variation.price
        : product.salePrice && product.salePrice < product.price
        ? product.salePrice
        : product.price;
      const maxStock = product.manageStock
        ? variation
          ? variation.stockQuantity
          : product.stockQuantity
        : 99;

      if (maxStock <= 0 || !product.inStock || (variation && !variation.inStock)) {
        pushToast('This item is currently out of stock.', 'error');
        return false;
      }

      const key = variation ? `${product.id}__${variation.id}` : product.id;

      setCart((prev) => {
        const idx = prev.findIndex((item) => item.key === key);
        if (idx !== -1) {
          const nextQty = Math.min(maxStock, prev[idx].quantity + quantity);
          const updated = [...prev];
          updated[idx] = { ...updated[idx], quantity: nextQty, unitPrice, maxStock };
          return updated;
        }
        return [
          ...prev,
          {
            key,
            productId: product.id,
            variationId: variation?.id,
            name: product.name,
            slug: product.slug,
            sku: variation?.sku || product.sku,
            image: product.images[0] || '',
            unitPrice,
            quantity: Math.min(maxStock, Math.max(1, quantity)),
            attributes: variation?.attributes,
            maxStock,
            codAllowed: product.codAllowed,
          },
        ];
      });
      pushToast(`Added ${product.name} to bag`, 'success');
      setIsCartOpen(true);
      return true;
    },
    [pushToast]
  );

  const updateCartQuantity = useCallback(
    (key: string, quantity: number) => {
      if (quantity <= 0) {
        setCart((prev) => {
          const target = prev.find((item) => item.key === key);
          if (target) {
            pushToast(`Removed ${target.name} from bag`, 'info');
          }
          return prev.filter((item) => item.key !== key);
        });
        return;
      }
      setCart((prev) =>
        prev.map((item) =>
          item.key === key ? { ...item, quantity: Math.min(item.maxStock, quantity) } : item
        )
      );
    },
    [pushToast]
  );

  const removeFromCart = useCallback(
    (key: string) => {
      setCart((prev) => {
        const target = prev.find((item) => item.key === key);
        if (target) {
          pushToast(`Removed ${target.name} from bag`, 'info');
        }
        return prev.filter((item) => item.key !== key);
      });
    },
    [pushToast]
  );

  const clearCart = useCallback(() => {
    setCart([]);
  }, []);

  const isInWishlist = useCallback(
    (productId: string) => wishlistIds.includes(productId),
    [wishlistIds]
  );

  const toggleWishlist = useCallback(
    async (productId: string) => {
      const exists = wishlistIds.includes(productId);
      if (exists) {
        setWishlistIds((prev) => prev.filter((id) => id !== productId));
        if (user) {
          await removeFirestoreWishlistItem(user.uid, productId).catch(() => {});
        }
        pushToast('Removed from wishlist', 'info');
      } else {
        setWishlistIds((prev) => [...prev, productId]);
        if (user) {
          await addFirestoreWishlistItem(user.uid, productId).catch(() => {});
        }
        pushToast('Saved to wishlist', 'success');
      }
    },
    [wishlistIds, user, pushToast]
  );

  const updateProfileInfo = useCallback(
    async (displayName: string, phone: string) => {
      if (!user) return;
      await updateFirestoreUserProfile(user.uid, { displayName, phone });
      setProfile((prev) => (prev ? { ...prev, displayName, phone } : prev));
      pushToast('Profile updated', 'success');
    },
    [user, pushToast]
  );

  const saveAddress = useCallback(
    async (addr: CustomerAddressDoc) => {
      if (!user) return;
      await saveFirestoreAddress(user.uid, addr);
      const refreshed = await fetchFirestoreAddresses(user.uid);
      setAddresses(refreshed);
      pushToast('Address saved', 'success');
    },
    [user, pushToast]
  );

  const removeAddress = useCallback(
    async (id: string) => {
      if (!user) return;
      await deleteFirestoreAddress(user.uid, id);
      setAddresses((prev) => prev.filter((a) => a.id !== id));
      pushToast('Address deleted', 'info');
    },
    [user, pushToast]
  );

  const logout = useCallback(async () => {
    await logoutFirebaseUser();
    setIsAdmin(false);
    pushToast('Signed out cleanly', 'info');
    if (pathname.startsWith('/admin') || pathname.startsWith('/account')) {
      navigate('/');
    }
  }, [navigate, pathname, pushToast]);

  const cartCount = cart.reduce((acc, item) => acc + item.quantity, 0);
  const cartSubtotal = cart.reduce((acc, item) => acc + item.unitPrice * item.quantity, 0);

  const activeCms = (isPreviewMode && previewCms) ? previewCms : publishedCms;
  const activeCmsPages = (isPreviewMode && previewCms)
    ? previewCms.pages
    : publishedCmsPages;

  return (
    <StoreContext.Provider
      value={{
        pathname,
        navigate,
        loading,
        error,
        settings,
        categories,
        products,
        shippingZones,
        paymentGateways,
        connection,
        cms: activeCms,
        cmsPages: activeCmsPages,
        isPreviewMode,
        refreshStore,
        user,
        authReady,
        isAdmin,
        profile,
        addresses,
        updateProfileInfo,
        saveAddress,
        removeAddress,
        logout,
        cart,
        cartCount,
        cartSubtotal,
        isCartOpen,
        setIsCartOpen,
        addToCart,
        updateCartQuantity,
        removeFromCart,
        clearCart,
        wishlistIds,
        isInWishlist,
        toggleWishlist,
        searchQuery,
        setSearchQuery,
        toasts,
        pushToast,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) {
    throw new Error('useStore must be used within StoreProvider');
  }
  return ctx;
}
