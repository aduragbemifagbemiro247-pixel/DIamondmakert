# Zora Market — Production Deployment & WordPress/WooCommerce Guide

## 1. Architecture Overview
- **Frontend**: React 19 + Vite + Tailwind CSS SPA served by Express (`server.ts`).
- **Backend Commerce Bridge**: Express (`server.ts`, `server/storeEngine.ts`, `server/woocommerce.ts`) communicating server-to-server with WordPress & WooCommerce REST API v3 (`/wp-json/wc/v3/*`) and the custom WordPress plugin (`wordpress-plugin/zora-commerce-bridge/zora-commerce-bridge.php`).
- **Authentication & Customer Data**: Firebase Authentication (Google Sign-In + Email/Password) + Firestore (`users/{uid}`, `addresses`, `wishlist`) protected by Eight-Pillars `firestore.rules`. Server-side endpoints verify Firebase ID tokens via `firebase-admin/auth`.
- **Payments**: Server-side Paystack (`/api/payments/paystack/*`, `/api/webhooks/paystack`), Flutterwave (`/api/payments/flutterwave/*`, `/api/webhooks/flutterwave`), Direct Bank Transfer with manual receipt upload & admin confirmation, and Pay on Delivery (COD) with Nigerian state/amount validation.

---

## 2. Hosting & Domain Requirements
- **Node.js Server**: Node.js 20+ or 22+ with HTTPS termination (Cloud Run, VPS + Nginx, or Railway).
- **WordPress / WooCommerce Backend**: PHP 8.1+, MySQL 8.0+ / MariaDB 10.6+, WordPress 6.5+, WooCommerce 9.0+, SSL certificate (HTTPS mandatory for REST API Basic Auth & payment webhooks).

---

## 3. WordPress & WooCommerce Setup
1. Install WordPress on your backend domain (e.g., `https://cms.zoramarket.ng`).
2. Install and activate **WooCommerce**. Set Store Currency to **Nigerian Naira (`NGN`)** and Country to **Nigeria**.
3. Copy the folder `wordpress-plugin/zora-commerce-bridge/` into `/wp-content/plugins/` on your WordPress server and activate **Zora Commerce Bridge**.
4. In WordPress `wp-config.php`, define a strong shared secret:
   ```php
   define('ZORA_BRIDGE_SECRET', 'your-long-random-secret');
   ```
5. In WordPress Admin → **WooCommerce → Settings → Advanced → REST API**, create a Read/Write API key (`ck_...` and `cs_...`).
6. Configure `WOOCOMMERCE_URL`, `WC_CONSUMER_KEY`, `WC_CONSUMER_SECRET`, and `WP_BRIDGE_SECRET` in your Node environment variables (or enter them in `/admin` → **Store Settings**).

---

## 4. Firebase & Google Sign-In Configuration
1. **Google Sign-In**: Provisioned via Firebase Auth. In Firebase Console → **Authentication → Settings → Authorized domains**, ensure your production domain (`zoramarket.ng`) is added.
2. **Email & Password Sign-In**: To enable customer registration and password reset via email/password, open Firebase Console → **Authentication → Sign-in method**, click **Add new provider → Email/Password**, and enable it.
3. **Administrator Access**: Set `ADMIN_EMAILS="owner@yourdomain.com"` in environment variables. Only verified Firebase accounts whose email matches `ADMIN_EMAILS` can access `/api/admin/*` and `/admin`.
4. **Firestore Security Rules**: Review `firestore.rules` before broad production traffic.

---

## 5. Payment Gateway Configuration (Test Mode → Live Mode)
### Paystack
1. Obtain `pk_test_...` and `sk_test_...` (or live keys) from Paystack Dashboard → Settings → API Keys & Webhooks.
2. Configure Webhook URL in Paystack Dashboard:
   `https://YOURDOMAIN.com/api/webhooks/paystack`
3. Enter keys in `/admin` → **Payment Settings → Paystack** (or `PAYSTACK_SECRET_KEY` env var). Secret keys are never sent to the browser.

### Flutterwave
1. Obtain `FLWPUBK_...`, `FLWSECK_...`, and create a Webhook Secret Hash in Flutterwave Dashboard → Settings → API & Webhooks.
2. Configure Webhook URL in Flutterwave Dashboard:
   `https://YOURDOMAIN.com/api/webhooks/flutterwave`
3. Enter keys in `/admin` → **Payment Settings → Flutterwave**.

### Bank Transfer & Pay on Delivery
- Manage Nigerian corporate NUBAN account details, transfer deadlines, supported COD states, and COD fees directly inside `/admin` → **Payment Settings**.

---

## 6. Launch & Security Checklist
- [ ] HTTPS enforced across both Node frontend/API and WordPress backend.
- [ ] `WOOCOMMERCE_URL`, `WC_CONSUMER_KEY`, `WC_CONSUMER_SECRET` configured and verified green in `/admin` → Store Settings.
- [ ] `ADMIN_EMAILS` restricted strictly to store owner accounts.
- [ ] Paystack & Flutterwave tested in Test Mode before switching to Live keys.
- [ ] Automated daily MySQL/WordPress database backups enabled.
- [ ] `npm run build` executed cleanly and process started via `npm start`.
