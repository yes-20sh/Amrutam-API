import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import * as QRCode from 'qrcode';
import { generateSecret, generateURI, verifySync } from 'otplib';
import {
  encryptMfaSecret,
  decryptMfaSecret,
} from '../crypto/mfa-crypto.util';

export { encryptMfaSecret, decryptMfaSecret };

/**
 * Checks whether MFA is globally enabled via the MFA_ENABLED environment flag.
 */
export function isMfaGloballyEnabled(): boolean {
  return process.env.MFA_ENABLED === 'true';
}

/**
 * Generates a Base32 secret, OTPAuth URI, QR code PNG Data URL, and encrypted secret.
 */
export async function generateMfaSecretAndQr(email: string): Promise<{
  secret: string;
  encryptedSecret: string;
  qrCodeUrl: string;
}> {
  const secret = generateSecret();
  const otpauthUrl = generateURI({
    issuer: 'Amrutam',
    label: email,
    secret,
  });

  const qrCodeUrl = await QRCode.toDataURL(otpauthUrl);
  const encryptedSecret = encryptMfaSecret(secret);

  return {
    secret,
    encryptedSecret,
    qrCodeUrl,
  };
}

/**
 * Verifies a 6-digit TOTP token against a stored secret (plain or encrypted).
 */
export function verifyTotpCode(
  storedSecret: string,
  token: string,
  epochTolerance = 30,
): boolean {
  try {
    const plainSecret = decryptMfaSecret(storedSecret);
    const result = verifySync({
      secret: plainSecret,
      token: token.trim(),
      epochTolerance,
    });
    return Boolean(result.valid);
  } catch {
    return false;
  }
}

/**
 * Generates emergency one-time backup recovery codes and their bcrypt hashes.
 */
export async function generateBackupCodes(
  count = 8,
): Promise<{ rawCodes: string[]; hashedCodes: string[] }> {
  const rawCodes: string[] = [];
  const hashedCodes: string[] = [];

  for (let i = 0; i < count; i++) {
    const rawCode = crypto.randomBytes(4).toString('hex'); // 8-char hex code (e.g. "a1b2c3d4")
    rawCodes.push(rawCode);
    const hashed = await bcrypt.hash(rawCode, 10);
    hashedCodes.push(hashed);
  }

  return { rawCodes, hashedCodes };
}

/**
 * Verifies if a submitted code matches any of the user's hashed backup codes.
 * Returns the matched index if found, or -1 if invalid.
 */
export async function verifyBackupCode(
  submittedCode: string,
  hashedBackupCodes?: string[] | null,
): Promise<{ isValid: boolean; matchedIndex: number }> {
  if (!hashedBackupCodes || hashedBackupCodes.length === 0) {
    return { isValid: false, matchedIndex: -1 };
  }

  const codeTrimmed = submittedCode.trim();

  for (let i = 0; i < hashedBackupCodes.length; i++) {
    const matches = await bcrypt.compare(codeTrimmed, hashedBackupCodes[i]);
    if (matches) {
      return { isValid: true, matchedIndex: i };
    }
  }

  return { isValid: false, matchedIndex: -1 };
}
