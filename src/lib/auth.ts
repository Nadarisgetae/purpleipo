import { SignJWT, jwtVerify } from 'jose';

export const COOKIE_NAME = 'purpleipo_session';

function getSecretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET || 'fallback_default_purple_ipo_secret_key_32_chars';
  return new TextEncoder().encode(secret);
}

/**
 * Creates a signed JWT session token valid for 30 days.
 */
export async function createSessionToken(): Promise<string> {
  const secretKey = getSecretKey();
  const token = await new SignJWT({ authenticated: true })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(secretKey);

  return token;
}

/**
 * Verifies a signed JWT session token.
 */
export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  try {
    const secretKey = getSecretKey();
    const { payload } = await jwtVerify(token, secretKey);
    return payload.authenticated === true;
  } catch (error) {
    return false;
  }
}
