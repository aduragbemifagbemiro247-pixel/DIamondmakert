/**
 * Security Rule Validation Suite (Payload-First TDD Spec)
 * Verifies all 12 Dirty Dozen payloads against the hardened rules structure.
 * Run with Firebase Emulator Suite when testing locally.
 */
export const dirtyDozenSecurityAssertions = [
  { id: 1, name: 'Unauthenticated User Profile Write', path: '/users/user_1', expected: 'PERMISSION_DENIED' },
  { id: 2, name: 'Cross-Tenant PII Read', path: '/users/user_B', expected: 'PERMISSION_DENIED' },
  { id: 3, name: 'Privilege Escalation Shadow Field', payload: { isAdmin: true, role: 'administrator' }, expected: 'PERMISSION_DENIED' },
  { id: 4, name: 'Admin Collection Self-Write', path: '/admins/user_A', expected: 'PERMISSION_DENIED' },
  { id: 5, name: 'Email Spoofing Without Verification', claim: { email_verified: false }, expected: 'PERMISSION_DENIED' },
  { id: 6, name: 'Identity Spoofing on Create', payload: { uid: 'user_B' }, expected: 'PERMISSION_DENIED' },
  { id: 7, name: 'Immutable Field Tampering', payload: { createdAt: 'modified' }, expected: 'PERMISSION_DENIED' },
  { id: 8, name: 'Client Timestamp Forgery', payload: { createdAt: '2020-01-01T00:00:00Z' }, expected: 'PERMISSION_DENIED' },
  { id: 9, name: 'ID Poisoning Attack', path: '/users/user_A/addresses/../../../evil', expected: 'PERMISSION_DENIED' },
  { id: 10, name: 'Denial-of-Wallet String Overflow', payloadSizeBytes: 51200, expected: 'PERMISSION_DENIED' },
  { id: 11, name: 'Invalid Nigerian Phone Pattern', payload: { phone: 'not-a-phone' }, expected: 'PERMISSION_DENIED' },
  { id: 12, name: 'Blanket Collection Listing', path: '/users', expected: 'PERMISSION_DENIED' },
];
