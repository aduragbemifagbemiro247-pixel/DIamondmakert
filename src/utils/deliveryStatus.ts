import type { DeliveryRecord, DeliveryStatus, Order } from '../types/commerce.ts';

export const DELIVERY_STATUS_LABELS: Record<DeliveryStatus, string> = {
  pending_delivery: 'Pending Delivery',
  preparing_order: 'Preparing Order',
  ready_for_pickup: 'Ready for Pickup',
  rider_assigned: 'Rider Assigned',
  picked_up: 'Picked Up',
  out_for_delivery: 'Out for Delivery',
  arrived_at_destination: 'Arrived at Destination',
  awaiting_customer_confirmation: 'Delivered — Awaiting Confirmation',
  delivered_customer_confirmed: 'Delivered — Confirmed',
  delivery_failed: 'Delivery Failed',
  delivery_disputed: 'Delivery Disputed',
  returned_to_store: 'Returned to Store',
  cancelled: 'Cancelled',
};

export function getDeliveryStatusLabel(status?: string | null): string {
  if (!status) return 'Pending Delivery';
  const legacy: Record<string, DeliveryStatus> = {
    pending_dispatch: 'pending_delivery',
    packed: 'ready_for_pickup',
    in_transit: 'out_for_delivery',
    delivered: 'awaiting_customer_confirmation',
    returned: 'returned_to_store',
  };
  const key = (legacy[status] || status) as DeliveryStatus;
  return DELIVERY_STATUS_LABELS[key] || status.replace(/_/g, ' ');
}

export function getDeliveryStatusStyle(status?: string | null): string {
  switch (status) {
    case 'delivered_customer_confirmed':
      return 'bg-emerald-50 text-emerald-800 border-emerald-200';
    case 'awaiting_customer_confirmation':
      return 'bg-amber-50 text-amber-800 border-amber-200';
    case 'out_for_delivery':
    case 'arrived_at_destination':
    case 'picked_up':
    case 'rider_assigned':
      return 'bg-[#FAF8F3] text-[#111111] border-[#C6A15B]/50';
    case 'delivery_failed':
    case 'delivery_disputed':
    case 'cancelled':
      return 'bg-rose-50 text-rose-800 border-rose-200';
    case 'returned_to_store':
      return 'bg-neutral-100 text-neutral-700 border-neutral-300';
    default:
      return 'bg-[#FAF8F3] text-[#333333] border-[#E8E8E8]';
  }
}

export interface TimelineStage {
  key: string;
  label: string;
  completed: boolean;
  active: boolean;
  timestamp?: string;
}

const PROGRESS_ORDER: DeliveryStatus[] = [
  'pending_delivery',
  'preparing_order',
  'ready_for_pickup',
  'rider_assigned',
  'picked_up',
  'out_for_delivery',
  'arrived_at_destination',
  'awaiting_customer_confirmation',
  'delivered_customer_confirmed',
];

export function buildCustomerDeliveryTimeline(
  order: Order,
  delivery?: DeliveryRecord | null
): {
  stages: TimelineStage[];
  exceptionStatus: DeliveryStatus | null;
  exceptionReason?: string;
} {
  const rawStatus = (delivery?.status || order.delivery?.status || 'pending_delivery') as DeliveryStatus;
  const isException = [
    'delivery_failed',
    'delivery_disputed',
    'returned_to_store',
    'cancelled',
  ].includes(rawStatus);

  const history = delivery?.history || [];
  const findTs = (statusList: DeliveryStatus[]): string | undefined => {
    const match = history.find((h) => statusList.includes(h.toStatus));
    return match?.timestamp;
  };

  const currentIdx = PROGRESS_ORDER.indexOf(rawStatus);
  const reached = (target: DeliveryStatus, explicitTs?: string) => {
    if (explicitTs) return true;
    if (isException) return false;
    return currentIdx >= PROGRESS_ORDER.indexOf(target);
  };

  const paymentDone = order.paymentStatus === 'paid' || order.paymentMethod === 'cod';
  const tsPrep = findTs(['preparing_order']);
  const tsPacked = findTs(['ready_for_pickup']);
  const tsAssigned = delivery?.assignedAt || findTs(['rider_assigned']);
  const tsPickedUp = delivery?.pickedUpAt || findTs(['picked_up']);
  const tsOut = delivery?.outForDeliveryAt || findTs(['out_for_delivery']);
  const tsDelivered = delivery?.deliveredAt || findTs(['arrived_at_destination', 'awaiting_customer_confirmation']);
  const tsConfirmed =
    delivery?.confirmation?.confirmedAt ||
    order.delivery?.customerConfirmedAt ||
    findTs(['delivered_customer_confirmed']);

  const stages: TimelineStage[] = [
    {
      key: 'placed',
      label: 'Order Placed',
      completed: true,
      active: rawStatus === 'pending_delivery' && !paymentDone,
      timestamp: order.createdAt,
    },
    {
      key: 'payment',
      label: order.paymentMethod === 'cod' ? 'Pay on Delivery Scheduled' : 'Payment Verified',
      completed: order.paymentStatus === 'paid' || Boolean(tsPrep) || currentIdx >= 1,
      active: rawStatus === 'pending_delivery' && order.paymentStatus !== 'paid',
      timestamp: order.paymentStatus === 'paid' ? order.updatedAt : undefined,
    },
    {
      key: 'preparing',
      label: 'Order Preparing',
      completed: reached('preparing_order', tsPrep),
      active: rawStatus === 'preparing_order',
      timestamp: tsPrep,
    },
    {
      key: 'packed',
      label: 'Packed & Ready',
      completed: reached('ready_for_pickup', tsPacked),
      active: rawStatus === 'ready_for_pickup',
      timestamp: tsPacked,
    },
    {
      key: 'assigned',
      label: 'Rider Assigned',
      completed: reached('rider_assigned', tsAssigned),
      active: rawStatus === 'rider_assigned',
      timestamp: tsAssigned,
    },
    {
      key: 'picked_up',
      label: 'Picked Up',
      completed: reached('picked_up', tsPickedUp),
      active: rawStatus === 'picked_up',
      timestamp: tsPickedUp,
    },
    {
      key: 'out_for_delivery',
      label: 'Out for Delivery',
      completed: reached('out_for_delivery', tsOut),
      active: rawStatus === 'out_for_delivery' || rawStatus === 'arrived_at_destination',
      timestamp: tsOut,
    },
    {
      key: 'delivered',
      label: 'Delivered (Pending Confirmation)',
      completed: reached('awaiting_customer_confirmation', tsDelivered),
      active: rawStatus === 'awaiting_customer_confirmation',
      timestamp: tsDelivered,
    },
    {
      key: 'confirmed',
      label: 'Customer Confirmed Receipt',
      completed: Boolean(delivery?.confirmation?.confirmed || order.delivery?.customerConfirmed),
      active: rawStatus === 'delivered_customer_confirmed',
      timestamp: tsConfirmed,
    },
  ];

  return {
    stages,
    exceptionStatus: isException ? rawStatus : null,
    exceptionReason: delivery?.failureReason || delivery?.confirmation?.disputeReason,
  };
}
