import { Building2, CreditCard, Lock, ShieldCheck, Tag, Truck } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useStore } from '../context/StoreContext.tsx';
import { isValidNigerianPhone, NIGERIAN_STATES } from '../data/nigeria.ts';
import { apiFetch } from '../lib/api.ts';
import type { Order, PaymentMethodId, ShippingZone } from '../types/commerce.ts';
import { formatNaira } from '../utils/currency.ts';

export function CheckoutPage() {
  const {
    cart,
    cartSubtotal,
    clearCart,
    user,
    profile,
    addresses,
    paymentGateways,
    navigate,
    pushToast,
    refreshStore,
  } = useStore();

  const defaultAddr = addresses.find((a) => a.isDefault) || addresses[0];

  const [firstName, setFirstName] = useState(
    defaultAddr?.firstName || user?.displayName?.split(' ')[0] || ''
  );
  const [lastName, setLastName] = useState(
    defaultAddr?.lastName || user?.displayName?.split(' ').slice(1).join(' ') || ''
  );
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(defaultAddr?.phone || profile?.phone || '');
  const [street, setStreet] = useState(defaultAddr?.street || '');
  const [city, setCity] = useState(defaultAddr?.city || '');
  const [state, setState] = useState(defaultAddr?.state || 'Oyo');
  const [deliveryInstructions, setDeliveryInstructions] = useState('');
  const [pickupAtHub, setPickupAtHub] = useState(false);

  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discount: number } | null>(null);
  const [couponMessage, setCouponMessage] = useState<string | null>(null);

  const [shippingInfo, setShippingInfo] = useState<{ zone: ShippingZone | null; shippingTotal: number }>({
    zone: null,
    shippingTotal: 0,
  });

  const [selectedMethod, setSelectedMethod] = useState<PaymentMethodId | ''>(
    paymentGateways[0]?.id || ''
  );
  const [acceptedTerms, setAcceptedTerms] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedMethod && paymentGateways.length > 0) {
      setSelectedMethod(paymentGateways[0].id);
    } else if (
      selectedMethod &&
      paymentGateways.length > 0 &&
      !paymentGateways.some((g) => g.id === selectedMethod)
    ) {
      setSelectedMethod(paymentGateways[0].id);
    }
  }, [paymentGateways, selectedMethod]);

  useEffect(() => {
    if (user?.email && !email) setEmail(user.email);
    if (defaultAddr) {
      if (!firstName) setFirstName(defaultAddr.firstName);
      if (!lastName) setLastName(defaultAddr.lastName);
      if (!phone) setPhone(defaultAddr.phone);
      if (!street) setStreet(defaultAddr.street);
      if (!city) setCity(defaultAddr.city);
      setState(defaultAddr.state);
    }
  }, [user, defaultAddr]);

  useEffect(() => {
    const discounted = Math.max(0, cartSubtotal - (appliedCoupon?.discount || 0));
    apiFetch<{ zone: ShippingZone | null; shippingTotal: number }>('/api/shipping/calculate', {
      method: 'POST',
      body: JSON.stringify({ state, subtotal: discounted, pickupAtHub }),
    })
      .then((res) => setShippingInfo(res))
      .catch(() => {});
  }, [state, cartSubtotal, appliedCoupon, pickupAtHub]);

  const applySavedAddress = (addrId: string) => {
    const addr = addresses.find((a) => a.id === addrId);
    if (!addr) return;
    setFirstName(addr.firstName);
    setLastName(addr.lastName);
    setPhone(addr.phone);
    setStreet(addr.street);
    setCity(addr.city);
    setState(addr.state);
  };

  const handleApplyCoupon = async () => {
    if (!couponInput.trim()) return;
    try {
      const res = await apiFetch<{ valid: boolean; discount: number; message: string }>(
        '/api/coupons/validate',
        {
          method: 'POST',
          body: JSON.stringify({ code: couponInput.trim(), subtotal: cartSubtotal }),
        }
      );
      setCouponMessage(res.message);
      if (res.valid) {
        setAppliedCoupon({ code: couponInput.trim().toUpperCase(), discount: res.discount });
      } else {
        setAppliedCoupon(null);
      }
    } catch (err) {
      setCouponMessage(err instanceof Error ? err.message : 'Coupon check failed');
    }
  };

  const codGateway = paymentGateways.find((g) => g.id === 'cod');
  const codAllowedCart = cart.every((i) => i.codAllowed);
  const codRules = codGateway?.codRules;
  const codEligible =
    Boolean(codGateway) &&
    codAllowedCart &&
    (!codRules ||
      (cartSubtotal >= codRules.minOrderAmount &&
        (codRules.maxOrderAmount === 0 || cartSubtotal <= codRules.maxOrderAmount) &&
        (codRules.supportedStates.includes('ALL') || codRules.supportedStates.includes(state))));

  const codFee = selectedMethod === 'cod' && codRules ? codRules.additionalFee : 0;
  const discountTotal = appliedCoupon?.discount || 0;
  const finalTotal = Math.max(0, cartSubtotal - discountTotal + shippingInfo.shippingTotal + codFee);

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (cart.length === 0) {
      setFormError('Your shopping bag is empty.');
      return;
    }
    if (!isValidNigerianPhone(phone)) {
      setFormError('Please enter a valid Nigerian phone number (e.g., 07051959290 or +2347051959290).');
      return;
    }
    if (!selectedMethod) {
      setFormError('No active payment method is selected.');
      return;
    }
    if (!acceptedTerms) {
      setFormError('Please accept Diamond Market Terms and Conditions to proceed.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiFetch<{ order: Order; gatewayRedirectUrl?: string }>('/api/checkout', {
        method: 'POST',
        body: JSON.stringify({
          billing: {
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            email: email.trim(),
            phone: phone.trim(),
            street: street.trim(),
            city: city.trim(),
            state,
            country: 'NG',
          },
          deliveryInstructions,
          items: cart.map((i) => ({
            productId: i.productId,
            variationId: i.variationId,
            quantity: i.quantity,
          })),
          couponCode: appliedCoupon?.code || null,
          paymentMethod: selectedMethod,
          pickupAtHub,
        }),
      });

      sessionStorage.setItem('dm_last_order', JSON.stringify(res.order));
      clearCart();
      await refreshStore();

      if (res.gatewayRedirectUrl) {
        window.location.href = res.gatewayRedirectUrl;
        return;
      }

      pushToast(`Order ${res.order.orderNumber} placed`, 'success');
      navigate(`/order/${res.order.orderNumber}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Checkout failed.';
      setFormError(msg);
      pushToast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (cart.length === 0) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <h1 className="font-display text-2xl font-bold text-[#111111] mb-2">
          Your shopping bag is empty
        </h1>
        <p className="text-sm text-[#333333]/75 mb-6">
          Add shoes or wears from Diamond Market before proceeding to checkout.
        </p>
        <button
          type="button"
          onClick={() => navigate('/shop')}
          className="px-6 py-3 bg-[#111111] text-white text-xs font-bold uppercase tracking-wider rounded-full cursor-pointer"
        >
          Explore Collection
        </button>
      </div>
    );
  }

  return (
    <div className="bg-[#FAF8F3] min-h-screen py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#8C6D34]">
              Diamond Market · Secure Checkout
            </p>
            <h1 className="font-display text-3xl sm:text-4xl font-bold text-[#111111] mt-1">
              Delivery &amp; Payment
            </h1>
          </div>
          {!user && (
            <button
              type="button"
              onClick={() => navigate('/auth')}
              className="text-xs font-semibold text-[#111111] underline hover:text-[#8C6D34] cursor-pointer self-start"
            >
              Returning customer? Sign in with Google or Email
            </button>
          )}
        </div>

        <form onSubmit={handlePlaceOrder} className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-7 space-y-6">
            {addresses.length > 0 && (
              <div className="bg-white border border-[#E8E8E8] rounded-2xl p-6">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#111111] mb-3">
                  Saved Nigerian Addresses
                </p>
                <div className="flex flex-wrap gap-2">
                  {addresses.map((addr) => (
                    <button
                      key={addr.id}
                      type="button"
                      onClick={() => applySavedAddress(addr.id)}
                      className="px-3.5 py-2 border border-[#E8E8E8] rounded-full text-xs font-medium hover:border-[#111111] cursor-pointer"
                    >
                      {addr.label} · {addr.city}, {addr.state}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-white border border-[#E8E8E8] rounded-2xl p-6 space-y-5">
              <h2 className="font-display text-lg font-bold text-[#111111]">
                1. Recipient &amp; Nigerian Delivery Address
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="chk-first" className="block text-xs font-semibold text-[#111111] mb-1.5">
                    First Name
                  </label>
                  <input
                    id="chk-first"
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full border border-[#E8E8E8] rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#111111]"
                  />
                </div>
                <div>
                  <label htmlFor="chk-last" className="block text-xs font-semibold text-[#111111] mb-1.5">
                    Last Name
                  </label>
                  <input
                    id="chk-last"
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full border border-[#E8E8E8] rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#111111]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="chk-email" className="block text-xs font-semibold text-[#111111] mb-1.5">
                    Email Address
                  </label>
                  <input
                    id="chk-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full border border-[#E8E8E8] rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#111111]"
                  />
                </div>
                <div>
                  <label htmlFor="chk-phone" className="block text-xs font-semibold text-[#111111] mb-1.5">
                    Nigerian Phone / WhatsApp
                  </label>
                  <input
                    id="chk-phone"
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0705 195 9290"
                    className="w-full border border-[#E8E8E8] rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#111111]"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="chk-street" className="block text-xs font-semibold text-[#111111] mb-1.5">
                  Delivery Location / Landmark
                </label>
                <input
                  id="chk-street"
                  type="text"
                  required
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                  placeholder="House number, street, estate or landmark"
                  className="w-full border border-[#E8E8E8] rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#111111]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="chk-city" className="block text-xs font-semibold text-[#111111] mb-1.5">
                    City / LGA
                  </label>
                  <input
                    id="chk-city"
                    type="text"
                    required
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Ogbomoso / Ibadan / Ikeja"
                    className="w-full border border-[#E8E8E8] rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#111111]"
                  />
                </div>
                <div>
                  <label htmlFor="chk-state" className="block text-xs font-semibold text-[#111111] mb-1.5">
                    State
                  </label>
                  <select
                    id="chk-state"
                    value={state}
                    onChange={(e) => {
                      setState(e.target.value);
                      setPickupAtHub(false);
                    }}
                    className="w-full border border-[#E8E8E8] rounded-xl px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:border-[#111111]"
                  >
                    {NIGERIAN_STATES.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#111111] mb-1.5">
                    Country
                  </label>
                  <input
                    type="text"
                    disabled
                    value="Nigeria (NG)"
                    className="w-full border border-[#E8E8E8] bg-[#FAF8F3] rounded-xl px-3.5 py-2.5 text-sm text-[#333333]/70"
                  />
                </div>
              </div>

              {shippingInfo.zone?.pickupAvailable && (
                <label className="flex items-start gap-3 p-3.5 bg-[#FAF8F3] border border-[#E8E8E8] rounded-xl cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pickupAtHub}
                    onChange={(e) => setPickupAtHub(e.target.checked)}
                    className="mt-0.5 accent-[#111111]"
                  />
                  <div className="text-xs">
                    <p className="font-semibold text-[#111111]">
                      Coordinate Ogbomoso Dispatch Pickup (Free Shipping)
                    </p>
                    <p className="text-[#333333]/75 mt-0.5">{shippingInfo.zone.pickupAddress}</p>
                  </div>
                </label>
              )}

              <div>
                <label htmlFor="chk-notes" className="block text-xs font-semibold text-[#111111] mb-1.5">
                  Delivery / Sizing Notes (Optional)
                </label>
                <textarea
                  id="chk-notes"
                  rows={2}
                  value={deliveryInstructions}
                  onChange={(e) => setDeliveryInstructions(e.target.value)}
                  placeholder="Preferred delivery timing, park drop-off preference, or landmark info..."
                  className="w-full border border-[#E8E8E8] rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-[#111111]"
                />
              </div>
            </div>

            {/* Active Payment Gateways */}
            <div className="bg-white border border-[#E8E8E8] rounded-2xl p-6 space-y-4">
              <h2 className="font-display text-lg font-bold text-[#111111]">
                2. Select Payment Method
              </h2>

              {paymentGateways.length === 0 ? (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                  No payment gateways are currently enabled by the store administrator.
                </div>
              ) : (
                <div className="space-y-3">
                  {paymentGateways.map((gw) => {
                    const isCod = gw.id === 'cod';
                    const disabled = isCod && !codEligible;
                    const selected = selectedMethod === gw.id;

                    return (
                      <label
                        key={gw.id}
                        className={`block border rounded-2xl p-4 transition-colors ${
                          disabled
                            ? 'opacity-50 cursor-not-allowed bg-neutral-50 border-[#E8E8E8]'
                            : selected
                            ? 'border-[#111111] bg-[#FAF8F3] cursor-pointer'
                            : 'border-[#E8E8E8] hover:border-[#C6A15B] cursor-pointer'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <input
                            type="radio"
                            name="paymentMethod"
                            value={gw.id}
                            disabled={disabled}
                            checked={selected}
                            onChange={() => setSelectedMethod(gw.id)}
                            className="mt-1 accent-[#111111]"
                          />
                          <div className="flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-display text-sm font-bold text-[#111111] flex items-center gap-2">
                                {gw.id === 'bacs' ? (
                                  <Building2 className="w-4 h-4 text-[#C6A15B]" />
                                ) : gw.id === 'cod' ? (
                                  <Truck className="w-4 h-4 text-[#C6A15B]" />
                                ) : (
                                  <CreditCard className="w-4 h-4 text-[#C6A15B]" />
                                )}
                                {gw.title}
                              </span>
                              {gw.testMode && (
                                <span className="text-[11px] font-medium text-[#333333]/65">
                                  Test Mode
                                </span>
                              )}
                              {isCod && gw.codRules && gw.codRules.additionalFee > 0 && (
                                <span className="text-xs font-mono-num font-semibold text-[#111111]">
                                  +{formatNaira(gw.codRules.additionalFee)} fee
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-[#333333]/75 mt-1">{gw.description}</p>

                            {isCod && !codEligible && (
                              <p className="text-xs text-rose-700 mt-1.5 font-medium">
                                {!codAllowedCart
                                  ? 'Unavailable for prepaid-only pieces in your bag.'
                                  : `Available for orders between ${formatNaira(
                                      codRules?.minOrderAmount || 0
                                    )} and ${formatNaira(codRules?.maxOrderAmount || 0)} in supported states.`}
                              </p>
                            )}

                            {selected && gw.id === 'bacs' && gw.bankDetails && (
                              <div className="mt-3 p-3 bg-white border border-[#E8E8E8] rounded-xl text-xs space-y-1">
                                <p className="font-semibold text-[#111111]">
                                  {gw.bankDetails.bankName} · {gw.bankDetails.accountNumber}
                                </p>
                                <p className="text-[#333333]/80">
                                  Account Name: {gw.bankDetails.accountName}
                                </p>
                                <p className="text-[#333333]/75">
                                  Your unique Diamond Market reference &amp; receipt upload will appear right after placing the order.
                                </p>
                              </div>
                            )}

                            {selected && gw.instructions && gw.id !== 'bacs' && (
                              <p className="mt-2 text-xs text-[#333333]">{gw.instructions}</p>
                            )}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="bg-white border border-[#E8E8E8] rounded-2xl p-6 space-y-5 sticky top-28">
              <h2 className="font-display text-lg font-bold text-[#111111]">
                Order Summary
              </h2>

              <div className="divide-y divide-[#E8E8E8] max-h-72 overflow-y-auto pr-1">
                {cart.map((item) => (
                  <div key={item.key} className="py-3 flex items-center gap-3">
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-14 h-14 object-cover rounded-xl bg-[#FAF8F3] border border-[#E8E8E8] shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-[#111111] truncate">{item.name}</p>
                      {item.attributes && Object.keys(item.attributes).length > 0 && (
                        <p className="text-[11px] text-[#8C6D34]">
                          {Object.values(item.attributes).join(' · ')}
                        </p>
                      )}
                      <p className="text-xs text-[#333333]/75 font-mono-num">
                        Qty {item.quantity} × {formatNaira(item.unitPrice)}
                      </p>
                    </div>
                    <p className="text-xs font-bold text-[#111111] font-mono-num shrink-0">
                      {formatNaira(item.unitPrice * item.quantity)}
                    </p>
                  </div>
                ))}
              </div>

              <div className="pt-3 border-t border-[#E8E8E8]">
                <label htmlFor="coupon-code" className="block text-xs font-semibold text-[#111111] mb-1.5">
                  Promo Code
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      id="coupon-code"
                      type="text"
                      value={couponInput}
                      onChange={(e) => setCouponInput(e.target.value)}
                      placeholder="e.g. DIAMOND10"
                      className="w-full border border-[#E8E8E8] rounded-full pl-8 pr-3 py-2 text-xs uppercase font-mono-num focus:outline-none focus:border-[#111111]"
                    />
                    <Tag className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  </div>
                  <button
                    type="button"
                    onClick={handleApplyCoupon}
                    className="px-5 py-2 bg-[#111111] text-white text-xs font-bold uppercase tracking-wider rounded-full hover:bg-[#2a2a2a] cursor-pointer"
                  >
                    Apply
                  </button>
                </div>
                {couponMessage && (
                  <p
                    className={`text-xs mt-1.5 ${
                      appliedCoupon ? 'text-emerald-700 font-medium' : 'text-rose-700'
                    }`}
                  >
                    {couponMessage}
                  </p>
                )}
              </div>

              <div className="pt-3 border-t border-[#E8E8E8] space-y-2 text-sm">
                <div className="flex justify-between text-[#333333]/80">
                  <span>Subtotal</span>
                  <span className="font-mono-num text-[#111111]">{formatNaira(cartSubtotal)}</span>
                </div>
                {discountTotal > 0 && (
                  <div className="flex justify-between text-emerald-700">
                    <span>Discount ({appliedCoupon?.code})</span>
                    <span className="font-mono-num">-{formatNaira(discountTotal)}</span>
                  </div>
                )}
                <div className="flex justify-between text-[#333333]/80">
                  <span>
                    Shipping ({shippingInfo.zone?.name || state})
                    {shippingInfo.zone?.estimatedDays ? ` · ${shippingInfo.zone.estimatedDays}` : ''}
                  </span>
                  <span className="font-mono-num text-[#111111]">
                    {shippingInfo.shippingTotal === 0 ? 'Free' : formatNaira(shippingInfo.shippingTotal)}
                  </span>
                </div>
                {codFee > 0 && (
                  <div className="flex justify-between text-[#333333]/80">
                    <span>Pay on Delivery Fee</span>
                    <span className="font-mono-num text-[#111111]">{formatNaira(codFee)}</span>
                  </div>
                )}
                <div className="pt-3 border-t border-[#E8E8E8] flex justify-between items-baseline">
                  <span className="font-display text-base font-bold text-[#111111]">Total (NGN)</span>
                  <span className="font-display text-xl font-bold text-[#111111] font-mono-num">
                    {formatNaira(finalTotal)}
                  </span>
                </div>
              </div>

              <label className="flex items-start gap-2.5 text-xs text-[#333333]/80 cursor-pointer">
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  className="mt-0.5 accent-[#111111]"
                />
                <span>
                  I agree to Diamond Market&apos;s{' '}
                  <button
                    type="button"
                    onClick={() => navigate('/policy/terms')}
                    className="underline text-[#111111] cursor-pointer"
                  >
                    Terms &amp; Conditions
                  </button>{' '}
                  and{' '}
                  <button
                    type="button"
                    onClick={() => navigate('/policy/returns')}
                    className="underline text-[#111111] cursor-pointer"
                  >
                    Return Policy
                  </button>
                  .
                </span>
              </label>

              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                  {formError}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting || paymentGateways.length === 0}
                className="w-full py-3.5 px-6 bg-[#111111] text-white text-xs font-bold uppercase tracking-[0.14em] rounded-full hover:bg-[#C6A15B] hover:text-[#111111] disabled:opacity-50 transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                <Lock className="w-4 h-4" />
                <span>{submitting ? 'Processing Order...' : `Place Order · ${formatNaira(finalTotal)}`}</span>
              </button>

              <p className="text-[11px] text-[#333333]/75 flex items-center justify-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-[#C6A15B]" />
                <span>Totals verified on server before gateway settlement.</span>
              </p>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
