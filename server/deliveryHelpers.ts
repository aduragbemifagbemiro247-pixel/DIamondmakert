import crypto from 'crypto';
import type {
  DeliveryAnalytics,
  DeliveryComplaint,
  DeliveryRecord,
  DeliverySettings,
  DeliveryStatus,
  Order,
  Rider,
  RiderReview,
} from '../src/types/commerce.ts';

export const DELIVERY_STATUS_LABELS: Record<DeliveryStatus, string> = {
  pending_delivery: 'Pending Delivery',
  preparing_order: 'Preparing Order',
  ready_for_pickup: 'Ready for Pickup',
  rider_assigned: 'Rider Assigned',
  picked_up: 'Picked Up',
  out_for_delivery: 'Out for Delivery',
  arrived_at_destination: 'Arrived at Destination',
  awaiting_customer_confirmation: 'Awaiting Customer Confirmation',
  delivered_customer_confirmed: 'Delivered — Customer Confirmed',
  delivery_failed: 'Delivery Failed',
  delivery_disputed: 'Delivery Disputed',
  returned_to_store: 'Returned to Store',
  cancelled: 'Cancelled',
};

export function normalizeDeliveryStatus(raw?: string | null): DeliveryStatus {
  if (!raw) return 'pending_delivery';
  const legacyMap: Record<string, DeliveryStatus> = {
    pending_dispatch: 'pending_delivery',
    packed: 'ready_for_pickup',
    in_transit: 'out_for_delivery',
    delivered: 'awaiting_customer_confirmation',
    returned: 'returned_to_store',
  };
  if (legacyMap[raw]) return legacyMap[raw];
  if (Object.prototype.hasOwnProperty.call(DELIVERY_STATUS_LABELS, raw)) {
    return raw as DeliveryStatus;
  }
  return 'pending_delivery';
}

export function sanitizeText(value: unknown, maxLength = 500): string {
  if (typeof value !== 'string') return '';
  return value.replace(/[<>]/g, '').trim().slice(0, maxLength);
}

export function hashPassword(password: string, existingSalt?: string): { salt: string; hash: string } {
  const salt = existingSalt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}

export function verifyPassword(password: string, salt: string, storedHash: string): boolean {
  if (!password || !salt || !storedHash) return false;
  const computed = crypto.scryptSync(password, salt, 64);
  const target = Buffer.from(storedHash, 'hex');
  if (computed.length !== target.length) return false;
  return crypto.timingSafeEqual(computed, target);
}

export function generateOtpCode(): string {
  return String(crypto.randomInt(100000, 1000000));
}

export function hashOtpOrToken(value: string, existingSalt?: string): { salt: string; hash: string } {
  const salt = existingSalt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.createHmac('sha256', salt).update(value).digest('hex');
  return { salt, hash };
}

export function verifyHashedValue(value: string, salt: string, storedHash: string): boolean {
  if (!value || !salt || !storedHash) return false;
  const computed = Buffer.from(crypto.createHmac('sha256', salt).update(value).digest('hex'), 'hex');
  const target = Buffer.from(storedHash, 'hex');
  if (computed.length !== target.length) return false;
  return crypto.timingSafeEqual(computed, target);
}

export function sha256Hex(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function createDefaultDeliverySettings(): DeliverySettings {
  return {
    ogbomosoLocalFee: 2000,
    interstateDefaultFee: 4000,
    nationwideDefaultFee: 6000,
    freeDeliveryThreshold: 120000,
    estimatedTimes: {
      local: 'Same-day / Next business day',
      interstate: '1–3 business days',
      nationwide: '2–5 business days',
      pickup: 'Ready within 2–4 hours after payment verification',
    },
    pickupEnabled: true,
    pickupAddress: 'Diamond Market Pickup Desk, Ogbomoso, Oyo State, Nigeria',
    pickupInstructions: 'Present your Order Number and verification phone at the Ogbomoso pickup desk.',
    localDeliveryEnabled: true,
    interstateDeliveryEnabled: true,
    nationwideDeliveryEnabled: true,
    autoAssignMode: 'manual',
    otpEnabled: true,
    otpScope: 'all',
    otpThresholdAmount: 50000,
    otpExpiryMinutes: 120,
    otpMaxAttempts: 5,
    requireCustomerConfirmation: true,
    collectDeliveryPhoto: true,
    collectDeliveryLocation: false,
    reminderFirstAfterHours: 24,
    reminderSecondAfterHours: 48,
    enableAutomatedEmails: true,
    enableDisputeWorkflow: true,
  };
}

export const RIDER_ALLOWED_TARGET_STATUSES: DeliveryStatus[] = [
  'picked_up',
  'out_for_delivery',
  'arrived_at_destination',
  'awaiting_customer_confirmation',
  'delivery_failed',
];

export function computeDeliveryAnalytics(params: {
  deliveries: DeliveryRecord[];
  riders: Rider[];
  riderReviews: RiderReview[];
  complaints: DeliveryComplaint[];
  orders: Order[];
}): DeliveryAnalytics {
  const { deliveries, riders, riderReviews, complaints, orders } = params;

  const totalDeliveries = deliveries.length;
  const pendingDeliveries = deliveries.filter((d) =>
    ['pending_delivery', 'preparing_order', 'ready_for_pickup'].includes(d.status)
  ).length;
  const assignedDeliveries = deliveries.filter((d) =>
    ['rider_assigned', 'picked_up'].includes(d.status)
  ).length;
  const outForDeliveryCount = deliveries.filter((d) =>
    ['out_for_delivery', 'arrived_at_destination'].includes(d.status)
  ).length;
  const completedDeliveries = deliveries.filter((d) =>
    ['awaiting_customer_confirmation', 'delivered_customer_confirmed'].includes(d.status)
  ).length;
  const customerConfirmedCount = deliveries.filter(
    (d) => d.status === 'delivered_customer_confirmed' || d.confirmation.confirmed
  ).length;
  const failedDeliveries = deliveries.filter((d) => d.status === 'delivery_failed').length;
  const disputedDeliveries = deliveries.filter((d) => d.status === 'delivery_disputed').length;
  const cancelledDeliveries = deliveries.filter(
    (d) => d.status === 'cancelled' || d.status === 'returned_to_store'
  ).length;

  // Average delivery hours strictly from actual delivered timestamps
  const durationsHours: number[] = [];
  for (const d of deliveries) {
    if (d.deliveredAt && d.createdAt) {
      const start = new Date(d.createdAt).getTime();
      const end = new Date(d.deliveredAt).getTime();
      if (!Number.isNaN(start) && !Number.isNaN(end) && end >= start) {
        durationsHours.push((end - start) / (1000 * 60 * 60));
      }
    }
  }
  const averageDeliveryHours =
    durationsHours.length > 0
      ? Number((durationsHours.reduce((a, b) => a + b, 0) / durationsHours.length).toFixed(1))
      : null;

  const terminalOutcomeCount = completedDeliveries + failedDeliveries + disputedDeliveries;
  const deliverySuccessRate =
    terminalOutcomeCount > 0 ? Math.round((completedDeliveries / terminalOutcomeCount) * 100) : null;

  const totalDeliveryFeesCollected = orders
    .filter((o) => o.paymentStatus === 'paid')
    .reduce((acc, o) => acc + Number(o.shippingTotal || 0), 0);

  const openComplaints = complaints.filter((c) => c.status !== 'resolved' && c.status !== 'closed').length;

  const approvedRiderReviews = riderReviews.filter((r) => r.status === 'approved');
  const averageRiderRating =
    approvedRiderReviews.length > 0
      ? Number(
          (
            approvedRiderReviews.reduce((acc, r) => acc + r.overallRating, 0) /
            approvedRiderReviews.length
          ).toFixed(1)
        )
      : null;

  const riderPerformance = riders.map((r) => {
    const riderDeliveries = deliveries.filter((d) => d.riderId === r.id);
    const reviewsForRider = approvedRiderReviews.filter((rev) => rev.riderId === r.id);
    const avg =
      reviewsForRider.length > 0
        ? Number(
            (
              reviewsForRider.reduce((acc, rev) => acc + rev.overallRating, 0) / reviewsForRider.length
            ).toFixed(1)
          )
        : null;

    return {
      riderId: r.id,
      riderCode: r.riderCode,
      fullName: r.fullName,
      status: r.status,
      totalAssigned: riderDeliveries.length,
      completed: riderDeliveries.filter((d) =>
        ['awaiting_customer_confirmation', 'delivered_customer_confirmed'].includes(d.status)
      ).length,
      confirmed: riderDeliveries.filter(
        (d) => d.status === 'delivered_customer_confirmed' || d.confirmation.confirmed
      ).length,
      failed: riderDeliveries.filter((d) => d.status === 'delivery_failed').length,
      pending: riderDeliveries.filter((d) =>
        [
          'rider_assigned',
          'picked_up',
          'out_for_delivery',
          'arrived_at_destination',
          'awaiting_customer_confirmation',
        ].includes(d.status)
      ).length,
      averageRating: avg,
      reviewCount: reviewsForRider.length,
    };
  });

  return {
    totalDeliveries,
    pendingDeliveries,
    assignedDeliveries,
    outForDeliveryCount,
    completedDeliveries,
    customerConfirmedCount,
    failedDeliveries,
    disputedDeliveries,
    cancelledDeliveries,
    averageDeliveryHours,
    deliverySuccessRate,
    totalDeliveryFeesCollected,
    totalComplaints: complaints.length,
    openComplaints,
    averageRiderRating,
    riderPerformance,
  };
}
