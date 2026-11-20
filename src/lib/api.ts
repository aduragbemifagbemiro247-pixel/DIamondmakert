import { auth } from './firebase.ts';

export async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> | undefined),
  };

  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const currentUser = auth.currentUser;
  if (currentUser) {
    try {
      const token = await currentUser.getIdToken();
      headers.Authorization = `Bearer ${token}`;
    } catch {
      // Proceed unauthenticated if token fetch fails
    }
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const text = await response.text();
  let json: Record<string, unknown> = {};
  try {
    json = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    json = {};
  }

  if (!response.ok) {
    const message =
      (typeof json.error === 'string' && json.error) ||
      (typeof json.message === 'string' && json.message) ||
      `Request failed (${response.status})`;
    throw new Error(message);
  }

  return json as T;
}

const RIDER_TOKEN_KEY = 'dm_rider_session_token';

export function getRiderToken(): string | null {
  try {
    return window.sessionStorage.getItem(RIDER_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setRiderToken(token: string | null): void {
  try {
    if (token) {
      window.sessionStorage.setItem(RIDER_TOKEN_KEY, token);
    } else {
      window.sessionStorage.removeItem(RIDER_TOKEN_KEY);
    }
  } catch {
    // Ignore sessionStorage unavailable
  }
}

export async function riderFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> | undefined),
  };

  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const token = getRiderToken();
  if (token) {
    headers['X-Rider-Token'] = token;
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  const text = await response.text();
  let json: Record<string, unknown> = {};
  try {
    json = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    json = {};
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      if (url === '/api/rider/me' || url === '/api/rider/deliveries') {
        setRiderToken(null);
      }
    }
    const message =
      (typeof json.error === 'string' && json.error) ||
      (typeof json.message === 'string' && json.message) ||
      `Request failed (${response.status})`;
    throw new Error(message);
  }

  return json as T;
}
