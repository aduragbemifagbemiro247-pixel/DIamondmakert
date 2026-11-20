import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth, type DecodedIdToken } from 'firebase-admin/auth';
import fs from 'fs';
import path from 'path';

interface FirebaseAppletConfig {
  projectId: string;
  firestoreDatabaseId?: string;
}

function loadFirebaseConfig(): FirebaseAppletConfig {
  const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  if (!fs.existsSync(configPath)) {
    throw new Error('firebase-applet-config.json is missing. Run Firebase setup first.');
  }
  return JSON.parse(fs.readFileSync(configPath, 'utf-8')) as FirebaseAppletConfig;
}

const firebaseConfig = loadFirebaseConfig();

const adminApp = getApps().length
  ? getApp()
  : initializeApp({
      projectId: firebaseConfig.projectId,
    });

const adminAuth = getAuth(adminApp);

const SESSION_SECRET_FILE = path.resolve(process.cwd(), '.runtime-secrets.json');

function getSessionSecret(): string {
  if (process.env.RIDER_SESSION_SECRET && process.env.RIDER_SESSION_SECRET.length >= 16) {
    return process.env.RIDER_SESSION_SECRET;
  }
  try {
    const current = fs.existsSync(SESSION_SECRET_FILE)
      ? (JSON.parse(fs.readFileSync(SESSION_SECRET_FILE, 'utf-8')) as Record<string, string>)
      : {};
    if (current.riderSessionSecret && current.riderSessionSecret.length >= 32) {
      return current.riderSessionSecret;
    }
    const generated = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(
      SESSION_SECRET_FILE,
      JSON.stringify({ ...current, riderSessionSecret: generated }, null, 2),
      { mode: 0o600 }
    );
    return generated;
  } catch {
    return crypto.createHash('sha256').update(firebaseConfig.projectId + ':diamond-rider-key').digest('hex');
  }
}

const RIDER_HMAC_SECRET = getSessionSecret();

export interface AuthenticatedUser {
  uid: string;
  email: string;
  emailVerified: boolean;
  name?: string;
  isAdmin: boolean;
  token: DecodedIdToken;
}

export interface AuthenticatedRider {
  riderId: string;
  riderCode: string;
  fullName: string;
  email: string;
  phone: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser | null;
      rider?: AuthenticatedRider | null;
    }
  }
}

export function getAdminAllowlist(): string[] {
  const envAdmins = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const defaults = ['aduragbemifagbemiro247@gmail.com'];
  return Array.from(new Set([...defaults, ...envAdmins]));
}

export function isAuthorizedAdminEmail(email?: string | null, emailVerified?: boolean): boolean {
  if (!email || !emailVerified) return false;
  return getAdminAllowlist().includes(email.trim().toLowerCase());
}

export async function verifyBearerToken(authHeader?: string): Promise<AuthenticatedUser | null> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const idToken = authHeader.slice('Bearer '.length).trim();
  if (!idToken) return null;

  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    const email = decoded.email || '';
    const emailVerified = Boolean(decoded.email_verified);
    return {
      uid: decoded.uid,
      email,
      emailVerified,
      name: typeof decoded.name === 'string' ? decoded.name : undefined,
      isAdmin: isAuthorizedAdminEmail(email, emailVerified),
      token: decoded,
    };
  } catch {
    return null;
  }
}

export function signRiderToken(payload: AuthenticatedRider, ttlSeconds = 60 * 60 * 12): string {
  const body = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const encoded = Buffer.from(JSON.stringify(body), 'utf-8').toString('base64url');
  const sig = crypto.createHmac('sha256', RIDER_HMAC_SECRET).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifyRiderToken(token?: string | null): AuthenticatedRider | null {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [encoded, sig] = token.split('.');
  if (!encoded || !sig) return null;

  const expectedSig = crypto
    .createHmac('sha256', RIDER_HMAC_SECRET)
    .update(encoded)
    .digest('base64url');

  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expectedSig);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return null;
    }
    const decoded = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf-8')) as AuthenticatedRider & {
      exp?: number;
    };
    if (!decoded.exp || decoded.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return {
      riderId: decoded.riderId,
      riderCode: decoded.riderCode,
      fullName: decoded.fullName,
      email: decoded.email,
      phone: decoded.phone,
    };
  } catch {
    return null;
  }
}

export function extractRiderTokenFromRequest(req: Request): string | null {
  const headerToken = req.headers['x-rider-token'];
  if (typeof headerToken === 'string' && headerToken.trim()) {
    return headerToken.trim();
  }
  const authHeader = req.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Rider ')) {
    return authHeader.slice('Rider '.length).trim();
  }
  const cookieToken = req.cookies?.dm_rider_session;
  if (typeof cookieToken === 'string' && cookieToken.trim()) {
    return cookieToken.trim();
  }
  return null;
}

export async function attachUser(req: Request, _res: Response, next: NextFunction): Promise<void> {
  req.user = await verifyBearerToken(req.headers.authorization);
  req.rider = verifyRiderToken(extractRiderTokenFromRequest(req));
  next();
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.user) {
    req.user = await verifyBearerToken(req.headers.authorization);
  }
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required. Please sign in.' });
    return;
  }
  next();
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.user) {
    req.user = await verifyBearerToken(req.headers.authorization);
  }
  if (!req.user) {
    res.status(401).json({ error: 'Administrator authentication required.' });
    return;
  }
  if (!req.user.emailVerified || !req.user.isAdmin) {
    res.status(403).json({
      error: 'Access denied. Verified store administrator privileges are required.',
    });
    return;
  }
  next();
}

export function verifyCsrfOrigin(req: Request, res: Response, next: NextFunction): void {
  const method = req.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    next();
    return;
  }
  // Skip check for external payment gateway webhooks
  if (req.path.startsWith('/api/webhooks/')) {
    next();
    return;
  }
  const origin = req.headers.origin;
  const host = req.get('host');
  if (origin && host) {
    try {
      const originHost = new URL(origin).host;
      if (originHost !== host) {
        const appUrl = process.env.APP_URL;
        const allowedAppHost = appUrl && appUrl !== 'MY_APP_URL' ? new URL(appUrl).host : null;
        if (originHost !== allowedAppHost) {
          res.status(403).json({ error: 'CSRF protection: Cross-origin request rejected.' });
          return;
        }
      }
    } catch {
      res.status(403).json({ error: 'CSRF protection: Invalid origin header.' });
      return;
    }
  }
  next();
}
