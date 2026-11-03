import { normalizeDeliveryStatus } from './conversations.js';

// HTTP success alone is not evidence that the provider accepted a message.
export function parseWhatsAppSendReceipt(payload) {
  const unknown = { accepted: false, status: 'unknown', messageId: null };
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return unknown;
  const status = normalizeDeliveryStatus(payload);
  const nestedStatus = payload.result && typeof payload.result === 'object' ? normalizeDeliveryStatus(payload.result) : 'unknown';
  if ([status, nestedStatus].some(value => value === 'failed' || value === 'unavailable')) {
    return { accepted: false, status: 'failed', messageId: null };
  }
  const rawId = payload.messageId || payload.result?.messageId;
  if (typeof rawId !== 'string' || !rawId.trim() || rawId.length > 512) return unknown;
  const rawStatus = payload.deliveryStatus || payload.status || payload.result?.deliveryStatus || payload.result?.status;
  if (rawStatus && !['queued', 'sent', 'delivered'].includes(status)) return unknown;
  return { accepted: true, status: status === 'unknown' ? 'queued' : status, messageId: rawId.trim() };
}
