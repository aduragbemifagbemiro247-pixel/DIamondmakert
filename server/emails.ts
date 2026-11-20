import nodemailer from 'nodemailer';
import type { DeliveryComplaint, DeliveryRecord, Order, StoreSettings } from '../src/types/commerce.ts';

function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatNairaHtml(amount: number): string {
  return `₦${Math.round(Number(amount || 0)).toLocaleString('en-NG')}`;
}

export interface RenderedEmail {
  subject: string;
  html: string;
}

export interface DispatchEmailResult {
  transport: 'smtp' | 'resend' | 'sandbox_log';
  delivered: boolean;
  error?: string;
}

function wrapDiamondEmailTemplate(params: {
  settings: StoreSettings;
  preheader: string;
  heading: string;
  eyebrow: string;
  bodyHtml: string;
  ctaLabel?: string;
  ctaUrl?: string;
  secondaryLabel?: string;
  secondaryUrl?: string;
}): string {
  const storeName = esc(params.settings.storeName || 'Diamond Market');
  const phone = esc(params.settings.phone || '07051959290');
  const address = esc(params.settings.address || 'Ogbomoso, Oyo State, Nigeria');
  const storeEmail = esc(params.settings.storeEmail || 'orders@diamondmarket.ng');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(params.heading)}</title>
</head>
<body style="margin:0;padding:0;background-color:#FAF8F3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111111;">
  <div style="display:none;max-height:0;overflow:hidden;">${esc(params.preheader)}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#FAF8F3;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background-color:#FFFFFF;border:1px solid #E8E8E8;border-radius:16px;overflow:hidden;">
          <tr>
            <td style="background-color:#111111;padding:28px 32px;border-bottom:2px solid #C6A15B;">
              <p style="margin:0;font-size:11px;letter-spacing:0.24em;text-transform:uppercase;color:#C6A15B;font-weight:700;">
                ${storeName} · SHOES &amp; WEARS
              </p>
              <p style="margin:8px 0 0 0;font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:#D4D4D4;">
                ${esc(params.eyebrow)}
              </p>
              <h1 style="margin:8px 0 0 0;font-family:Georgia,'Times New Roman',serif;font-size:24px;line-height:1.25;color:#FFFFFF;font-weight:700;">
                ${esc(params.heading)}
              </h1>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px;font-size:14px;line-height:1.65;color:#333333;">
              ${params.bodyHtml}
              ${
                params.ctaLabel && params.ctaUrl
                  ? `<div style="margin:26px 0 8px 0;">
                      <a href="${esc(params.ctaUrl)}" style="display:inline-block;background-color:#111111;color:#FFFFFF;text-decoration:none;font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;padding:13px 26px;border-radius:999px;border:1px solid #C6A15B;">
                        ${esc(params.ctaLabel)}
                      </a>
                      ${
                        params.secondaryLabel && params.secondaryUrl
                          ? `<a href="${esc(params.secondaryUrl)}" style="display:inline-block;margin-left:10px;background-color:#FAF8F3;color:#111111;text-decoration:none;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;padding:12px 22px;border-radius:999px;border:1px solid #D4D4D4;">
                              ${esc(params.secondaryLabel)}
                            </a>`
                          : ''
                      }
                    </div>`
                  : ''
              }
            </td>
          </tr>
          <tr>
            <td style="background-color:#111111;padding:22px 32px;color:#A3A3A3;font-size:12px;line-height:1.5;">
              <p style="margin:0;color:#FFFFFF;font-weight:600;">${storeName} — Shoes &amp; Wears</p>
              <p style="margin:4px 0 0 0;">${address}</p>
              <p style="margin:4px 0 0 0;">Phone &amp; WhatsApp: <strong style="color:#C6A15B;">${phone}</strong> · Email: ${storeEmail}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function renderOrderItemsTable(order: Order): string {
  const rows = order.items
    .map(
      (item) => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #E8E8E8;font-size:13px;color:#111111;">
          <strong>${esc(item.name)}</strong>
          ${
            item.attributes && Object.keys(item.attributes).length > 0
              ? `<br/><span style="color:#666666;font-size:11px;">${esc(
                  Object.entries(item.attributes)
                    .map(([k, v]) => `${k}: ${v}`)
                    .join(' · ')
                )}</span>`
              : ''
          }
        </td>
        <td align="center" style="padding:10px 8px;border-bottom:1px solid #E8E8E8;font-size:13px;color:#333333;">
          × ${item.quantity}
        </td>
        <td align="right" style="padding:10px 0;border-bottom:1px solid #E8E8E8;font-size:13px;font-weight:600;color:#111111;">
          ${formatNairaHtml(item.total)}
        </td>
      </tr>`
    )
    .join('');

  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:16px 0;border-top:1px solid #E8E8E8;">
    ${rows}
    <tr>
      <td colspan="2" style="padding:12px 0 4px 0;font-size:12px;color:#666666;">Delivery Fee</td>
      <td align="right" style="padding:12px 0 4px 0;font-size:12px;color:#111111;">${formatNairaHtml(order.shippingTotal)}</td>
    </tr>
    <tr>
      <td colspan="2" style="padding:6px 0 0 0;font-size:14px;font-weight:700;color:#111111;">Order Total</td>
      <td align="right" style="padding:6px 0 0 0;font-size:15px;font-weight:700;color:#111111;">${formatNairaHtml(order.total)}</td>
    </tr>
  </table>`;
}

export type EmailEventKey =
  | 'order_placed'
  | 'payment_verified'
  | 'order_processing'
  | 'order_packed'
  | 'rider_assigned'
  | 'rider_picked_up'
  | 'out_for_delivery'
  | 'rider_delivered'
  | 'confirm_receipt_request'
  | 'receipt_confirmed'
  | 'confirmation_overdue'
  | 'review_request'
  | 'delivery_otp'
  | 'complaint_submitted'
  | 'complaint_updated'
  | 'order_cancelled'
  | 'refund_status';

export function buildOrderEmail(params: {
  eventKey: EmailEventKey;
  settings: StoreSettings;
  order: Order;
  delivery?: DeliveryRecord;
  appBaseUrl: string;
  confirmToken?: string;
  otpCode?: string;
  complaint?: DeliveryComplaint;
  extraNote?: string;
}): RenderedEmail {
  const { eventKey, settings, order, delivery, appBaseUrl, confirmToken, otpCode, complaint, extraNote } = params;
  const customerName = `${order.billing.firstName} ${order.billing.lastName}`.trim() || 'Valued Customer';
  const trackUrl = `${appBaseUrl}/track-order`;
  const accountUrl = `${appBaseUrl}/account`;
  const confirmUrl = confirmToken ? `${appBaseUrl}/confirm-delivery/${encodeURIComponent(confirmToken)}` : accountUrl;
  const issueUrl = confirmToken
    ? `${appBaseUrl}/confirm-delivery/${encodeURIComponent(confirmToken)}?mode=issue`
    : accountUrl;

  const riderBlock =
    delivery?.riderName
      ? `<div style="margin:14px 0;padding:14px 16px;background-color:#FAF8F3;border:1px solid #E8E8E8;border-radius:12px;font-size:13px;">
          <p style="margin:0 0 4px 0;font-weight:700;color:#111111;">Assigned Dispatch Rider</p>
          <p style="margin:0;color:#333333;">Name: <strong>${esc(delivery.riderName)}</strong>${
          delivery.riderCode ? ` (${esc(delivery.riderCode)})` : ''
        }</p>
          ${delivery.riderPhone ? `<p style="margin:4px 0 0 0;color:#333333;">Phone: <strong>${esc(delivery.riderPhone)}</strong></p>` : ''}
          ${delivery.riderVehicle ? `<p style="margin:4px 0 0 0;color:#333333;">Vehicle: ${esc(delivery.riderVehicle)}</p>` : ''}
        </div>`
      : '';

  const otpBlock = otpCode
    ? `<div style="margin:16px 0;padding:18px;background-color:#111111;color:#FFFFFF;border-radius:12px;text-align:center;border:1px solid #C6A15B;">
        <p style="margin:0;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#C6A15B;font-weight:700;">
          Your One-Time Delivery Verification Code (OTP)
        </p>
        <p style="margin:8px 0 4px 0;font-size:30px;letter-spacing:0.3em;font-weight:700;font-family:monospace;color:#FFFFFF;">
          ${esc(otpCode)}
        </p>
        <p style="margin:0;font-size:12px;color:#D4D4D4;">
          Share this code ONLY with your Diamond Market rider when inspecting and receiving your package.
        </p>
      </div>`
    : '';

  switch (eventKey) {
    case 'order_placed':
      return {
        subject: `Order Confirmed: ${order.orderNumber} — Diamond Market`,
        html: wrapDiamondEmailTemplate({
          settings,
          preheader: `Thank you for ordering from Diamond Market. Order ${order.orderNumber} has been received.`,
          eyebrow: `Order ${order.orderNumber}`,
          heading: 'Thank You for Your Order',
          bodyHtml: `<p>Dear <strong>${esc(customerName)}</strong>,</p>
            <p>We have received your order <strong>${esc(order.orderNumber)}</strong> placed via <strong>${esc(order.paymentMethodTitle)}</strong>.</p>
            ${renderOrderItemsTable(order)}
            <p><strong>Delivery Address:</strong> ${esc(order.billing.street)}, ${esc(order.billing.city)}, ${esc(order.billing.state)}</p>`,
          ctaLabel: 'Track Your Order',
          ctaUrl: trackUrl,
        }),
      };

    case 'payment_verified':
      return {
        subject: `Payment Verified for Order ${order.orderNumber} — Diamond Market`,
        html: wrapDiamondEmailTemplate({
          settings,
          preheader: `Your payment of ${formatNairaHtml(order.total)} for ${order.orderNumber} has been confirmed.`,
          eyebrow: `Payment Confirmed · ${order.orderNumber}`,
          heading: 'Payment Received & Confirmed',
          bodyHtml: `<p>Dear <strong>${esc(customerName)}</strong>,</p>
            <p>Your payment of <strong>${formatNairaHtml(order.total)}</strong> for order <strong>${esc(order.orderNumber)}</strong> is confirmed. Our Ogbomoso dispatch desk is now preparing your pieces for quality check and packaging.</p>
            ${renderOrderItemsTable(order)}`,
          ctaLabel: 'View Order Timeline',
          ctaUrl: accountUrl,
        }),
      };

    case 'order_processing':
      return {
        subject: `Order ${order.orderNumber} Is Being Prepared — Diamond Market`,
        html: wrapDiamondEmailTemplate({
          settings,
          preheader: `We are preparing your Diamond Market items for dispatch.`,
          eyebrow: `Order Preparing · ${order.orderNumber}`,
          heading: 'Your Order Is Being Prepared',
          bodyHtml: `<p>Dear <strong>${esc(customerName)}</strong>,</p>
            <p>Our quality team is inspecting and preparing your items from order <strong>${esc(order.orderNumber)}</strong>.</p>
            ${extraNote ? `<p><strong>Dispatch Note:</strong> ${esc(extraNote)}</p>` : ''}`,
          ctaLabel: 'Track Progress',
          ctaUrl: trackUrl,
        }),
      };

    case 'order_packed':
      return {
        subject: `Order ${order.orderNumber} Packed & Ready for Pickup — Diamond Market`,
        html: wrapDiamondEmailTemplate({
          settings,
          preheader: `Order ${order.orderNumber} is packed and ready for rider handoff or pickup.`,
          eyebrow: `Packed & Ready · ${order.orderNumber}`,
          heading: 'Order Packed & Ready for Dispatch',
          bodyHtml: `<p>Dear <strong>${esc(customerName)}</strong>,</p>
            <p>Your Diamond Market package (<strong>${esc(order.orderNumber)}</strong>) is packed and ready for dispatch.</p>
            ${delivery?.estimatedDeliveryDate ? `<p><strong>Estimated Delivery:</strong> ${esc(delivery.estimatedDeliveryDate)}</p>` : ''}`,
          ctaLabel: 'Track Your Order',
          ctaUrl: trackUrl,
        }),
      };

    case 'rider_assigned':
      return {
        subject: `Dispatch Rider Assigned for ${order.orderNumber} — Diamond Market`,
        html: wrapDiamondEmailTemplate({
          settings,
          preheader: `${delivery?.riderName || 'A Diamond Market rider'} has been assigned to deliver ${order.orderNumber}.`,
          eyebrow: `Rider Assigned · ${order.orderNumber}`,
          heading: 'Your Dispatch Rider Has Been Assigned',
          bodyHtml: `<p>Dear <strong>${esc(customerName)}</strong>,</p>
            <p>A verified Diamond Market dispatch rider has been assigned to your order <strong>${esc(order.orderNumber)}</strong>.</p>
            ${riderBlock}
            ${otpBlock}
            <p><strong>Destination:</strong> ${esc(order.billing.street)}, ${esc(order.billing.city)}, ${esc(order.billing.state)}</p>`,
          ctaLabel: 'Track Delivery Live',
          ctaUrl: accountUrl,
        }),
      };

    case 'delivery_otp':
      return {
        subject: `Your Delivery Verification Code (OTP) for ${order.orderNumber} — Diamond Market`,
        html: wrapDiamondEmailTemplate({
          settings,
          preheader: `Use OTP ${otpCode} when receiving order ${order.orderNumber}.`,
          eyebrow: `Delivery Security · ${order.orderNumber}`,
          heading: 'One-Time Delivery Verification Code',
          bodyHtml: `<p>Dear <strong>${esc(customerName)}</strong>,</p>
            <p>Your order <strong>${esc(order.orderNumber)}</strong> is protected with Diamond Market OTP delivery verification.</p>
            ${otpBlock}
            ${riderBlock}`,
          ctaLabel: 'Open Order Dashboard',
          ctaUrl: accountUrl,
        }),
      };

    case 'rider_picked_up':
      return {
        subject: `Order ${order.orderNumber} Picked Up by Rider — Diamond Market`,
        html: wrapDiamondEmailTemplate({
          settings,
          preheader: `Your order ${order.orderNumber} has been picked up from our dispatch desk.`,
          eyebrow: `Picked Up · ${order.orderNumber}`,
          heading: 'Rider Has Picked Up Your Package',
          bodyHtml: `<p>Dear <strong>${esc(customerName)}</strong>,</p>
            <p>Your order <strong>${esc(order.orderNumber)}</strong> has left the Diamond Market hub and is in the care of your assigned rider.</p>
            ${riderBlock}
            ${otpBlock}`,
          ctaLabel: 'Track Order',
          ctaUrl: trackUrl,
        }),
      };

    case 'out_for_delivery':
      return {
        subject: `Out for Delivery: ${order.orderNumber} — Diamond Market`,
        html: wrapDiamondEmailTemplate({
          settings,
          preheader: `Your Diamond Market order ${order.orderNumber} is out for delivery today.`,
          eyebrow: `Out for Delivery · ${order.orderNumber}`,
          heading: 'Your Order Is Out for Delivery',
          bodyHtml: `<p>Dear <strong>${esc(customerName)}</strong>,</p>
            <p>Your order <strong>${esc(order.orderNumber)}</strong> is currently on its way to <strong>${esc(order.billing.street)}, ${esc(order.billing.city)}</strong>. Please keep your phone line <strong>${esc(order.billing.phone)}</strong> reachable.</p>
            ${
              order.paymentMethod === 'cod' && order.paymentStatus !== 'paid'
                ? `<p style="padding:10px 14px;background-color:#FAF8F3;border:1px solid #C6A15B;border-radius:10px;"><strong>Pay on Delivery Reminder:</strong> Total due on arrival is <strong>${formatNairaHtml(order.total)}</strong>.</p>`
                : ''
            }
            ${riderBlock}
            ${otpBlock}`,
          ctaLabel: 'View Delivery Status',
          ctaUrl: accountUrl,
        }),
      };

    case 'rider_delivered':
    case 'confirm_receipt_request':
      return {
        subject: `Please Confirm Delivery of Order ${order.orderNumber} — Diamond Market`,
        html: wrapDiamondEmailTemplate({
          settings,
          preheader: `Your order ${order.orderNumber} has been marked delivered. Please confirm receipt or report any issue.`,
          eyebrow: `Action Needed · ${order.orderNumber}`,
          heading: 'Please Confirm Receipt of Your Order',
          bodyHtml: `<p>Dear <strong>${esc(customerName)}</strong>,</p>
            <p>Your Diamond Market delivery for order <strong>${esc(order.orderNumber)}</strong> was recorded on <strong>${esc(
              new Date(delivery?.deliveredAt || Date.now()).toLocaleString('en-NG')
            )}</strong>.</p>
            ${riderBlock}
            ${renderOrderItemsTable(order)}
            <p>Please verify that all items arrived cleanly and click <strong>Confirm Receipt</strong> below. If anything is missing, damaged, or wrong, select <strong>Report a Problem</strong> immediately.</p>`,
          ctaLabel: 'Confirm Receipt',
          ctaUrl: confirmUrl,
          secondaryLabel: 'Report a Problem',
          secondaryUrl: issueUrl,
        }),
      };

    case 'confirmation_overdue':
      return {
        subject: `Reminder: Confirm Receipt for Order ${order.orderNumber} — Diamond Market`,
        html: wrapDiamondEmailTemplate({
          settings,
          preheader: `Gentle reminder to confirm receipt of order ${order.orderNumber}.`,
          eyebrow: `Delivery Confirmation Reminder · ${order.orderNumber}`,
          heading: 'Have You Received Your Package?',
          bodyHtml: `<p>Dear <strong>${esc(customerName)}</strong>,</p>
            <p>Our rider marked order <strong>${esc(order.orderNumber)}</strong> as delivered, and we are awaiting your confirmation. Please let us know you received your items safely, or report a delivery issue if you did not.</p>
            ${renderOrderItemsTable(order)}`,
          ctaLabel: 'Confirm Receipt Now',
          ctaUrl: confirmUrl,
          secondaryLabel: 'Report a Problem',
          secondaryUrl: issueUrl,
        }),
      };

    case 'receipt_confirmed':
      return {
        subject: `Thank You! Delivery Confirmed for ${order.orderNumber} — Diamond Market`,
        html: wrapDiamondEmailTemplate({
          settings,
          preheader: `Thank you for confirming delivery of order ${order.orderNumber}.`,
          eyebrow: `Delivered & Confirmed · ${order.orderNumber}`,
          heading: 'Thank You for Shopping With Diamond Market',
          bodyHtml: `<p>Dear <strong>${esc(customerName)}</strong>,</p>
            <p>Your delivery confirmation for order <strong>${esc(order.orderNumber)}</strong> has been permanently recorded. We hope you love your new footwear and wears!</p>
            <p>Your verified product review and rider feedback forms are now unlocked in your account.</p>`,
          ctaLabel: 'Leave Product & Rider Review',
          ctaUrl: accountUrl,
        }),
      };

    case 'review_request':
      return {
        subject: `Share Your Fit & Delivery Review (${order.orderNumber}) — Diamond Market`,
        html: wrapDiamondEmailTemplate({
          settings,
          preheader: `Rate your Diamond Market pieces and rider experience for order ${order.orderNumber}.`,
          eyebrow: `Verified Buyer Feedback · ${order.orderNumber}`,
          heading: 'How Did Everything Fit?',
          bodyHtml: `<p>Dear <strong>${esc(customerName)}</strong>,</p>
            <p>Thank you again for choosing Diamond Market for order <strong>${esc(order.orderNumber)}</strong>. Please take a moment to rate the quality and fit of your items and your rider’s service.</p>`,
          ctaLabel: 'Write Your Review',
          ctaUrl: accountUrl,
        }),
      };

    case 'complaint_submitted':
      return {
        subject: `Delivery Issue Received (${complaint?.complaintNumber || order.orderNumber}) — Diamond Market`,
        html: wrapDiamondEmailTemplate({
          settings,
          preheader: `We have opened support ticket ${complaint?.complaintNumber || ''} for order ${order.orderNumber}.`,
          eyebrow: `Support Ticket · ${complaint?.complaintNumber || order.orderNumber}`,
          heading: 'We Received Your Delivery Report',
          bodyHtml: `<p>Dear <strong>${esc(customerName)}</strong>,</p>
            <p>Our logistics resolution desk has received your delivery report (<strong>${esc(
              complaint?.complaintNumber || ''
            )}</strong>) regarding order <strong>${esc(order.orderNumber)}</strong>.</p>
            ${complaint ? `<p><strong>Category:</strong> ${esc(complaint.category.replace(/_/g, ' '))}<br/><strong>Details:</strong> ${esc(complaint.description)}</p>` : ''}
            <p>An administrator is reviewing delivery evidence and will update you promptly.</p>`,
          ctaLabel: 'View Ticket in Account',
          ctaUrl: accountUrl,
        }),
      };

    case 'complaint_updated':
      return {
        subject: `Complaint Update (${complaint?.complaintNumber || order.orderNumber}) — Diamond Market`,
        html: wrapDiamondEmailTemplate({
          settings,
          preheader: `Status update on delivery complaint ${complaint?.complaintNumber || ''}.`,
          eyebrow: `Complaint Status · ${complaint?.complaintNumber || order.orderNumber}`,
          heading: `Complaint Status: ${complaint?.status ? complaint.status.replace(/_/g, ' ').toUpperCase() : 'UPDATED'}`,
          bodyHtml: `<p>Dear <strong>${esc(customerName)}</strong>,</p>
            <p>Your delivery report <strong>${esc(complaint?.complaintNumber || '')}</strong> for order <strong>${esc(order.orderNumber)}</strong> has been updated.</p>
            ${
              complaint?.resolutionSummary
                ? `<div style="margin:14px 0;padding:14px 16px;background-color:#FAF8F3;border:1px solid #C6A15B;border-radius:12px;">
                    <p style="margin:0 0 4px 0;font-weight:700;color:#111111;">Resolution Summary</p>
                    <p style="margin:0;color:#333333;">${esc(complaint.resolutionSummary)}</p>
                  </div>`
                : ''
            }
            ${extraNote ? `<p><strong>Note:</strong> ${esc(extraNote)}</p>` : ''}`,
          ctaLabel: 'View in Account',
          ctaUrl: accountUrl,
        }),
      };

    case 'order_cancelled':
      return {
        subject: `Order Cancelled: ${order.orderNumber} — Diamond Market`,
        html: wrapDiamondEmailTemplate({
          settings,
          preheader: `Order ${order.orderNumber} has been cancelled.`,
          eyebrow: `Order Cancelled · ${order.orderNumber}`,
          heading: 'Order Cancelled',
          bodyHtml: `<p>Dear <strong>${esc(customerName)}</strong>,</p>
            <p>Your order <strong>${esc(order.orderNumber)}</strong> has been marked as cancelled.${
              extraNote ? ` Reason: ${esc(extraNote)}` : ''
            }</p>
            <p>If you need assistance or wish to reorder, reply or contact us on WhatsApp at <strong>${esc(settings.phone || '07051959290')}</strong>.</p>`,
          ctaLabel: 'Return to Store',
          ctaUrl: appBaseUrl,
        }),
      };

    case 'refund_status':
      return {
        subject: `Refund Update for Order ${order.orderNumber} — Diamond Market`,
        html: wrapDiamondEmailTemplate({
          settings,
          preheader: `Refund status updated for order ${order.orderNumber}.`,
          eyebrow: `Refund Notice · ${order.orderNumber}`,
          heading: 'Refund Update',
          bodyHtml: `<p>Dear <strong>${esc(customerName)}</strong>,</p>
            <p>A refund update has been recorded for order <strong>${esc(order.orderNumber)}</strong> (${formatNairaHtml(order.total)}).</p>
            ${extraNote ? `<p><strong>Details:</strong> ${esc(extraNote)}</p>` : ''}`,
          ctaLabel: 'View Order Details',
          ctaUrl: accountUrl,
        }),
      };
  }
}

export async function dispatchTransactionalEmail(params: {
  to: string;
  subject: string;
  html: string;
  settings: StoreSettings;
}): Promise<DispatchEmailResult> {
  const fromEmail = process.env.SMTP_FROM || params.settings.storeEmail || 'orders@diamondmarket.ng';
  const fromHeader = `"${params.settings.storeName || 'Diamond Market'}" <${fromEmail}>`;

  // 1. Resend API if configured
  if (process.env.RESEND_API_KEY) {
    try {
      const resp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromHeader,
          to: [params.to],
          subject: params.subject,
          html: params.html,
        }),
        signal: AbortSignal.timeout(10000),
      });
      if (resp.ok) {
        return { transport: 'resend', delivered: true };
      }
      const text = await resp.text().catch(() => '');
      return { transport: 'resend', delivered: false, error: `Resend HTTP ${resp.status}: ${text.slice(0, 140)}` };
    } catch (err) {
      return {
        transport: 'resend',
        delivered: false,
        error: err instanceof Error ? err.message : 'Resend request failed',
      };
    }
  }

  // 2. Nodemailer SMTP if configured
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    try {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === 'true' || Number(process.env.SMTP_PORT) === 465,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
      await transporter.sendMail({
        from: fromHeader,
        to: params.to,
        subject: params.subject,
        html: params.html,
      });
      return { transport: 'smtp', delivered: true };
    } catch (err) {
      return {
        transport: 'smtp',
        delivered: false,
        error: err instanceof Error ? err.message : 'SMTP delivery failed',
      };
    }
  }

  // 3. Sandbox Outbox Preview Log (SMTP/Resend not configured yet)
  return { transport: 'sandbox_log', delivered: true };
}
