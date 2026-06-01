import { randomBytes } from 'crypto';

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('hex');
}
