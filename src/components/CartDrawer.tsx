import { ArrowRight, Minus, Plus, ShoppingBag, Trash2, X } from 'lucide-react';
import React from 'react';
import { useStore } from '../context/StoreContext.tsx';
import { formatNaira } from '../utils/currency.ts';

export function CartDrawer() {
  const {
    cart,
    cartCount,
    cartSubtotal,
    isCartOpen,
    setIsCartOpen,
    updateCartQuantity,
    removeFromCart,
    navigate,
  } = useStore();

  if (!isCartOpen) return null;

  return (
    <div className="no-print fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Shopping Bag">
      <div
        className="dm-backdrop-in fixed inset-0 bg-[#111111]/55 backdrop-blur-xs"
        onClick={() => setIsCartOpen(false)}
      />

      <aside className="dm-drawer-in relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col z-10 border-l border-[#E8E8E8]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#E8E8E8] bg-[#FAF8F3] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-full bg-[#111111] text-[#C6A15B] flex items-center justify-center shadow-xs">
              <ShoppingBag className="w-4 h-4" />
            </span>
            <div>
              <h2 className="font-display font-bold text-lg text-[#111111] leading-none">
                Shopping Bag
              </h2>
              <p className="text-xs text-[#333333]/75 mt-1 font-mono-num">
                {cartCount} {cartCount === 1 ? 'piece' : 'pieces'} selected
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsCartOpen(false)}
            className="p-2 rounded-full hover:bg-black/5 text-[#333333] active:scale-90 transition-all cursor-pointer"
            aria-label="Close bag"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-12">
              <div className="w-16 h-16 rounded-full bg-[#FAF8F3] border border-[#E8E8E8] flex items-center justify-center text-[#C6A15B] mb-4">
                <ShoppingBag className="w-7 h-7" />
              </div>
              <h3 className="font-display font-bold text-lg text-[#111111] mb-1">
                Your bag is empty
              </h3>
              <p className="text-sm text-[#333333]/75 max-w-xs mb-6 leading-relaxed">
                Explore handcrafted footwear, tailored two-pieces, and refined wears from Diamond Market.
              </p>
              <button
                type="button"
                onClick={() => {
                  setIsCartOpen(false);
                  navigate('/shop');
                }}
                className="dm-btn-interactive px-6 py-3 dm-btn-shape bg-[#111111] hover:bg-[#2a2a2a] text-white text-xs font-bold uppercase tracking-wider cursor-pointer"
              >
                Explore Collection
              </button>
            </div>
          ) : (
            cart.map((item) => (
              <div
                key={item.key}
                className="flex gap-3.5 p-3.5 rounded-2xl border border-[#E8E8E8] bg-[#FAF8F3]/60 hover:border-[#C6A15B]/50 transition-all duration-200"
              >
                <img
                  src={item.image}
                  alt={item.name}
                  referrerPolicy="no-referrer"
                  className="w-20 h-20 rounded-xl object-cover bg-white border border-[#E8E8E8] shrink-0 cursor-pointer hover:scale-[1.03] transition-transform"
                  onClick={() => {
                    setIsCartOpen(false);
                    navigate(`/product/${item.slug}`);
                  }}
                />
                <div className="flex-1 min-w-0">
                  <button
                    type="button"
                    onClick={() => {
                      setIsCartOpen(false);
                      navigate(`/product/${item.slug}`);
                    }}
                    className="font-display font-semibold text-sm text-[#111111] text-left line-clamp-2 hover:text-[#8C6D34] transition-colors cursor-pointer"
                  >
                    {item.name}
                  </button>
                  {item.attributes && Object.keys(item.attributes).length > 0 && (
                    <p className="text-[11px] text-[#333333]/75 mt-1">
                      {Object.entries(item.attributes)
                        .map(([k, v]) => `${k}: ${v}`)
                        .join(' · ')}
                    </p>
                  )}
                  <p className="font-mono-num text-sm font-bold text-[#111111] mt-1.5">
                    {formatNaira(item.unitPrice)}
                  </p>

                  <div className="flex items-center justify-between mt-3">
                    <div className="inline-flex items-center rounded-full border border-[#E8E8E8] bg-white">
                      <button
                        type="button"
                        onClick={() => updateCartQuantity(item.key, item.quantity - 1)}
                        className="w-8 h-8 flex items-center justify-center text-[#333333] hover:text-[#111111] active:scale-90 transition-transform cursor-pointer"
                        aria-label="Decrease quantity"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="w-7 text-center text-xs font-bold font-mono-num">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateCartQuantity(item.key, item.quantity + 1)}
                        disabled={item.quantity >= item.maxStock}
                        className="w-8 h-8 flex items-center justify-center text-[#333333] hover:text-[#111111] active:scale-90 transition-transform disabled:opacity-40 cursor-pointer"
                        aria-label="Increase quantity"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeFromCart(item.key)}
                      className="p-2 text-neutral-400 hover:text-rose-700 active:scale-90 transition-all cursor-pointer"
                      aria-label="Remove item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {cart.length > 0 && (
          <div className="p-6 border-t border-[#E8E8E8] bg-[#FAF8F3] space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-[#333333]">Subtotal</span>
              <span className="font-mono-num text-lg font-bold text-[#111111]">
                {formatNaira(cartSubtotal)}
              </span>
            </div>
            <p className="text-xs text-[#333333]/75">
              Ogbomoso &amp; nationwide Nigerian shipping calculated at checkout.
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setIsCartOpen(false);
                  navigate('/shop');
                }}
                className="dm-btn-interactive h-11 dm-btn-shape border border-[#111111]/25 bg-white hover:bg-[#111111]/5 text-xs font-semibold uppercase tracking-wider text-[#111111] cursor-pointer"
              >
                Continue
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsCartOpen(false);
                  navigate('/checkout');
                }}
                className="dm-btn-interactive h-11 dm-btn-shape bg-[#111111] hover:bg-[#2a2a2a] text-white text-xs font-bold uppercase tracking-wider inline-flex items-center justify-center gap-1.5 cursor-pointer"
              >
                Checkout <ArrowRight className="w-4 h-4 text-[#C6A15B]" />
              </button>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
