import { Filter, Heart, Search, ShoppingBag, SlidersHorizontal, X } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { ProductCard } from '../components/ProductCard.tsx';
import { useStore } from '../context/StoreContext.tsx';
import type { Product, ProductVariation } from '../types/commerce.ts';
import { calculateDiscountPercentage, formatNaira } from '../utils/currency.ts';
import { stripHtml } from '../utils/sanitizeHtml.ts';

interface ShopPageProps {
  categorySlug?: string;
}

export function ShopPage({ categorySlug }: ShopPageProps) {
  const {
    products,
    categories,
    searchQuery,
    setSearchQuery,
    navigate,
    addToCart,
    isInWishlist,
    toggleWishlist,
  } = useStore();

  const [sortBy, setSortBy] = useState<'featured' | 'newest' | 'price_asc' | 'price_desc'>('featured');
  const [inStockOnly, setInStockOnly] = useState(false);
  const [dealsOnly, setDealsOnly] = useState(false);
  const [maxPrice, setMaxPrice] = useState<number>(300000);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);
  const [selectedVariation, setSelectedVariation] = useState<ProductVariation | null>(null);

  const visibleCategories = useMemo(() => {
    return [...categories]
      .filter((c) => c.visible !== false)
      .sort((a, b) => (a.sortOrder ?? 99) - (b.sortOrder ?? 99));
  }, [categories]);

  const activeCategory = useMemo(
    () => (categorySlug ? visibleCategories.find((c) => c.slug === categorySlug) : undefined),
    [categorySlug, visibleCategories]
  );

  // Include child subcategory slugs when viewing a parent category (e.g. Shoes -> sneakers, loafers, heels)
  const matchingCategoryIds = useMemo(() => {
    if (!activeCategory) return null;
    const childIds = visibleCategories
      .filter((c) => c.parentId === activeCategory.id)
      .map((c) => c.id);
    return new Set([activeCategory.id, ...childIds]);
  }, [activeCategory, visibleCategories]);

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = products.filter((p) => {
      if (p.status !== 'publish') return false;

      if (matchingCategoryIds) {
        const matchDirect = matchingCategoryIds.has(p.categoryId);
        const matchSub = p.subcategoryId ? matchingCategoryIds.has(p.subcategoryId) : false;
        const matchSlug = p.categorySlug === activeCategory?.slug;
        if (!matchDirect && !matchSub && !matchSlug) return false;
      }

      if (inStockOnly && !p.inStock) return false;

      const effective = p.salePrice && p.salePrice < p.price ? p.salePrice : p.price;
      if (dealsOnly && (!p.salePrice || p.salePrice >= p.price)) return false;
      if (effective > maxPrice) return false;

      if (q) {
        const hay = `${p.name} ${p.brand || ''} ${p.shortDescription} ${p.categoryName} ${
          p.subcategoryName || ''
        } ${p.tags.join(' ')} ${p.sku}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    return [...list].sort((a, b) => {
      const pA = a.salePrice && a.salePrice < a.price ? a.salePrice : a.price;
      const pB = b.salePrice && b.salePrice < b.price ? b.salePrice : b.price;
      switch (sortBy) {
        case 'price_asc':
          return pA - pB;
        case 'price_desc':
          return pB - pA;
        case 'newest':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'featured':
        default:
          return (b.featured ? 1 : 0) - (a.featured ? 1 : 0) || b.salesCount - a.salesCount;
      }
    });
  }, [products, matchingCategoryIds, activeCategory, inStockOnly, dealsOnly, maxPrice, searchQuery, sortBy]);

  const openQuickView = (product: Product) => {
    setQuickViewProduct(product);
    setSelectedVariation(null);
  };

  const resetFilters = () => {
    setSearchQuery('');
    setInStockOnly(false);
    setDealsOnly(false);
    setMaxPrice(300000);
    navigate('/shop');
  };

  const renderFiltersContent = () => (
    <div className="space-y-6 text-sm">
      <div>
        <h3 className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#8C6D34] mb-3">
          Categories
        </h3>
        <ul className="space-y-1.5">
          <li>
            <button
              type="button"
              onClick={() => {
                navigate('/shop');
                setMobileFilterOpen(false);
              }}
              className={`w-full text-left px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                !categorySlug
                  ? 'bg-[#111111] text-white font-semibold'
                  : 'text-[#333333] hover:bg-[#FAF8F3]'
              }`}
            >
              All Shoes &amp; Wears
            </button>
          </li>
          {visibleCategories.map((cat) => (
            <li key={cat.id} className={cat.parentId ? 'pl-4' : ''}>
              <button
                type="button"
                onClick={() => {
                  navigate(`/category/${cat.slug}`);
                  setMobileFilterOpen(false);
                }}
                className={`w-full text-left px-3 py-2 rounded-xl text-xs transition-colors flex items-center justify-between ${
                  categorySlug === cat.slug
                    ? 'bg-[#111111] text-white font-semibold'
                    : 'text-[#333333] hover:bg-[#FAF8F3]'
                }`}
              >
                <span>{cat.parentId ? `— ${cat.name}` : cat.name}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="pt-5 border-t border-[#E8E8E8]">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#8C6D34]">
            Max Budget
          </h3>
          <span className="font-mono-num text-xs font-bold text-[#111111]">
            {formatNaira(maxPrice)}
          </span>
        </div>
        <input
          type="range"
          min={10000}
          max={300000}
          step={5000}
          value={maxPrice}
          onChange={(e) => setMaxPrice(Number(e.target.value))}
          className="w-full accent-[#111111]"
        />
        <div className="flex justify-between text-[10px] text-neutral-400 font-mono-num mt-1">
          <span>₦10k</span>
          <span>₦300k+</span>
        </div>
      </div>

      <div className="pt-5 border-t border-[#E8E8E8] space-y-2.5">
        <label className="flex items-center gap-2.5 cursor-pointer text-xs text-[#333333]">
          <input
            type="checkbox"
            checked={inStockOnly}
            onChange={(e) => setInStockOnly(e.target.checked)}
            className="w-4 h-4 rounded accent-[#111111]"
          />
          In-stock pieces only
        </label>
        <label className="flex items-center gap-2.5 cursor-pointer text-xs text-[#333333]">
          <input
            type="checkbox"
            checked={dealsOnly}
            onChange={(e) => setDealsOnly(e.target.checked)}
            className="w-4 h-4 rounded accent-[#111111]"
          />
          Special offers only
        </label>
      </div>

      <button
        type="button"
        onClick={resetFilters}
        className="w-full h-10 rounded-full border border-[#E8E8E8] hover:border-[#111111] text-xs font-semibold text-[#111111] transition-colors"
      >
        Reset All Filters
      </button>
    </div>
  );

  return (
    <div className="bg-white min-h-[75vh]">
      {/* Editorial Category Banner */}
      <div className="bg-[#FAF8F3] border-b border-[#E8E8E8]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#8C6D34]">
            Diamond Market · Shoes &amp; Wears
          </p>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-[#111111] mt-1.5">
            {activeCategory ? activeCategory.name : 'Complete Collection'}
          </h1>
          <p className="text-sm text-[#333333] mt-2 max-w-2xl">
            {activeCategory?.description ||
              'Browse curated footwear, refined two-piece sets, casualwear, and accessories crafted for everyday confidence.'}
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 mb-8 border-b border-[#E8E8E8]">
          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={() => setMobileFilterOpen(true)}
              className="lg:hidden inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#E8E8E8] bg-[#FAF8F3] text-xs font-semibold text-[#111111]"
            >
              <Filter className="w-3.5 h-3.5 text-[#C6A15B]" />
              Filter
            </button>
            <p className="text-xs text-[#333333]">
              Showing <strong className="font-mono-num text-[#111111]">{filteredProducts.length}</strong>{' '}
              {filteredProducts.length === 1 ? 'piece' : 'pieces'}
            </p>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FAF8F3] border border-[#E8E8E8] text-xs text-[#111111]"
              >
                Search: “{searchQuery}” <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="relative flex-1 sm:w-56">
              <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search pieces..."
                className="w-full h-10 pl-9 pr-3 rounded-full border border-[#E8E8E8] bg-[#FAF8F3] text-xs focus:outline-none focus:border-[#C6A15B]"
              />
            </div>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="h-10 px-4 rounded-full border border-[#E8E8E8] bg-white text-xs font-semibold text-[#111111] focus:outline-none focus:border-[#C6A15B]"
            >
              <option value="featured">Featured Edit</option>
              <option value="newest">Newest Arrivals</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Desktop Sidebar Filters */}
          <aside className="hidden lg:block lg:col-span-3">
            <div className="sticky top-32 bg-white border border-[#E8E8E8] rounded-2xl p-6">
              {renderFiltersContent()}
            </div>
          </aside>

          {/* Product Grid */}
          <div className="lg:col-span-9">
            {filteredProducts.length === 0 ? (
              <div className="rounded-3xl bg-[#FAF8F3] border border-[#E8E8E8] p-12 text-center">
                <SlidersHorizontal className="w-8 h-8 text-[#C6A15B] mx-auto mb-3" />
                <h2 className="font-display text-2xl font-bold text-[#111111]">
                  No matching pieces found
                </h2>
                <p className="text-sm text-[#333333] mt-1 mb-6">
                  Try widening your budget filter or browsing all Shoes &amp; Wears.
                </p>
                <button
                  type="button"
                  onClick={resetFilters}
                  className="px-6 py-3 rounded-full bg-[#111111] text-white text-xs font-bold uppercase tracking-wider"
                >
                  Clear Filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onQuickView={openQuickView}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Filter Drawer */}
      {mobileFilterOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-[#111111]/55"
            onClick={() => setMobileFilterOpen(false)}
          />
          <div className="relative w-80 max-w-[85vw] bg-white h-full p-6 overflow-y-auto z-10 shadow-2xl">
            <div className="flex items-center justify-between pb-4 mb-5 border-b border-[#E8E8E8]">
              <h2 className="font-display font-bold text-lg text-[#111111]">Filter Collection</h2>
              <button
                type="button"
                onClick={() => setMobileFilterOpen(false)}
                className="p-1.5 rounded-full hover:bg-[#FAF8F3]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {renderFiltersContent()}
          </div>
        </div>
      )}

      {/* Quick View Modal */}
      {quickViewProduct && (
        <div className="no-print fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#111111]/65 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-3xl w-full overflow-hidden shadow-2xl border border-[#E8E8E8] grid grid-cols-1 md:grid-cols-2 relative max-h-[90vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setQuickViewProduct(null)}
              className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full bg-white border border-[#E8E8E8] flex items-center justify-center text-[#111111]"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="bg-[#FAF8F3] aspect-square md:aspect-auto">
              <img
                src={quickViewProduct.images[0]}
                alt={quickViewProduct.name}
                className="w-full h-full object-cover"
              />
            </div>

            <div className="p-6 sm:p-8 flex flex-col justify-between gap-5">
              {(() => {
                const isVar =
                  quickViewProduct.type === 'variable' && quickViewProduct.variations.length > 0;
                const price = selectedVariation
                  ? selectedVariation.salePrice && selectedVariation.salePrice < selectedVariation.price
                    ? selectedVariation.salePrice
                    : selectedVariation.price
                  : quickViewProduct.salePrice && quickViewProduct.salePrice < quickViewProduct.price
                  ? quickViewProduct.salePrice
                  : quickViewProduct.price;
                const base = selectedVariation ? selectedVariation.price : quickViewProduct.price;
                const disc = calculateDiscountPercentage(
                  base,
                  selectedVariation ? selectedVariation.salePrice : quickViewProduct.salePrice
                );

                return (
                  <>
                    <div className="space-y-3">
                      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#8C6D34]">
                        {quickViewProduct.subcategoryName || quickViewProduct.categoryName}
                      </p>
                      <h3 className="font-display text-2xl font-bold text-[#111111]">
                        {quickViewProduct.name}
                      </h3>
                      <div className="flex items-baseline gap-2.5">
                        <span className="font-mono-num text-2xl font-bold text-[#111111]">
                          {formatNaira(price)}
                        </span>
                        {disc && (
                          <span className="font-mono-num text-sm text-neutral-400 line-through">
                            {formatNaira(base)}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-[#333333] line-clamp-3">
                        {quickViewProduct.shortDescription || stripHtml(quickViewProduct.description)}
                      </p>

                      {isVar && (
                        <div className="pt-2">
                          <p className="text-xs font-bold uppercase tracking-wider text-[#111111] mb-2">
                            Select Size / Option <span className="text-[#8C6D34]">*</span>
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {quickViewProduct.variations.map((v) => {
                              const label = Object.values(v.attributes).join(' · ') || v.sku;
                              const active = selectedVariation?.id === v.id;
                              return (
                                <button
                                  key={v.id}
                                  type="button"
                                  disabled={!v.inStock || v.stockQuantity <= 0}
                                  onClick={() => setSelectedVariation(v)}
                                  className={`px-3.5 py-2 rounded-full text-xs font-semibold border transition-all ${
                                    active
                                      ? 'bg-[#111111] text-white border-[#111111]'
                                      : !v.inStock || v.stockQuantity <= 0
                                      ? 'bg-neutral-100 text-neutral-400 border-neutral-200 line-through cursor-not-allowed'
                                      : 'bg-white text-[#111111] border-[#E8E8E8] hover:border-[#C6A15B]'
                                  }`}
                                >
                                  {label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2.5 pt-2">
                      <div className="flex gap-2.5">
                        <button
                          type="button"
                          disabled={!quickViewProduct.inStock || (isVar && !selectedVariation)}
                          onClick={() => {
                            const ok = addToCart(
                              quickViewProduct,
                              1,
                              selectedVariation || undefined
                            );
                            if (ok) setQuickViewProduct(null);
                          }}
                          className="flex-1 h-11 rounded-full bg-[#111111] hover:bg-[#2a2a2a] disabled:bg-neutral-200 disabled:text-neutral-500 text-white text-xs font-bold uppercase tracking-wider inline-flex items-center justify-center gap-2 transition-colors"
                        >
                          <ShoppingBag className="w-4 h-4 text-[#C6A15B]" />
                          {isVar && !selectedVariation ? 'Select Option First' : 'Add to Bag'}
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleWishlist(quickViewProduct.id)}
                          className={`w-11 h-11 rounded-full border flex items-center justify-center ${
                            isInWishlist(quickViewProduct.id)
                              ? 'bg-[#111111] border-[#111111] text-[#C6A15B]'
                              : 'border-[#E8E8E8] text-[#111111]'
                          }`}
                        >
                          <Heart
                            className={`w-4 h-4 ${
                              isInWishlist(quickViewProduct.id) ? 'fill-current' : ''
                            }`}
                          />
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const slug = quickViewProduct.slug;
                          setQuickViewProduct(null);
                          navigate(`/product/${slug}`);
                        }}
                        className="w-full h-10 rounded-full border border-[#E8E8E8] hover:bg-[#FAF8F3] text-xs font-semibold uppercase tracking-wider text-[#111111]"
                      >
                        View Full Details
                      </button>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
