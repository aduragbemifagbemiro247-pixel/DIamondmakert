# Security Specification & Payload-First TDD

## 1. Data Invariants
1. **Strict PII Isolation**: Customer profile documents (`/users/{userId}`), saved addresses (`/users/{userId}/addresses/{addressId}`), and wishlists (`/users/{userId}/wishlist/{productId}`) are readable and writable ONLY by the verified account owner (`request.auth.uid == userId`) or a verified administrator.
2. **No Self-Assigned Admin Privileges**: A user cannot assign `role`, `isAdmin`, or write into `/admins/{adminId}` via client SDK. Google Sign-In never grants admin access on its own.
3. **Immutable Ownership & Timestamps**: `uid` and `createdAt` cannot change after document creation. Timestamps must match `request.time`.
4. **Zero-Trust WooCommerce Authority**: Product prices, inventory, payment gateway secret keys, and order fulfillment remain governed on the server (`server.ts` / WooCommerce REST API) and never trust client totals or client payment status claims.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Unauthenticated User Profile Write**: `{ uid: "user_1", email: "a@b.com", displayName: "Hack" }` with `auth == null` -> `PERMISSION_DENIED`.
2. **Cross-Tenant PII Read**: Authenticated `user_A` reads `/users/user_B` -> `PERMISSION_DENIED`.
3. **Privilege Escalation Shadow Field**: Authenticated `user_A` creates `/users/user_A` with extra field `{ isAdmin: true, role: "administrator" }` -> `PERMISSION_DENIED`.
4. **Admin Collection Self-Write**: Authenticated `user_A` writes `/admins/user_A` -> `PERMISSION_DENIED`.
5. **Email Spoofing Without Verification**: User with `email: "aduragbemifagbemiro247@gmail.com"` and `email_verified: false` tries admin read -> `PERMISSION_DENIED`.
6. **Identity Spoofing on Create**: Authenticated `user_A` creates `/users/user_A` with `{ uid: "user_B" }` -> `PERMISSION_DENIED`.
7. **Immutable Field Tampering**: Authenticated `user_A` updates `/users/user_A` changing `uid` or `createdAt` -> `PERMISSION_DENIED`.
8. **Client Timestamp Forgery**: Authenticated `user_A` creates `/users/user_A` with `createdAt: "2020-01-01T00:00:00Z"` instead of server `request.time` -> `PERMISSION_DENIED`.
9. **ID Poisoning Attack**: Authenticated `user_A` creates address at `/users/user_A/addresses/../../../evil` or 500-char ID -> `PERMISSION_DENIED`.
10. **Denial-of-Wallet String Overflow**: Authenticated `user_A` creates address with 50KB `street` string -> `PERMISSION_DENIED`.
11. **Invalid Nigerian Phone Pattern**: Authenticated `user_A` saves address with malformed phone `"not-a-phone"` -> `PERMISSION_DENIED`.
12. **Blanket Collection Listing**: Authenticated `user_A` queries `collection(db, "users")` -> `PERMISSION_DENIED`.
