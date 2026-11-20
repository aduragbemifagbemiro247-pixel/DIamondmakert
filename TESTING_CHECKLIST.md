# Zora Market — End-to-End Testing Checklist

## 1. Customer Storefront Journey
- [ ] Homepage loads with Hero, Category Strip, Tabbed Collection, and no console errors.
- [ ] Search bar filters products by name, category, description, and tags.
- [ ] Category routes (`/category/:slug`) and Shop filters (max price, in-stock, sort) work cleanly.
- [ ] Product detail page (`/product/:slug`) renders gallery, variations, stock, specs, and reviews.
- [ ] Adding items to cart persists across page refreshes (`localStorage`).
- [ ] Wishlist works as guest and syncs to Firestore upon Google Sign-In.

## 2. Authentication & Authorization
- [ ] Google Sign-In authenticates via Firebase popup and verifies token on `/api/auth/session`.
- [ ] Non-admin customer signing in with Google gets `isAdmin: false` and is blocked (`403 Forbidden`) from `/api/admin/*` and `/admin`.
- [ ] Customer account dashboard (`/account`) saves profile, Nigerian phone, and Nigerian delivery addresses to Firestore.
- [ ] Customer cannot query another customer's order via `/api/customer/orders/:id`.

## 3. Checkout & Payment Gateways
- [ ] Guest checkout validates Nigerian phone numbers and calculates shipping by state on the server.
- [ ] Coupon `ZORA10` applies 10% discount on orders ≥ ₦50,000.
- [ ] Disabling any gateway in `/admin` → Payment Settings immediately removes it from `/checkout`.
- [ ] Bank Transfer order creates an `on-hold` order, displays NUBAN details, accepts receipt upload (`/api/orders/:id/receipt`), and remains unpaid until admin manually clicks **Verify & Confirm Payment Received**.
- [ ] Pay on Delivery enforces state & order amount limits, records `paymentStatus: unpaid`, and blocks high-value prepaid-only devices (`codAllowed: false`).
- [ ] Paystack & Flutterwave verify transactions server-side via API + signed webhooks before marking an order paid.

## 4. Private Admin Dashboard (`/admin`)
- [ ] Dashboard KPIs & charts reflect genuine order/product counts with clean empty states when 0 orders exist.
- [ ] Admin can create, edit, upload images for, archive, and delete products.
- [ ] Admin can update inventory counts and observe low-stock alerts.
- [ ] Admin can update order status, assign courier & tracking number, export CSV, and print receipts.
- [ ] Security Audit Log records administrative mutations.
