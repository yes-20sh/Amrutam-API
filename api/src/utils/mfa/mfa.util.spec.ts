import {
  isMfaGloballyEnabled,
  generateMfaSecretAndQr,
  verifyTotpCode,
  generateBackupCodes,
  verifyBackupCode,
  encryptMfaSecret,
  decryptMfaSecret,
} from './mfa.util';
import { generateSync } from 'otplib';

const bunTest = require('bun:test') as {
  describe: (name: string, callback: () => void) => void;
  expect: jest.Expect;
  it: (name: string, callback: () => void | Promise<void>) => void;
};
const { describe, expect, it } = bunTest;

describe('mfa.util', () => {
  describe('isMfaGloballyEnabled', () => {
    it('returns true when process.env.MFA_ENABLED is "true"', () => {
      const original = process.env.MFA_ENABLED;
      process.env.MFA_ENABLED = 'true';
      expect(isMfaGloballyEnabled()).toBe(true);
      process.env.MFA_ENABLED = original;
    });

    it('returns false when process.env.MFA_ENABLED is not "true"', () => {
      const original = process.env.MFA_ENABLED;
      process.env.MFA_ENABLED = 'false';
      expect(isMfaGloballyEnabled()).toBe(false);
      process.env.MFA_ENABLED = original;
    });
  });

  describe('generateMfaSecretAndQr', () => {
    it('generates a Base32 secret, encrypted secret, and QR code Data URL', async () => {
      const result = await generateMfaSecretAndQr('patient@amrutam.co.in');

      expect(typeof result.secret).toBe('string');
      expect(result.secret.length).toBeGreaterThanOrEqual(16);
      expect(result.qrCodeUrl).toMatch(/^data:image\/png;base64,/);
      expect(result.encryptedSecret).toContain(':');
    });
  });

  describe('encryption & decryption', () => {
    it('encrypts and decrypts secret symmetrically', () => {
      const originalSecret = 'JBSWY3DPEHPK3PXP';
      const encrypted = encryptMfaSecret(originalSecret);

      expect(encrypted).not.toBe(originalSecret);
      expect(decryptMfaSecret(encrypted)).toBe(originalSecret);
    });
  });

  describe('verifyTotpCode', () => {
    it('validates a correct live TOTP token against encrypted secret', () => {
      const secret = 'JBSWY3DPEHPK3PXP';
      const encryptedSecret = encryptMfaSecret(secret);
      const currentToken = generateSync({ secret });

      expect(verifyTotpCode(encryptedSecret, currentToken)).toBe(true);
    });

    it('rejects an incorrect TOTP token', () => {
      const secret = 'JBSWY3DPEHPK3PXP';
      const encryptedSecret = encryptMfaSecret(secret);

      expect(verifyTotpCode(encryptedSecret, '000000')).toBe(false);
    });
  });

  describe('generateBackupCodes & verifyBackupCode', () => {
    it('generates 8 recovery codes and verifies matching codes correctly', async () => {
      const { rawCodes, hashedCodes } = await generateBackupCodes(8);

      expect(rawCodes).toHaveLength(8);
      expect(hashedCodes).toHaveLength(8);

      // First code should match index 0
      const checkFirst = await verifyBackupCode(rawCodes[0], hashedCodes);
      expect(checkFirst.isValid).toBe(true);
      expect(checkFirst.matchedIndex).toBe(0);

      // Third code should match index 2
      const checkThird = await verifyBackupCode(rawCodes[2], hashedCodes);
      expect(checkThird.isValid).toBe(true);
      expect(checkThird.matchedIndex).toBe(2);

      // Unknown code should fail
      const checkInvalid = await verifyBackupCode('invalid_code_123', hashedCodes);
      expect(checkInvalid.isValid).toBe(false);
      expect(checkInvalid.matchedIndex).toBe(-1);
    });
  });
});
