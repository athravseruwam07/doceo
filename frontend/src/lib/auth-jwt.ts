import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import type { JWT } from "next-auth/jwt";

const JWT_ALGORITHM = "HS256";
const DEFAULT_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

function toSecretKey(secret: string | Uint8Array): Uint8Array {
  if (secret instanceof Uint8Array) return secret;
  return new TextEncoder().encode(secret);
}

export async function encodeAuthJwt({
  token,
  secret,
  maxAge,
}: {
  token?: JWT;
  secret: string | Uint8Array;
  maxAge?: number;
}): Promise<string> {
  if (!token) return "";

  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresIn = maxAge ?? DEFAULT_MAX_AGE_SECONDS;
  const payload: JWTPayload = { ...(token as JWTPayload) };

  return new SignJWT(payload)
    .setProtectedHeader({ alg: JWT_ALGORITHM, typ: "JWT" })
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + expiresIn)
    .sign(toSecretKey(secret));
}

export async function decodeAuthJwt({
  token,
  secret,
}: {
  token?: string;
  secret: string | Uint8Array;
}): Promise<JWT | null> {
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, toSecretKey(secret), {
      algorithms: [JWT_ALGORITHM],
    });
    return payload as JWT;
  } catch {
    return null;
  }
}
