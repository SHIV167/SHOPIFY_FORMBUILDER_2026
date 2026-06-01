import { cookies } from 'next/headers';
import { signHmacSha256Hex } from './hmac';

const SESSION_COOKIE = 'cf_session';

export function setShopSession(shop: string) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is required');
  const sig = signHmacSha256Hex(secret, shop);
  cookies().set(SESSION_COOKIE, `${shop}|${sig}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'none',
    maxAge: 60 * 60 * 24 * 7,
  });
}

export function getShopFromSession(): string | null {
  const secret = process.env.JWT_SECRET;
  if (!secret) return null;
  const value = cookies().get(SESSION_COOKIE)?.value;
  if (!value) return null;
  const [shop, sig] = value.split('|');
  if (!shop || !sig) return null;
  if (signHmacSha256Hex(secret, shop) !== sig) return null;
  return shop;
}

export function clearShopSession() {
  cookies().delete(SESSION_COOKIE);
}
