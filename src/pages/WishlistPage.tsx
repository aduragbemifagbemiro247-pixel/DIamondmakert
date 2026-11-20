import { Heart, ShoppingBag, SlidersHorizontal, Trash2 } from 'lucide-react';
import React from 'react';
import { useStore } from '../context/StoreContext.tsx';
import { formatNaira } from '../utils/currency.ts';

export function WishlistPage() {
  const { products, wishlistIds, toggleWishlist, addToCart, navigate } = useStore();
  const savedProducts = products.filter((p) => wishlistIds.includes(p.id));

  return (
    <div className="bg-white min-h-[70vh]">
      <div className="bg-[#FAF8F3] border-b border-[#E8E8E8]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#8C6D34] mb-1">
            Saved Collection
          </p>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-[#111111]">
            Your Wishlist ({savedProducts.length})
          </h1>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {savedProducts.length === 0 ? (
          <div className="bg-[#FAF8F3] border border-[#E8E8E8] rounded-3xl p-12 text-center max-w-lg mx-auto">
            <Heart className="w-10 h-10 text-[#C6A15B] mx-auto mb-3" />
            <h2 className="font-display text-xl font-bold text-[#111111] mb-2">
              No saved pieces yet
            </h2>
            <p className="text-sm text-[#333333]/80 mb-6 leading-relaxed">
              Tap the heart icon on any Diamond Market shoe, two-piece, or accessory to save it here.
            </p>
            <button
              type="button"
              onClick={() => navigate('/shop')}
              className="px-6 py-3 rounded-full bg-[#111111] text-white text-xs font-bold uppercase tracking-wider cursor-pointer"
            >
              Explore Collection
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {savedProducts.map((product) => {
              const price =
                product.salePrice && product.salePrice < product.price
                  ? product.salePrice
                  : product.price;
              const isVariable = product.type === 'variable' && product.variations.length > 0;

              return (
                <div
                  key={product.id}
                  className="border border-[#E8E8E8] rounded-2xl overflow-hidden flex flex-col bg-white hover:border-[#C6A15B]/70 transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => navigate(`/product/${product.slug}`)}
                    className="aspect-[4/4.2] bg-[#FAF8F3] overflow-hidden cursor-pointer"
                  >
                    <img
                      src={product.images[0]}
                      alt={product.name}
                      className="w-full h-full object-cover"
                    />
                  </button>
                  <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between gap-4">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.14em] text-[#8C6D34] font-semibold">
                        {product.subcategoryName || product.categoryName}
                      </p>
                      <button
                        type="button"
                        onClick={() => navigate(`/product/${product.slug}`)}
                        className="text-left font-display text-base font-semibold text-[#111111] hover:text-[#8C6D34] mt-1 cursor-pointer"
                      >
                        {product.name}
                      </button>
                      <p className="text-base font-bold text-[#111111] font-mono-num mt-2">
                        {formatNaira(price)}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={!product.inStock}
                        onClick={() => {
                          if (isVariable) {
                            navigate(`/product/${product.slug}`);
                            return;
                          }
                          const added = addToCart(product, 1);
                          if (added) {
                            toggleWishlist(product.id);
                          }
                        }}
                        className="flex-1 h-10 px-3 rounded-full bg-[#111111] hover:bg-[#2a2a2a] text-white text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        {isVariable ? (
                          <>
                            <SlidersHorizontal className="w-3.5 h-3.5 text-[#C6A15B]" />
                            <span>Select Size</span>
                          </>
                        ) : (
                          <>
                            <ShoppingBag className="w-3.5 h-3.5 text-[#C6A15B]" />
                            <span>Move to Bag</span>
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleWishlist(product.id)}
                        aria-label="Remove from wishlist"
                        className="w-10 h-10 rounded-full border border-[#E8E8E8] flex items-center justify-center text-neutral-400 hover:text-rose-700 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
