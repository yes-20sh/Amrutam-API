import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Repository } from 'typeorm';
import type { JwtService } from '@nestjs/jwt';
import type { RedisService } from '../../core/redis/redis.service';
import type { User } from '../../schemas/user.schema';
import type { Profile } from '../../schemas/profile.schema';
import { UserRole } from '../../common/enum/user-role.enum';
import { UserStatus } from '../../common/enum/user-status.enum';
import type { AuthService as AuthServiceType } from './auth.service';

const bunTest = require('bun:test') as {
  beforeAll: (callback: () => void | Promise<void>) => void;
  beforeEach: (callback: () => void | Promise<void>) => void;
  describe: (name: string, callback: () => void) => void;
  expect: jest.Expect;
  it: (name: string, callback: () => void | Promise<void>) => void;
  mock: {
    (): jest.Mock;
    module: (specifier: string, factory: () => unknown) => void;
  };
};
const { beforeAll, beforeEach, describe, expect, it } = bunTest;

bunTest.mock.module('../../schemas/user.schema', () => ({
  User: class User {},
}));
bunTest.mock.module('../../schemas/profile.schema', () => ({
  Profile: class Profile {},
}));

const mockBcrypt = {
  hash: bunTest.mock().mockImplementation(async (val: string) => `hashed_${val}`),
  compare: bunTest.mock().mockImplementation(async (plain: string, hash: string) => {
    return hash === `hashed_${plain}` || hash === 'valid_hash';
  }),
};
bunTest.mock.module('bcrypt', () => mockBcrypt);

const mockMfaUtil = {
  isMfaGloballyEnabled: bunTest.mock(),
  generateMfaSecretAndQr: bunTest.mock(),
  verifyTotpCode: bunTest.mock(),
  generateBackupCodes: bunTest.mock(),
  verifyBackupCode: bunTest.mock(),
  encryptMfaSecret: bunTest.mock().mockImplementation((s: string) => `enc_${s}`),
  decryptMfaSecret: bunTest.mock().mockImplementation((s: string) => s.replace('enc_', '')),
};
bunTest.mock.module('../../utils/mfa/mfa.util', () => mockMfaUtil);

const mockCookieUtil = {
  setAuthTokenCookie: bunTest.mock().mockReturnValue('mock_jwt_token'),
  clearAuthTokenCookie: bunTest.mock(),
  extractTokenFromRequest: bunTest.mock(),
};
bunTest.mock.module('../../utils/cookie/cookie.util', () => mockCookieUtil);

type ServiceDependencies = [
  Repository<User>,
  Repository<Profile>,
  JwtService,
  RedisService,
];
let createService: (...dependencies: ServiceDependencies) => AuthServiceType;

describe('AuthService', () => {
  let service: AuthServiceType;
  let userRepository: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let profileRepository: {
    create: jest.Mock;
    save: jest.Mock;
  };
  let jwtService: {
    sign: jest.Mock;
    verify: jest.Mock;
  };
  let redisClient: {
    get: jest.Mock;
    set: jest.Mock;
    del: jest.Mock;
  };
  let redisService: {
    client: typeof redisClient;
  };

  const userId = 'user-123';
  const email = 'doctor@example.com';

  beforeAll(async () => {
    const { AuthService } = await import('./auth.service.js');
    createService = (...dependencies) => new AuthService(...dependencies);
  });

  beforeEach(() => {
    userRepository = {
      findOne: bunTest.mock(),
      create: bunTest.mock().mockImplementation((data) => ({ ...data, user_id: userId })),
      save: bunTest.mock().mockImplementation(async (data) => data),
    };
    profileRepository = {
      create: bunTest.mock().mockImplementation((data) => ({ ...data, profile_id: 'prof-123' })),
      save: bunTest.mock().mockImplementation(async (data) => data),
    };
    jwtService = {
      sign: bunTest.mock().mockReturnValue('mock_signed_ticket'),
      verify: bunTest.mock().mockReturnValue({ sub: userId, email, purpose: 'MFA_PENDING' }),
    };
    redisClient = {
      get: bunTest.mock().mockResolvedValue(null),
      set: bunTest.mock().mockResolvedValue('OK'),
      del: bunTest.mock().mockResolvedValue(1),
    };
    redisService = {
      client: redisClient,
    };

    service = createService(
      userRepository as unknown as Repository<User>,
      profileRepository as unknown as Repository<Profile>,
      jwtService as unknown as JwtService,
      redisService as unknown as RedisService,
    );
  });

  describe('signup', () => {
    it('creates a new user and profile and returns confirmation', async () => {
      userRepository.findOne.mockResolvedValue(null);

      const res = {} as any;
      const result = await service.signup(
        {
          email: '  test@example.com ',
          password: 'secretPassword123',
          full_name: 'Dr. Test User',
          phone: '+919999999999',
          role: UserRole.DOCTOR,
        },
        res,
      );

      expect(result).toBe('Account created successfully');
      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
      expect(userRepository.create).toHaveBeenCalled();
      expect(profileRepository.create).toHaveBeenCalledWith({
        user_id: userId,
        full_name: 'Dr. Test User',
        phone: '+919999999999',
      });
      expect(mockCookieUtil.setAuthTokenCookie).toHaveBeenCalled();
    });

    it('throws ConflictException if email is already taken', async () => {
      userRepository.findOne.mockResolvedValue({ user_id: 'existing-id' });

      await expect(
        service.signup({
          email: 'test@example.com',
          password: 'pass',
          full_name: 'Name',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('login', () => {
    it('throws UnauthorizedException if email is not found', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(
        service.login({ email: 'unknown@example.com', password: 'pass' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws ForbiddenException if user status is SUSPENDED', async () => {
      userRepository.findOne.mockResolvedValue({
        user_id: userId,
        status: UserStatus.SUSPENDED,
      });

      await expect(
        service.login({ email: 'user@example.com', password: 'pass' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws UnauthorizedException if user status is INACTIVE', async () => {
      userRepository.findOne.mockResolvedValue({
        user_id: userId,
        status: UserStatus.INACTIVE,
      });

      await expect(
        service.login({ email: 'user@example.com', password: 'pass' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws UnauthorizedException if password does not match', async () => {
      userRepository.findOne.mockResolvedValue({
        user_id: userId,
        status: UserStatus.ACTIVE,
        password: 'hashed_different',
      });
      mockBcrypt.compare.mockResolvedValueOnce(false);

      await expect(
        service.login({ email: 'user@example.com', password: 'wrongPassword' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('logs in immediately without MFA challenge when MFA is not active', async () => {
      mockMfaUtil.isMfaGloballyEnabled.mockReturnValue(false);
      userRepository.findOne.mockResolvedValue({
        user_id: userId,
        email,
        status: UserStatus.ACTIVE,
        password: 'hashed_validPassword',
        mfa_enabled: false,
      });
      mockBcrypt.compare.mockResolvedValueOnce(true);

      const res = {} as any;
      const response = await service.login(
        { email, password: 'validPassword' },
        res,
      );

      expect(response).toEqual({
        message: 'Logged in successfully',
        mfa_required: false,
        mfa_ticket: null,
      });
      expect(mockCookieUtil.setAuthTokenCookie).toHaveBeenCalled();
    });

    it('returns an MFA challenge ticket when MFA is globally enabled and active on account', async () => {
      mockMfaUtil.isMfaGloballyEnabled.mockReturnValue(true);
      userRepository.findOne.mockResolvedValue({
        user_id: userId,
        email,
        role: UserRole.DOCTOR,
        status: UserStatus.ACTIVE,
        password: 'hashed_validPassword',
        mfa_enabled: true,
      });
      mockBcrypt.compare.mockResolvedValueOnce(true);

      const res = {} as any;
      const response = await service.login(
        { email, password: 'validPassword' },
        res,
      );

      expect(response).toEqual({
        message: 'MFA verification required',
        mfa_required: true,
        mfa_ticket: 'mock_signed_ticket',
      });
      expect(jwtService.sign).toHaveBeenCalledWith(
        {
          sub: userId,
          email,
          role: UserRole.DOCTOR,
          purpose: 'MFA_PENDING',
        },
        { expiresIn: '5m' },
      );
    });
  });

  describe('verifyMfaLogin', () => {
    it('throws UnauthorizedException if MFA ticket is invalid or expired', async () => {
      jwtService.verify.mockImplementationOnce(() => {
        throw new Error('jwt expired');
      });

      await expect(
        service.verifyMfaLogin({ mfa_ticket: 'expired_ticket', code: '123456' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws BadRequestException if code was already used within replay window', async () => {
      jwtService.verify.mockReturnValueOnce({ sub: userId, purpose: 'MFA_PENDING' });
      userRepository.findOne.mockResolvedValue({
        user_id: userId,
        mfa_enabled: true,
        mfa_secret: 'enc_secret',
      });
      redisClient.get.mockResolvedValueOnce('1'); // already used

      await expect(
        service.verifyMfaLogin({ mfa_ticket: 'valid_ticket', code: '123456' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('successfully logs in and caches replay key when TOTP code is valid', async () => {
      jwtService.verify.mockReturnValueOnce({ sub: userId, purpose: 'MFA_PENDING' });
      userRepository.findOne.mockResolvedValue({
        user_id: userId,
        mfa_enabled: true,
        mfa_secret: 'enc_secret',
      });
      redisClient.get.mockResolvedValueOnce(null);
      mockMfaUtil.verifyTotpCode.mockReturnValueOnce(true);

      const res = {} as any;
      const result = await service.verifyMfaLogin(
        { mfa_ticket: 'valid_ticket', code: '123456' },
        res,
      );

      expect(result).toBe('Logged in successfully');
      expect(mockMfaUtil.verifyTotpCode).toHaveBeenCalledWith('enc_secret', '123456');
      expect(redisClient.set).toHaveBeenCalledWith(
        `mfa:used:${userId}:123456`,
        '1',
        'EX',
        60,
      );
      expect(mockCookieUtil.setAuthTokenCookie).toHaveBeenCalled();
    });

    it('falls back to single-use backup code and consumes it', async () => {
      jwtService.verify.mockReturnValueOnce({ sub: userId, purpose: 'MFA_PENDING' });
      const userObj = {
        user_id: userId,
        mfa_enabled: true,
        mfa_secret: 'enc_secret',
        mfa_backup_codes: ['hashed_code1', 'hashed_code2'],
      };
      userRepository.findOne.mockResolvedValue(userObj);
      redisClient.get.mockResolvedValueOnce(null);
      mockMfaUtil.verifyTotpCode.mockReturnValueOnce(false); // TOTP fails
      mockMfaUtil.verifyBackupCode.mockResolvedValueOnce({ isValid: true, matchedIndex: 0 }); // Backup code matches

      const res = {} as any;
      const result = await service.verifyMfaLogin(
        { mfa_ticket: 'valid_ticket', code: 'backup_code' },
        res,
      );

      expect(result).toBe('Logged in successfully');
      expect(userObj.mfa_backup_codes).toEqual(['hashed_code2']); // consumed index 0
    });

    it('throws UnauthorizedException if both TOTP and backup codes fail', async () => {
      jwtService.verify.mockReturnValueOnce({ sub: userId, purpose: 'MFA_PENDING' });
      userRepository.findOne.mockResolvedValue({
        user_id: userId,
        mfa_enabled: true,
        mfa_secret: 'enc_secret',
        mfa_backup_codes: [],
      });
      redisClient.get.mockResolvedValueOnce(null);
      mockMfaUtil.verifyTotpCode.mockReturnValueOnce(false);
      mockMfaUtil.verifyBackupCode.mockResolvedValueOnce({ isValid: false, matchedIndex: -1 });

      await expect(
        service.verifyMfaLogin({ mfa_ticket: 'valid_ticket', code: 'wrong_code' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('generateMfaSecret', () => {
    it('throws BadRequestException if MFA is globally disabled', async () => {
      mockMfaUtil.isMfaGloballyEnabled.mockReturnValueOnce(false);

      await expect(service.generateMfaSecret(userId)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('generates a secret and QR code Data URL and saves encrypted secret on user', async () => {
      mockMfaUtil.isMfaGloballyEnabled.mockReturnValueOnce(true);
      const userObj = { user_id: userId, email };
      userRepository.findOne.mockResolvedValue(userObj);
      mockMfaUtil.generateMfaSecretAndQr.mockResolvedValueOnce({
        secret: 'JBSWY3DPEHPK3PXP',
        encryptedSecret: 'enc_secret_key',
        qrCodeUrl: 'data:image/png;base64,mock_qr',
      });

      const result = await service.generateMfaSecret(userId);

      expect(result).toEqual({
        secret: 'JBSWY3DPEHPK3PXP',
        qr_code_url: 'data:image/png;base64,mock_qr',
      });
      expect(userObj).toHaveProperty('mfa_secret', 'enc_secret_key');
      expect(userRepository.save).toHaveBeenCalledWith(userObj);
    });
  });

  describe('enableMfa', () => {
    it('throws BadRequestException if code is invalid', async () => {
      mockMfaUtil.isMfaGloballyEnabled.mockReturnValueOnce(true);
      userRepository.findOne.mockResolvedValue({
        user_id: userId,
        mfa_secret: 'enc_secret',
      });
      mockMfaUtil.verifyTotpCode.mockReturnValueOnce(false);

      await expect(service.enableMfa(userId, '000000')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('enables MFA and returns 8 emergency recovery codes when code is valid', async () => {
      mockMfaUtil.isMfaGloballyEnabled.mockReturnValueOnce(true);
      const userObj = {
        user_id: userId,
        mfa_secret: 'enc_secret',
        mfa_enabled: false,
      };
      userRepository.findOne.mockResolvedValue(userObj);
      mockMfaUtil.verifyTotpCode.mockReturnValueOnce(true);
      mockMfaUtil.generateBackupCodes.mockResolvedValueOnce({
        rawCodes: ['rec-1', 'rec-2'],
        hashedCodes: ['hashed_rec-1', 'hashed_rec-2'],
      });

      const result = await service.enableMfa(userId, '123456');

      expect(result.message).toContain('MFA enabled successfully');
      expect(result.backup_codes).toEqual(['rec-1', 'rec-2']);
      expect(userObj).toHaveProperty('mfa_enabled', true);
      expect(userObj).toHaveProperty('mfa_backup_codes', [
        'hashed_rec-1',
        'hashed_rec-2',
      ]);
      expect(redisClient.del).toHaveBeenCalledWith(`user:${userId}`);
    });
  });

  describe('disableMfa', () => {
    it('throws BadRequestException if MFA was not enabled', async () => {
      userRepository.findOne.mockResolvedValue({
        user_id: userId,
        mfa_enabled: false,
      });

      await expect(service.disableMfa(userId, '123456')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('disables MFA and resets secrets when code is valid', async () => {
      const userObj = {
        user_id: userId,
        mfa_enabled: true,
        mfa_secret: 'enc_secret',
        mfa_backup_codes: ['code1'],
      };
      userRepository.findOne.mockResolvedValue(userObj);
      mockMfaUtil.verifyTotpCode.mockReturnValueOnce(true);

      const result = await service.disableMfa(userId, '123456');

      expect(result).toBe('MFA disabled successfully');
      expect(userObj.mfa_enabled).toBe(false);
      expect(userObj.mfa_secret).toBeNull();
      expect(userObj.mfa_backup_codes).toBeNull();
      expect(redisClient.del).toHaveBeenCalledWith(`user:${userId}`);
    });
  });

  describe('logout', () => {
    it('clears auth cookie and returns confirmation', async () => {
      const res = {} as any;
      const result = await service.logout(res);

      expect(result).toBe('Logged out successfully');
      expect(mockCookieUtil.clearAuthTokenCookie).toHaveBeenCalledWith(res);
    });
  });

  describe('me', () => {
    it('returns the authenticated user entity', async () => {
      const mockUser = { user_id: userId, email, profile: null };
      userRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.me({ sub: userId, email, role: UserRole.DOCTOR });

      expect(result).toBe(mockUser as any);
      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { user_id: userId },
        relations: { profile: true },
      });
    });

    it('throws UnauthorizedException if no user credentials are provided', async () => {
      await expect(service.me(undefined, undefined)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });
});
