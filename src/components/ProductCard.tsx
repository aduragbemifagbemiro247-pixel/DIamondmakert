import { Check, Eye, Heart, ShoppingBag, SlidersHorizontal, Star } from 'lucide-react';
import React, { useRef, useState } from 'react';
import { useStore } from '../context/StoreContext.tsx';
import { useMotionPreferences } from '../hooks/useMotionPreferences.ts';
import type { Product } from '../types/commerce.ts';
import { calculateDiscountPercentage, formatNaira } from '../utils/currency.ts';

interface ProductCardProps {
  product: Product;
  onQuickView?: (product: Product) => void;
}

export function ProductCard({ product, onQuickView }: ProductCardProps) {
  const { navigate, addToCart, isInWishlist, toggleWishlist, cms } = useStore();
  const { animationsEnabled, enable3DTilt, productHoverStyle, tiltMaxDeg } =
    useMotionPreferences();

  const cardRef = useRef<HTMLElement>(null);
  const rafRef = useRef<number | null>(null);
  const [tilt, setTilt] = useState<{ rx: number; ry: number; gx: number; gy: number; active: boolean }>({
    rx: 0,
    ry: 0,
    gx: 50,
    gy: 50,
    active: false,
  });
  const [addedFlash, setAddedFlash] = useState(false);

  const effectivePrice =
    product.salePrice && product.salePrice < product.price ? product.salePrice : product.price;
  const discount = calculateDiscountPercentage(product.price, product.salePrice);
  const wished = isInWishlist(product.id);
  const isVariable = product.type === 'variable' && product.variations.length > 0;
  const cardStyle = cms?.theme?.cardStyle || 'bordered';

  // Keep a strict max of 1 clean badge per product card
  const singleTag = !product.inStock
    ? { label: 'Sold Out', style: 'bg-[var(--dm-black)]/85 text-white' }
    : discount
    ? { label: `-${discount}%`, style: 'bg-[var(--dm-gold)] text-[var(--dm-black)]' }
    : product.isNewArrival
    ? { label: 'New', style: 'bg-[var(--dm-black)] text-white' }
    : null;

  const handleMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    if (!enable3DTilt || !cardRef.current) return;
    const clientX = e.clientX;
    const clientY = e.clientY;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      if (!cardRef.current) return;
      const rect = cardRef.current.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const px = (clientX - rect.left) / rect.width;
      const py = (clientY - rect.top) / rect.height;
      const ry = (px - 0.5) * 2 * tiltMaxDeg;
      const rx = -(py - 0.5) * 2 * tiltMaxDeg;
      setTilt({
        rx,
        ry,
        gx: Math.round(px * 100),
        gy: Math.round(py * 100),
        active: true,
      });
    });
  };

  const handleMouseLeave = () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (tilt.active || tilt.rx !== 0 || tilt.ry !== 0) {
      setTilt({ rx: 0, ry: 0, gx: 50, gy: 50, active: false });
    }
  };

  const handlePrimaryAction = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!product.inStock) return;
    if (isVariable) {
      if (onQuickView) {
        onQuickView(product);
      } else {
        navigate(`/product/${product.slug}`);
      }
      return;
    }
    const ok = addToCart(product, 1);
    if (ok) {
      setAddedFlash(true);
      window.setTimeout(() => setAddedFlash(false), 1100);
    }
  };

  const cardSurfaceClass =
    cardStyle === 'elevated'
      ? 'bg-white border border-transparent shadow-md shadow-black/5 hover:shadow-2xl hover:shadow-black/10'
      : cardStyle === 'flat'
      ? 'bg-[var(--dm-ivory)] border border-transparent hover:border-[var(--dm-gold)]/60 hover:shadow-lg hover:shadow-black/5'
      : 'bg-white border border-[#E8E8E8] hover:border-[var(--dm-gold)]/70 hover:shadow-xl hover:shadow-black/10';

  const liftClass =
    animationsEnabled && productHoverStyle !== 'minimal'
      ? 'hover:-translate-y-1.5 active:scale-[0.99]'
      : '';

  const tiltStyle: React.CSSProperties | undefined = enable3DTilt
    ? {
        transform: tilt.active
          ? `perspective(950px) rotateX(${tilt.rx.toFixed(2)}deg) rotateY(${tilt.ry.toFixed(
              2
            )}deg) translate3d(0, -4px, 0)`
          : 'perspective(950px) rotateX(0deg) rotateY(0deg) translate3d(0, 0, 0)',
        transition: tilt.active
          ? 'transform 90ms ease-out, box-shadow 260ms ease, border-color 260ms ease'
          : 'transform 420ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 300ms ease, border-color 300ms ease',
      }
    : undefined;

  const secondaryImg = product.images[1];

  return (
    <article
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={tiltStyle}
      className={`group relative dm-card-shape overflow-hidden flex flex-col transition-all duration-300 ${cardSurfaceClass} ${
        !enable3DTilt ? liftClass : ''
      }`}
    >
      {/* Subtle Cursor Specular Glare Overlay (Desktop 3D Tilt only, non-blocking) */}
      {enable3DTilt && (
        <div
          aria-hidden="true"
          style={{
            opacity: tilt.active ? 1 : 0,
            background: `radial-gradient(280px circle at ${tilt.gx}% ${tilt.gy}%, rgba(198,161,91,0.14), transparent 70%)`,
          }}
          className="pointer-events-none absolute inset-0 z-10 transition-opacity duration-300"
        />
      )}

      {/* Studio Ivory Thumbnail */}
      <div
        onClick={() => navigate(`/product/${product.slug}`)}
        className="relative aspect-[4/4.2] bg-[var(--dm-ivory)] overflow-hidden cursor-pointer"
      >
        {product.images[0] ? (
          <>
            <img
              src={product.images[0]}
              alt={product.name}
              loading="lazy"
              referrerPolicy="no-referrer"
              className={`w-full h-full object-cover transition-transform duration-500 ${
                animationsEnabled && productHoverStyle !== 'minimal' ? 'group-hover:scale-105' : ''
              }`}
            />
            {secondaryImg && animationsEnabled && productHoverStyle !== 'minimal' && (
              <img
                src={secondaryImg}
                alt=""
                aria-hidden="true"
                loading="lazy"
                referrerPolicy="no-referrer"
                className="pointer-events-none absolute inset-0 w-full h-full object-cover opacity-0 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500"
              />
            )}
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xs text-neutral-400">
            {cms?.header?.storeNameDisplay || 'Diamond Market'}
          </div>
        )}

        {singleTag && (
          <span
            className={`absolute top-3 left-3 z-20 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider shadow-xs ${singleTag.style}`}
          >
            {singleTag.label}
          </span>
        )}

        {/* Quick Actions Overlay */}
        <div className="absolute top-3 right-3 z-20 flex flex-col gap-1.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleWishlist(product.id);
            }}
            aria-label={wished ? 'Remove from wishlist' : 'Save to wishlist'}
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 shadow-sm border cursor-pointer active:scale-90 ${
              wished
                ? 'bg-[var(--dm-black)] text-[var(--dm-gold)] border-[var(--dm-black)] scale-105'
                : 'bg-white/95 text-[#333333] border-[#E8E8E8] hover:text-[var(--dm-black)] hover:scale-105'
            }`}
          >
            <Heart className={`w-4 h-4 transition-transform duration-200 ${wished ? 'fill-current scale-110' : ''}`} />
          </button>

          {onQuickView && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onQuickView(product);
              }}
              aria-label="Quick view product"
              className="w-9 h-9 rounded-full bg-white/95 text-[#333333] border border-[#E8E8E8] hover:text-[var(--dm-black)] hover:scale-105 active:scale-90 flex items-center justify-center opacity-100 sm:opacity-0 sm:translate-y-1 sm:group-hover:opacity-100 sm:group-hover:translate-y-0 transition-all duration-200 shadow-sm cursor-pointer"
            >
              <Eye className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Product Body */}
      <div className="relative z-10 p-4 sm:p-5 flex-1 flex flex-col justify-between gap-3.5">
        <div>
          <div className="flex items-center justify-between gap-2 text-[11px] uppercase tracking-[0.14em] text-[#333333]/70 mb-1.5">
            <span className="truncate font-semibold">
              {product.subcategoryName || product.categoryName}
            </span>
            {product.reviewCount > 0 && (
              <span className="inline-flex items-center gap-0.5 text-[var(--dm-black)] font-medium shrink-0">
                <Star className="w-3 h-3 fill-[var(--dm-gold)] text-[var(--dm-gold)]" />
                {product.averageRating.toFixed(1)}
              </span>
            )}
          </div>

          <h3
            onClick={() => navigate(`/product/${product.slug}`)}
            className="font-display font-semibold text-base text-[var(--dm-black)] line-clamp-2 cursor-pointer hover:text-[#8C6D34] transition-colors leading-snug min-h-[2.75rem]"
          >
            {product.name}
          </h3>
        </div>

        <div className="space-y-3 pt-1">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="font-mono-num text-base sm:text-lg font-bold text-[var(--dm-black)]">
              {formatNaira(effectivePrice)}
            </span>
            {discount && (
              <span className="font-mono-num text-xs text-neutral-400 line-through">
                {formatNaira(product.price)}
              </span>
            )}
          </div>

          <button
            type="button"
            disabled={!product.inStock}
            onClick={handlePrimaryAction}
            className={`dm-btn-interactive w-full h-10 sm:h-10 dm-btn-shape text-xs font-bold uppercase tracking-wider inline-flex items-center justify-center gap-1.5 cursor-pointer ${
              !product.inStock
                ? 'bg-[var(--dm-ivory)] text-neutral-400 cursor-not-allowed border border-[#E8E8E8]'
                : addedFlash
                ? 'bg-[#C6A15B] text-[#111111] border border-[#C6A15B]'
                : isVariable
                ? 'bg-[var(--dm-ivory)] text-[var(--dm-black)] border border-[var(--dm-black)]/20 hover:bg-[var(--dm-black)] hover:text-white'
                : 'bg-[var(--dm-black)] hover:opacity-95 text-white'
            }`}
          >
            {!product.inStock ? (
              'Out of Stock'
            ) : addedFlash ? (
              <>
                <Check className="w-3.5 h-3.5" />
                Added to Bag
              </>
            ) : isVariable ? (
              <>
                <SlidersHorizontal className="w-3.5 h-3.5 text-[var(--dm-gold)]" />
                Select Size / Option
              </>
            ) : (
              <>
                <ShoppingBag className="w-3.5 h-3.5 text-[var(--dm-gold)]" />
                Add to Bag
              </>
            )}
          </button>
        </div>
      </div>
    </article>
  );
}
