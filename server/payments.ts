import crypto from 'crypto';

export interface GatewayInitResult {
  authorizationUrl: string;
  reference: string;
  accessCode?: string;
}

export interface GatewayVerifyResult {
  verified: boolean;
  status: 'paid' | 'failed' | 'pending';
  amountNgn: number;
  transactionId: string;
  gatewayMessage: string;
}

export async function initializePaystackTransaction(params: {
  secretKey: string;
  email: string;
  amountNgn: number;
  reference: string;
  callbackUrl: string;
  metadata?: Record<string, unknown>;
}): Promise<GatewayInitResult> {
  if (!params.secretKey || !params.secretKey.startsWith('sk_')) {
    throw new Error(
      'Paystack secret key is not configured. Add a valid Paystack sk_test_ or sk_live_ secret key in Admin -> Payment Settings.'
    );
  }

  const response = await fetch('https://api.paystack.co/transaction/initialize', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.secretKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: params.email,
      amount: Math.round(params.amountNgn * 100), // kobo
      currency: 'NGN',
      reference: params.reference,
      callback_url: params.callbackUrl,
      metadata: params.metadata || {},
    }),
    signal: AbortSignal.timeout(15000),
  });

  const data = (await response.json()) as {
    status: boolean;
    message: string;
    data?: { authorization_url: string; access_code: string; reference: string };
  };

  if (!response.ok || !data.status || !data.data?.authorization_url) {
    throw new Error(data.message || 'Paystack initialization failed.');
  }

  return {
    authorizationUrl: data.data.authorization_url,
    accessCode: data.data.access_code,
    reference: data.data.reference,
  };
}

export async function verifyPaystackTransaction(
  secretKey: string,
  reference: string
): Promise<GatewayVerifyResult> {
  if (!secretKey || !secretKey.startsWith('sk_')) {
    throw new Error('Paystack secret key is missing on server.');
  }

  const response = await fetch(
    `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
    {
      headers: {
        Authorization: `Bearer ${secretKey}`,
      },
      signal: AbortSignal.timeout(15000),
    }
  );

  const data = (await response.json()) as {
    status: boolean;
    message: string;
    data?: {
      id: number;
      status: string;
      amount: number;
      currency: string;
      reference: string;
      gateway_response?: string;
    };
  };

  if (!response.ok || !data.status || !data.data) {
    return {
      verified: false,
      status: 'failed',
      amountNgn: 0,
      transactionId: reference,
      gatewayMessage: data.message || 'Paystack verification failed',
    };
  }

  const tx = data.data;
  const isSuccess = tx.status === 'success' && tx.currency === 'NGN';
  return {
    verified: isSuccess,
    status: isSuccess ? 'paid' : tx.status === 'abandoned' || tx.status === 'failed' ? 'failed' : 'pending',
    amountNgn: Math.round(tx.amount / 100),
    transactionId: String(tx.id),
    gatewayMessage: tx.gateway_response || tx.status,
  };
}

export function verifyPaystackWebhookSignature(
  rawBody: Buffer,
  signatureHeader: string | undefined,
  secretKey: string
): boolean {
  if (!signatureHeader || !secretKey) return false;
  const computed = crypto.createHmac('sha512', secretKey).update(rawBody).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(signatureHeader));
  } catch {
    return false;
  }
}

export async function initializeFlutterwaveTransaction(params: {
  secretKey: string;
  email: string;
  name: string;
  phone: string;
  amountNgn: number;
  txRef: string;
  redirectUrl: string;
}): Promise<GatewayInitResult> {
  if (!params.secretKey || !params.secretKey.includes('FLWSECK')) {
    throw new Error(
      'Flutterwave secret key is not configured. Add a valid FLWSECK_TEST or FLWSECK secret key in Admin -> Payment Settings.'
    );
  }

  const response = await fetch('https://api.flutterwave.com/v3/payments', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.secretKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      tx_ref: params.txRef,
      amount: Math.round(params.amountNgn),
      currency: 'NGN',
      redirect_url: params.redirectUrl,
      customer: {
        email: params.email,
        phonenumber: params.phone,
        name: params.name,
      },
      customizations: {
        title: 'Diamond Market Checkout',
        description: `Order Payment (${params.txRef})`,
      },
    }),
    signal: AbortSignal.timeout(15000),
  });

  const data = (await response.json()) as {
    status: string;
    message: string;
    data?: { link: string };
  };

  if (!response.ok || data.status !== 'success' || !data.data?.link) {
    throw new Error(data.message || 'Flutterwave initialization failed.');
  }

  return {
    authorizationUrl: data.data.link,
    reference: params.txRef,
  };
}

export async function verifyFlutterwaveTransaction(
  secretKey: string,
  transactionId: string
): Promise<GatewayVerifyResult> {
  if (!secretKey) {
    throw new Error('Flutterwave secret key is missing on server.');
  }

  const response = await fetch(
    `https://api.flutterwave.com/v3/transactions/${encodeURIComponent(transactionId)}/verify`,
    {
      headers: {
        Authorization: `Bearer ${secretKey}`,
      },
      signal: AbortSignal.timeout(15000),
    }
  );

  const data = (await response.json()) as {
    status: string;
    message: string;
    data?: {
      id: number;
      status: string;
      amount: number;
      currency: string;
      tx_ref: string;
      processor_response?: string;
    };
  };

  if (!response.ok || data.status !== 'success' || !data.data) {
    return {
      verified: false,
      status: 'failed',
      amountNgn: 0,
      transactionId,
      gatewayMessage: data.message || 'Flutterwave verification failed',
    };
  }

  const tx = data.data;
  const isSuccess = tx.status === 'successful' && tx.currency === 'NGN';
  return {
    verified: isSuccess,
    status: isSuccess ? 'paid' : tx.status === 'failed' ? 'failed' : 'pending',
    amountNgn: Number(tx.amount || 0),
    transactionId: String(tx.id),
    gatewayMessage: tx.processor_response || tx.status,
  };
}

export function verifyFlutterwaveWebhookHash(
  verifHashHeader: string | undefined,
  configuredWebhookHash: string
): boolean {
  if (!verifHashHeader || !configuredWebhookHash) return false;
  try {
    return crypto.timingSafeEqual(
      Buffer.from(verifHashHeader),
      Buffer.from(configuredWebhookHash)
    );
  } catch {
    return false;
  }
}

export function maskSecret(value?: string): string {
  if (!value) return '';
  if (value.length <= 10) return '••••••••';
  return `${value.slice(0, 7)}••••${value.slice(-4)}`;
}
