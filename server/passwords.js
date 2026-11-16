import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
// Run password derivation asynchronously so hashing does not block the event loop.
const scrypt = promisify(scryptCallback);
export async function hashPassword(password) {
  // A fresh salt gives identical passwords different stored hashes. The stored
  // salt:derived-key format contains what verification needs, never the password.
  const salt = randomBytes(16).toString('hex');
  const key = await scrypt(password, salt, 64);
  return `${salt}:${key.toString('hex')}`;
}
export async function verifyPassword(password, stored) {
  const [salt, hex] = stored.split(':');
  const expected = Buffer.from(hex, 'hex');
  const actual = await scrypt(password, salt, 64);
  // Compare equal-length buffers without a character-by-character early exit.
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
// Random session tokens have high entropy, so a fast SHA-256 digest is suitable.
// Only the digest is stored; the original bearer token is returned once at login.
export const tokenHash = token => createHash('sha256').update(token).digest('hex');
