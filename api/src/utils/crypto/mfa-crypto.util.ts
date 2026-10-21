import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const SALT = 'amrutam_mfa_totp_salt_v1';

function getEncryptionKey(): Buffer {
  const secret = process.env.JWT_SECRET || 'amrutam_telemedicine_default_secret_key_32';
  return crypto.scryptSync(secret, SALT, 32);
}

/**
 * Encrypts an MFA TOTP secret at rest using AES-256-GCM
 */
export function encryptMfaSecret(plainSecret: string): string {
  const iv = crypto.randomBytes(16);
  const key = getEncryptionKey();
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plainSecret, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypts an MFA TOTP secret from storage
 */
export function decryptMfaSecret(encryptedPayload: string): string {
  try {
    const parts = encryptedPayload.split(':');
    if (parts.length !== 3) {
      // Legacy unencrypted secret fallback
      return encryptedPayload;
    }

    const [ivHex, authTagHex, encryptedText] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const key = getEncryptionKey();

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch {
    // If decryption fails, attempt returning as raw in case it was stored unencrypted
    return encryptedPayload;
  }
}
