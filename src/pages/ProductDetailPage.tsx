import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronUp,
  Flag,
  Heart,
  ImagePlus,
  MessageCircle,
  Minus,
  Plus,
  RotateCcw,
  Ruler,
  ShieldCheck,
  ShoppingBag,
  Star,
  Truck,
  X,
  ZoomIn,
} from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ProductCard } from '../components/ProductCard.tsx';
import { useStore } from '../context/StoreContext.tsx';
import { useMotionPreferences } from '../hooks/useMotionPreferences.ts';
import { apiFetch } from '../lib/api.ts';
import type { ProductReview, ProductVariation } from '../types/commerce.ts';
import { calculateDiscountPercentage, formatDateShort, formatNaira } from '../utils/currency.ts';
import { buildProductWhatsAppUrl, sanitizeHtml } from '../utils/sanitizeHtml.ts';

interface ProductDetailPageProps {
  slug: string;
}

export function ProductDetailPage({ slug }: ProductDetailPageProps) {
  const {
    products,
    settings,
    navigate,
    addToCart,
    isInWishlist,
    toggleWishlist,
    user,
    pushToast,
  } = useStore();

  const product = useMemo(
    () => products.find((p) => p.slug === slug || p.id === slug),
    [products, slug]
  );

  const { canHover, animationsEnabled } = useMotionPreferences();
  const [selectedImageIdx, setSelectedImageIdx] = useState(0);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [lensPos, setLensPos] = useState<{ x: number; y: number; active: boolean }>({
    x: 50,
    y: 50,
    active: false,
  });
  const [addedFlash, setAddedFlash] = useState(false);
  const galleryRef = useRef<HTMLDivElement>(null);
  const [selectedVariation, setSelectedVariation] = useState<ProductVariation | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [returnOpen, setReturnOpen] = useState(true);
  const [careOpen, setCareOpen] = useState(false);

  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [reviewName, setReviewName] = useState('');
  const [reviewEmail, setReviewEmail] = useState('');
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewTitle, setReviewTitle] = useState('');
  const [qualityRating, setQualityRating] = useState(5);
  const [accuracyRating, setAccuracyRating] = useState(5);
  const [sizeFitFeedback, setSizeFitFeedback] = useState<'' | 'runs_small' | 'true_to_size' | 'runs_large' | 'comfortable'>('true_to_size');
  const [reviewComment, setReviewComment] = useState('');
  const [reviewPhotos, setReviewPhotos] = useState<string[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [submittingReview, setSubmittingReview] = useState(false);

  useEffect(() => {
    setSelectedImageIdx(0);
    setSelectedVariation(null);
    setQuantity(1);
    setReturnOpen(true);
    setCareOpen(false);
    setLensPos({ x: 50, y: 50, active: false });
    if (product) {
      apiFetch<{ reviews: ProductReview[] }>(`/api/products/${product.slug}`)
        .then((res) => setReviews(res.reviews || []))
        .catch(() => {});
    }
  }, [product?.id, product?.slug]);

  useEffect(() => {
    if (!zoomOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setZoomOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [zoomOpen]);

  useEffect(() => {
    if (user) {
      setReviewName(user.displayName || '');
      setReviewEmail(user.email || '');
    }
  }, [user]);

  if (!product) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <h1 className="font-display text-3xl font-bold text-[#111111]">Piece Not Found</h1>
        <p className="text-sm text-[#333333] mt-2 mb-6">
          This shoe or fashion item may have been archived or moved.
        </p>
        <button
          type="button"
          onClick={() => navigate('/shop')}
          className="px-6 py-3 rounded-full bg-[#111111] text-white text-xs font-bold uppercase tracking-wider"
        >
          Back to Collection
        </button>
      </div>
    );
  }

  const isVariable = product.type === 'variable' && product.variations.length > 0;
  const activeVariation = isVariable ? selectedVariation : null;

  const basePrice = activeVariation ? activeVariation.price : product.price;
  const activeSalePrice = activeVariation ? activeVariation.salePrice : product.salePrice;
  const effectivePrice =
    activeSalePrice && activeSalePrice < basePrice ? activeSalePrice : basePrice;
  const discount = calculateDiscountPercentage(basePrice, activeSalePrice);

  const stockCount = product.manageStock
    ? activeVariation
      ? activeVariation.stockQuantity
      : product.stockQuantity
    : 99;
  const availableInStock =
    product.inStock && stockCount > 0 && (!activeVariation || activeVariation.inStock);

  const wished = isInWishlist(product.id);
  const related = products
    .filter((p) => p.id !== product.id && p.status === 'publish' && p.categoryId === product.categoryId)
    .slice(0, 4);

  const whatsappNumber = settings?.whatsapp || settings?.phone || '07051959290';
  const whatsappProductUrl = buildProductWhatsAppUrl(
    whatsappNumber,
    product.name,
    typeof window !== 'undefined' ? window.location.href : undefined
  );

  const handleAddToBag = (goCheckout = false) => {
    if (isVariable && !activeVariation) {
      pushToast('Please select a size or variation before continuing.', 'info');
      return;
    }
    const ok = addToCart(product, quantity, activeVariation || undefined);
    if (ok) {
      setAddedFlash(true);
      window.setTimeout(() => setAddedFlash(false), 1200);
      if (goCheckout) {
        navigate('/checkout');
      }
    }
  };

  const handleUploadReviewPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!user) {
      pushToast('Please sign in first to upload review photos.', 'info');
      return;
    }
    setUploadingPhoto(true);
    try {
      const fd = new FormData();
      fd.append('image', file);
      const res = await apiFetch<{ url: string }>('/api/reviews/photo-upload', {
        method: 'POST',
        body: fd,
      });
      setReviewPhotos((prev) => [...prev.slice(0, 3), res.url]);
      pushToast('Review photo attached', 'success');
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Unable to upload photo', 'error');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      pushToast('Please sign in to submit a customer review.', 'info');
      navigate('/auth');
      return;
    }
    if (!reviewComment.trim()) {
      pushToast('Please enter your review comment.', 'error');
      return;
    }
    setSubmittingReview(true);
    try {
      const data = await apiFetch<{ review: ProductReview; message?: string }>('/api/reviews', {
        method: 'POST',
        body: JSON.stringify({
          productId: product.id,
          rating: reviewRating,
          title: reviewTitle.trim() || undefined,
          qualityRating,
          accuracyRating,
          sizeFitFeedback,
          photos: reviewPhotos,
          comment: reviewComment.trim(),
        }),
      });
      if (data.review.status === 'approved') {
        setReviews((prev) => [data.review, ...prev]);
      }
      setReviewTitle('');
      setReviewComment('');
      setReviewPhotos([]);
      pushToast(data.message || 'Review submitted for moderation.', 'success');
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Unable to submit review', 'error');
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleReportReview = async (reviewId: string) => {
    if (!user) {
      pushToast('Sign in to report a review.', 'info');
      return;
    }
    try {
      await apiFetch(`/api/reviews/${reviewId}/report`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'Flagged by customer for moderation inspection' }),
      });
      pushToast('Review flagged for Diamond Market moderation.', 'info');
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Unable to report review', 'error');
    }
  };

  const rp = product.returnPolicy;
  const hasProductReturnPolicy = Boolean(
    rp &&
      rp.enabled &&
      (rp.returnWindowDays ||
        rp.eligibleConditions ||
        rp.nonReturnableConditions ||
        rp.exchangeRules ||
        rp.refundConditions ||
        rp.formattedText)
  );

  return (
    <div className="bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-[#333333]/75 mb-8">
          <button
            type="button"
            onClick={() => navigate('/shop')}
            className="inline-flex items-center gap-1.5 hover:text-[#111111] font-medium"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Shop
          </button>
          <span>/</span>
          <button
            type="button"
            onClick={() => navigate(`/category/${product.categorySlug}`)}
            className="hover:text-[#111111] font-medium"
          >
            {product.categoryName}
          </button>
          <span>/</span>
          <span className="text-[#111111] font-semibold truncate">{product.name}</span>
        </div>

        {/* Main Gallery + Buy Box Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14">
          {/* Left Gallery with Interactive Pan Zoom */}
          <div className="lg:col-span-6 space-y-4">
            <div
              ref={galleryRef}
              onMouseMove={(e) => {
                if (!canHover || !animationsEnabled || !galleryRef.current) return;
                const rect = galleryRef.current.getBoundingClientRect();
                const x = Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100));
                const y = Math.min(100, Math.max(0, ((e.clientY - rect.top) / rect.height) * 100));
                setLensPos({ x, y, active: true });
              }}
              onMouseLeave={() => setLensPos((prev) => ({ ...prev, active: false }))}
              onClick={() => setZoomOpen(true)}
              className="relative rounded-3xl bg-[#FAF8F3] border border-[#E8E8E8] overflow-hidden aspect-[4/4.2] group cursor-zoom-in shadow-sm"
            >
              {product.images[selectedImageIdx] ? (
                <img
                  src={product.images[selectedImageIdx]}
                  alt={product.name}
                  referrerPolicy="no-referrer"
                  style={
                    lensPos.active && canHover && animationsEnabled
                      ? {
                          transformOrigin: `${lensPos.x.toFixed(1)}% ${lensPos.y.toFixed(1)}%`,
                          transform: 'scale(1.42)',
                        }
                      : undefined
                  }
                  className="w-full h-full object-cover transition-transform duration-200 ease-out"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-sm text-neutral-400">
                  Diamond Market
                </div>
              )}

              {discount && (
                <span className="absolute top-4 left-4 px-3 py-1 rounded-full bg-[#C6A15B] text-[#111111] text-xs font-bold uppercase tracking-wider">
                  Save {discount}%
                </span>
              )}

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setZoomOpen(true);
                }}
                className="dm-btn-interactive absolute bottom-4 right-4 w-10 h-10 rounded-full bg-white/95 border border-[#E8E8E8] flex items-center justify-center text-[#111111] shadow-sm hover:bg-[#111111] hover:text-white cursor-pointer"
                aria-label="Zoom product image"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
            </div>

            {product.images.length > 1 && (
              <div className="flex gap-3 overflow-x-auto pb-1">
                {product.images.map((img, idx) => (
                  <button
                    key={`${img}-${idx}`}
                    type="button"
                    onClick={() => setSelectedImageIdx(idx)}
                    className={`w-20 h-20 rounded-xl overflow-hidden border-2 shrink-0 bg-[#FAF8F3] transition-all ${
                      selectedImageIdx === idx
                        ? 'border-[#111111] ring-2 ring-[#C6A15B]/40'
                        : 'border-[#E8E8E8] opacity-75 hover:opacity-100'
                    }`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right Product Info & Actions */}
          <div className="lg:col-span-6 space-y-6">
            <div>
              <div className="flex items-center justify-between gap-2 text-xs uppercase tracking-[0.18em] text-[#8C6D34] font-semibold">
                <span>
                  {product.brand || 'Diamond Market'} ·{' '}
                  {product.subcategoryName || product.categoryName}
                </span>
                <span className="font-mono-num text-[11px] text-[#333333]/65">
                  SKU: {activeVariation?.sku || product.sku}
                </span>
              </div>

              <h1 className="font-display text-3xl sm:text-4xl font-bold text-[#111111] mt-2 leading-tight">
                {product.name}
              </h1>

              {product.reviewCount > 0 && (
                <div className="flex items-center gap-2 mt-2 text-xs text-[#333333]">
                  <span className="inline-flex items-center gap-1 font-semibold text-[#111111]">
                    <Star className="w-4 h-4 fill-[#C6A15B] text-[#C6A15B]" />
                    {product.averageRating.toFixed(1)}
                  </span>
                  <span>({product.reviewCount} verified reviews)</span>
                </div>
              )}
            </div>

            {/* Price */}
            <div className="flex items-baseline gap-3 pb-5 border-b border-[#E8E8E8]">
              <span className="font-mono-num text-3xl font-bold text-[#111111]">
                {formatNaira(effectivePrice)}
              </span>
              {discount && (
                <span className="font-mono-num text-base text-neutral-400 line-through">
                  {formatNaira(basePrice)}
                </span>
              )}
              <span
                className={`ml-auto text-xs font-semibold px-3 py-1 rounded-full ${
                  availableInStock
                    ? 'bg-[#FAF8F3] text-[#111111] border border-[#E8E8E8]'
                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                }`}
              >
                {availableInStock ? `In Stock (${stockCount} available)` : 'Out of Stock'}
              </span>
            </div>

            {product.shortDescription && (
              <p className="text-sm sm:text-base text-[#333333] leading-relaxed">
                {product.shortDescription}
              </p>
            )}

            {/* Variable Product Selector */}
            {isVariable && (
              <div className="space-y-3 bg-[#FAF8F3] p-4 rounded-2xl border border-[#E8E8E8]">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-[#111111]">
                    Select Size / Variation <span className="text-[#8C6D34]">*</span>
                  </label>
                  {activeVariation && (
                    <span className="text-xs font-semibold text-[#8C6D34]">
                      Selected: {Object.values(activeVariation.attributes).join(' · ')}
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  {product.variations.map((v) => {
                    const label = Object.values(v.attributes).join(' · ') || v.sku;
                    const active = activeVariation?.id === v.id;
                    const oos = !v.inStock || v.stockQuantity <= 0;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        disabled={oos}
                        onClick={() => setSelectedVariation(v)}
                        className={`px-4 py-2.5 rounded-full text-xs font-semibold border transition-all ${
                          active
                            ? 'bg-[#111111] text-white border-[#111111] shadow-sm'
                            : oos
                            ? 'bg-neutral-100 text-neutral-400 border-neutral-200 line-through cursor-not-allowed'
                            : 'bg-white text-[#111111] border-[#E8E8E8] hover:border-[#C6A15B]'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
                {!activeVariation && (
                  <p className="text-[11px] text-[#8C6D34]">
                    Choose a size or option above to enable Add to Bag and Checkout.
                  </p>
                )}
              </div>
            )}

            {/* Quantity + Cart + Wishlist + Buy Now */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <div className="inline-flex items-center h-12 rounded-full border border-[#E8E8E8] bg-[#FAF8F3] px-1">
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-white text-[#111111]"
                    aria-label="Decrease quantity"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="w-10 text-center text-sm font-bold font-mono-num">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.min(stockCount || 10, q + 1))}
                    className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-white text-[#111111]"
                    aria-label="Increase quantity"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                <button
                  type="button"
                  disabled={!availableInStock || (isVariable && !activeVariation)}
                  onClick={() => handleAddToBag(false)}
                  className={`dm-btn-interactive flex-1 min-w-[180px] h-12 rounded-full disabled:bg-neutral-200 disabled:text-neutral-500 text-xs font-bold uppercase tracking-[0.14em] inline-flex items-center justify-center gap-2 cursor-pointer ${
                    addedFlash
                      ? 'bg-[#C6A15B] text-[#111111]'
                      : 'bg-[#111111] hover:bg-[#2a2a2a] text-white'
                  }`}
                >
                  {addedFlash ? (
                    <>
                      <Check className="w-4 h-4" />
                      Added to Bag
                    </>
                  ) : (
                    <>
                      <ShoppingBag className="w-4 h-4 text-[#C6A15B]" />
                      {!availableInStock
                        ? 'Out of Stock'
                        : isVariable && !activeVariation
                        ? 'Select Option First'
                        : 'Add to Bag'}
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => toggleWishlist(product.id)}
                  className={`w-12 h-12 rounded-full border flex items-center justify-center transition-all active:scale-90 cursor-pointer ${
                    wished
                      ? 'bg-[#111111] border-[#111111] text-[#C6A15B]'
                      : 'border-[#E8E8E8] text-[#111111] hover:border-[#C6A15B]'
                  }`}
                  aria-label="Save to wishlist"
                >
                  <Heart className={`w-5 h-5 transition-transform duration-200 ${wished ? 'fill-current scale-110' : ''}`} />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={!availableInStock || (isVariable && !activeVariation)}
                  onClick={() => handleAddToBag(true)}
                  className="dm-btn-interactive h-11 rounded-full bg-[#C6A15B] hover:bg-[#b58f48] disabled:bg-neutral-200 disabled:text-neutral-500 text-[#111111] text-xs font-bold uppercase tracking-[0.14em] cursor-pointer"
                >
                  Buy Now
                </button>

                {/* Direct Product-Specific WhatsApp Inquiry */}
                <a
                  href={whatsappProductUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="h-11 rounded-full border border-[#111111] hover:bg-[#111111] hover:text-white text-[#111111] text-xs font-bold uppercase tracking-[0.12em] inline-flex items-center justify-center gap-2 transition-colors"
                >
                  <MessageCircle className="w-4 h-4 text-[#25D366]" />
                  Inquire on WhatsApp
                </a>
              </div>
            </div>

            {/* Key Guarantees */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs text-[#333333]">
              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-[#FAF8F3] border border-[#E8E8E8]">
                <Truck className="w-4 h-4 text-[#C6A15B] shrink-0" />
                <span>Dispatched from {settings?.address || 'Ogbomoso, Oyo State, Nigeria'}</span>
              </div>
              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-[#FAF8F3] border border-[#E8E8E8]">
                <ShieldCheck className="w-4 h-4 text-[#C6A15B] shrink-0" />
                <span>
                  {product.codAllowed
                    ? 'Pay on Delivery & Online Naira Payments'
                    : 'Card, Transfer & Bank Deposit Supported'}
                </span>
              </div>
            </div>

            {/* Product-Specific Return Policy Panel (Dedicated & Prominent) */}
            <div className="rounded-2xl border border-[#C6A15B]/50 bg-[#FAF8F3] overflow-hidden">
              <button
                type="button"
                onClick={() => setReturnOpen((v) => !v)}
                className="w-full px-5 py-4 flex items-center justify-between text-left"
              >
                <div className="flex items-center gap-2.5">
                  <RotateCcw className="w-4 h-4 text-[#8C6D34]" />
                  <div>
                    <h2 className="font-display font-bold text-base text-[#111111]">
                      Return &amp; Exchange Policy
                    </h2>
                    <p className="text-[11px] text-[#333333]/75">
                      {hasProductReturnPolicy && rp?.returnWindowDays
                        ? `Product-specific ${rp.returnWindowDays}-day return & exchange guidance`
                        : 'Diamond Market return & customer support policy'}
                    </p>
                  </div>
                </div>
                {returnOpen ? (
                  <ChevronUp className="w-4 h-4 text-[#111111]" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-[#111111]" />
                )}
              </button>

              {returnOpen && (
                <div className="px-5 pb-5 pt-1 border-t border-[#E8E8E8] text-xs text-[#333333] space-y-3 leading-relaxed">
                  {hasProductReturnPolicy && rp ? (
                    <>
                      {rp.formattedText && (
                        <div
                          className="dm-prose text-xs"
                          dangerouslySetInnerHTML={{ __html: sanitizeHtml(rp.formattedText) }}
                        />
                      )}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        {rp.returnWindowDays ? (
                          <div className="bg-white rounded-xl p-3 border border-[#E8E8E8]">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-[#8C6D34]">
                              Return Window
                            </p>
                            <p className="font-semibold text-[#111111] mt-0.5">
                              Within {rp.returnWindowDays} days of delivery
                            </p>
                          </div>
                        ) : null}
                        {rp.returnShippingPayer && (
                          <div className="bg-white rounded-xl p-3 border border-[#E8E8E8]">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-[#8C6D34]">
                              Return Shipping
                            </p>
                            <p className="font-semibold text-[#111111] mt-0.5">
                              {rp.returnShippingPayer === 'store'
                                ? 'Covered by Diamond Market'
                                : rp.returnShippingPayer === 'customer'
                                ? 'Covered by customer'
                                : 'Store covers defective/wrong item; customer covers size swaps'}
                            </p>
                          </div>
                        )}
                      </div>
                      {rp.eligibleConditions && (
                        <p>
                          <strong className="text-[#111111]">Eligible Conditions:</strong>{' '}
                          {rp.eligibleConditions}
                        </p>
                      )}
                      {rp.nonReturnableConditions && (
                        <p>
                          <strong className="text-[#111111]">Non-Returnable:</strong>{' '}
                          {rp.nonReturnableConditions}
                        </p>
                      )}
                      {rp.exchangeRules && (
                        <p>
                          <strong className="text-[#111111]">Exchange Policy:</strong>{' '}
                          {rp.exchangeRules}
                        </p>
                      )}
                      {rp.refundConditions && (
                        <p>
                          <strong className="text-[#111111]">Refunds:</strong> {rp.refundConditions}
                        </p>
                      )}
                    </>
                  ) : settings?.returnPolicyText?.trim() ? (
                    <div className="whitespace-pre-line">{settings.returnPolicyText}</div>
                  ) : (
                    <p>
                      Please contact Diamond Market on WhatsApp (
                      <a
                        href={whatsappProductUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="font-semibold text-[#8C6D34] underline"
                      >
                        {whatsappNumber}
                      </a>
                      ) for return or exchange eligibility on this item.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Care & Sizing Accordion */}
            {(product.careInstructions || product.sizeGuide) && (
              <div className="rounded-2xl border border-[#E8E8E8] bg-white overflow-hidden">
                <button
                  type="button"
                  onClick={() => setCareOpen((v) => !v)}
                  className="w-full px-5 py-4 flex items-center justify-between text-left"
                >
                  <span className="inline-flex items-center gap-2 font-display font-bold text-base text-[#111111]">
                    <Ruler className="w-4 h-4 text-[#8C6D34]" />
                    Care &amp; Sizing Notes
                  </span>
                  {careOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {careOpen && (
                  <div className="px-5 pb-5 border-t border-[#E8E8E8] pt-3 text-xs text-[#333333] space-y-2.5 leading-relaxed">
                    {product.sizeGuide && (
                      <p>
                        <strong className="text-[#111111]">Sizing &amp; Fit:</strong>{' '}
                        {product.sizeGuide}
                      </p>
                    )}
                    {product.careInstructions && (
                      <p>
                        <strong className="text-[#111111]">Care Instructions:</strong>{' '}
                        {product.careInstructions}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Full Editorial Description & Specifications */}
        <div className="mt-16 pt-12 border-t border-[#E8E8E8] grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-7 space-y-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#8C6D34]">
              Product Notes
            </p>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#111111]">
              Craftsmanship &amp; Styling Details
            </h2>
            <div
              className="dm-prose text-sm text-[#333333]"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(product.description) }}
            />
          </div>

          <div className="lg:col-span-5">
            <div className="bg-[#FAF8F3] border border-[#E8E8E8] rounded-2xl p-6 space-y-4">
              <h3 className="font-display font-bold text-lg text-[#111111]">Specifications</h3>
              <dl className="divide-y divide-[#E8E8E8] text-xs">
                {product.brand && (
                  <div className="py-2.5 flex justify-between gap-4">
                    <dt className="text-[#333333]/75">Brand</dt>
                    <dd className="font-semibold text-[#111111]">{product.brand}</dd>
                  </div>
                )}
                {product.material && (
                  <div className="py-2.5 flex justify-between gap-4">
                    <dt className="text-[#333333]/75">Material</dt>
                    <dd className="font-semibold text-[#111111] text-right">{product.material}</dd>
                  </div>
                )}
                {product.weightKg ? (
                  <div className="py-2.5 flex justify-between gap-4">
                    <dt className="text-[#333333]/75">Estimated Weight</dt>
                    <dd className="font-mono-num font-semibold text-[#111111]">
                      {product.weightKg} kg
                    </dd>
                  </div>
                ) : null}
                {product.dimensions && (
                  <div className="py-2.5 flex justify-between gap-4">
                    <dt className="text-[#333333]/75">Packaging / Fit</dt>
                    <dd className="font-semibold text-[#111111] text-right">{product.dimensions}</dd>
                  </div>
                )}
                {product.specifications.map((spec, i) => (
                  <div key={`${spec.label}-${i}`} className="py-2.5 flex justify-between gap-4">
                    <dt className="text-[#333333]/75">{spec.label}</dt>
                    <dd className="font-semibold text-[#111111] text-right">{spec.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </div>

        {/* Customer Reviews Section */}
        <div className="mt-16 pt-12 border-t border-[#E8E8E8] grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-7 space-y-5">
            <h2 className="font-display text-2xl font-bold text-[#111111]">
              Customer Reviews ({reviews.length})
            </h2>
            {reviews.length === 0 ? (
              <div className="rounded-2xl bg-[#FAF8F3] border border-[#E8E8E8] p-6 text-sm text-[#333333]">
                No reviews yet for this piece. Share your fit and quality feedback below after purchasing.
              </div>
            ) : (
              <div className="space-y-4">
                {reviews.map((rev) => (
                  <div
                    key={rev.id}
                    className="rounded-2xl border border-[#E8E8E8] bg-white p-5 space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-sm text-[#111111]">
                          {rev.reviewerName}
                        </span>
                        {rev.verifiedPurchase && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#8C6D34] bg-[#FAF8F3] px-2 py-0.5 rounded-full border border-[#E8E8E8]">
                            <Check className="w-3 h-3" /> Verified Buyer
                          </span>
                        )}
                        {rev.sizeFitFeedback && (
                          <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-neutral-100 text-[#333333]">
                            Fit: {rev.sizeFitFeedback.replace(/_/g, ' ')}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-neutral-400">
                        {formatDateShort(rev.createdAt)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-0.5 text-[#C6A15B]">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={`w-3.5 h-3.5 ${i < rev.rating ? 'fill-current' : 'opacity-25'}`}
                          />
                        ))}
                      </div>
                      {(rev.qualityRating || rev.accuracyRating) && (
                        <span className="text-[11px] text-[#333333]/75">
                          {rev.qualityRating ? `Quality ${rev.qualityRating}/5` : ''}
                          {rev.qualityRating && rev.accuracyRating ? ' · ' : ''}
                          {rev.accuracyRating ? `Accuracy ${rev.accuracyRating}/5` : ''}
                        </span>
                      )}
                    </div>
                    {rev.title && <p className="font-semibold text-sm text-[#111111]">{rev.title}</p>}
                    <p className="text-sm text-[#333333]">{rev.comment}</p>
                    {rev.photos && rev.photos.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {rev.photos.map((photo, idx) => (
                          <img
                            key={idx}
                            src={photo}
                            alt="Customer review photo"
                            className="w-16 h-16 rounded-xl object-cover border border-[#E8E8E8]"
                          />
                        ))}
                      </div>
                    )}
                    {user && (
                      <div className="pt-1 flex justify-end">
                        <button
                          type="button"
                          onClick={() => handleReportReview(rev.id)}
                          className="text-[11px] text-[#333333]/65 hover:text-rose-700 inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Flag className="w-3 h-3" /> Report
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="lg:col-span-5">
            <form
              onSubmit={handleSubmitReview}
              className="rounded-2xl bg-[#FAF8F3] border border-[#E8E8E8] p-6 space-y-3.5"
            >
              <h3 className="font-display font-bold text-lg text-[#111111]">Leave a Review</h3>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#333333]">Overall Rating:</span>
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setReviewRating(star)}
                    className="p-0.5 text-[#C6A15B] cursor-pointer"
                  >
                    <Star className={`w-5 h-5 ${star <= reviewRating ? 'fill-current' : 'opacity-30'}`} />
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={reviewTitle}
                onChange={(e) => setReviewTitle(e.target.value)}
                placeholder="Review headline (e.g. Clean leather finish, fits true to size)"
                className="w-full h-10 px-3.5 rounded-xl border border-[#E8E8E8] bg-white text-xs"
              />
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <label className="block text-[11px] text-[#333333]/75 mb-1">Quality</label>
                  <select
                    value={qualityRating}
                    onChange={(e) => setQualityRating(Number(e.target.value))}
                    className="w-full h-9 px-2 rounded-xl border border-[#E8E8E8] bg-white"
                  >
                    {[5, 4, 3, 2, 1].map((n) => (
                      <option key={n} value={n}>{n}/5 ★</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-[#333333]/75 mb-1">Accuracy</label>
                  <select
                    value={accuracyRating}
                    onChange={(e) => setAccuracyRating(Number(e.target.value))}
                    className="w-full h-9 px-2 rounded-xl border border-[#E8E8E8] bg-white"
                  >
                    {[5, 4, 3, 2, 1].map((n) => (
                      <option key={n} value={n}>{n}/5 ★</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-[#333333]/75 mb-1">Size &amp; Fit</label>
                  <select
                    value={sizeFitFeedback}
                    onChange={(e) => setSizeFitFeedback(e.target.value as typeof sizeFitFeedback)}
                    className="w-full h-9 px-2 rounded-xl border border-[#E8E8E8] bg-white"
                  >
                    <option value="true_to_size">True to Size</option>
                    <option value="runs_small">Runs Small</option>
                    <option value="runs_large">Runs Large</option>
                    <option value="comfortable">Comfortable</option>
                  </select>
                </div>
              </div>
              <input
                type="text"
                value={reviewName}
                onChange={(e) => setReviewName(e.target.value)}
                placeholder="Your name"
                className="w-full h-10 px-3.5 rounded-xl border border-[#E8E8E8] bg-white text-sm"
              />
              <input
                type="email"
                value={reviewEmail}
                onChange={(e) => setReviewEmail(e.target.value)}
                placeholder="Your email"
                className="w-full h-10 px-3.5 rounded-xl border border-[#E8E8E8] bg-white text-sm"
              />
              <textarea
                rows={3}
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="How was the sizing, comfort, packaging, and finish?"
                className="w-full p-3.5 rounded-xl border border-[#E8E8E8] bg-white text-sm"
              />
              <div className="space-y-2">
                <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full border border-[#E8E8E8] bg-white hover:border-[#111111] text-xs font-semibold cursor-pointer">
                  <ImagePlus className="w-3.5 h-3.5 text-[#C6A15B]" />
                  <span>{uploadingPhoto ? 'Uploading...' : 'Attach Photo (Optional)'}</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleUploadReviewPhoto}
                    className="hidden"
                  />
                </label>
                {reviewPhotos.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {reviewPhotos.map((p, idx) => (
                      <div key={idx} className="relative">
                        <img src={p} alt="" className="w-12 h-12 rounded-lg object-cover border border-[#E8E8E8]" />
                        <button
                          type="button"
                          onClick={() => setReviewPhotos((prev) => prev.filter((_, i) => i !== idx))}
                          className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-[#111111] text-white flex items-center justify-center"
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <button
                type="submit"
                disabled={submittingReview}
                className="w-full h-11 rounded-full bg-[#111111] hover:bg-[#2a2a2a] text-white text-xs font-bold uppercase tracking-wider disabled:opacity-60"
              >
                {submittingReview ? 'Submitting...' : 'Submit Review'}
              </button>
            </form>
          </div>
        </div>

        {/* Related Products */}
        {related.length > 0 && (
          <div className="mt-16 pt-12 border-t border-[#E8E8E8]">
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#111111] mb-8">
              You May Also Like
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {related.map((item) => (
                <ProductCard key={item.id} product={item} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Lightbox Image Zoom */}
      {zoomOpen && product.images[selectedImageIdx] && (
        <div
          className="dm-backdrop-in fixed inset-0 z-50 bg-[#111111]/90 backdrop-blur-xs flex items-center justify-center p-6 cursor-zoom-out"
          onClick={() => setZoomOpen(false)}
        >
          <button
            type="button"
            onClick={() => setZoomOpen(false)}
            className="absolute top-5 right-5 w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center cursor-pointer"
            aria-label="Close zoomed preview"
          >
            <X className="w-5 h-5" />
          </button>
          <img
            src={product.images[selectedImageIdx]}
            alt={product.name}
            referrerPolicy="no-referrer"
            className="dm-modal-in max-w-full max-h-full rounded-2xl object-contain shadow-2xl"
          />
        </div>
      )}
    </div>
  );
}
