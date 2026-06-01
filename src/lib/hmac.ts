import { createHmac } from 'crypto';

export function signHmacSha256Hex(secret: string, message: string): string {
  return createHmac('sha256', secret).update(message).digest('hex');
}
