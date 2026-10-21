import type { Request, Response } from 'express';
import type { JwtPayload } from '../../common/decorator/current-user.decorator';
import type { SignupDto } from './dto/signup.dto';
import type { LoginDto } from './dto/login.dto';
import type { VerifyMfaLoginDto } from './dto/verify-mfa-login.dto';
import type { VerifyMfaCodeDto } from './dto/verify-mfa-code.dto';
import type { UserEntity } from './entities/user.entity';
import type { LoginResponseEntity } from './entities/login-response.entity';
import type { MfaSetupEntity } from './entities/mfa-setup.entity';
import type { MfaEnableEntity } from './entities/mfa-enable.entity';
import type { AuthResolver as AuthResolverType } from './auth.resolver';
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

let createResolver: (service: AuthServiceType) => AuthResolverType;

describe('AuthResolver', () => {
  let resolver: AuthResolverType;
  let authService: {
    signup: jest.Mock;
    login: jest.Mock;
    verifyMfaLogin: jest.Mock;
    generateMfaSecret: jest.Mock;
    enableMfa: jest.Mock;
    disableMfa: jest.Mock;
    logout: jest.Mock;
    me: jest.Mock;
  };

  const userId = 'user-123';
  const mockContext = {
    req: {} as unknown as Request,
    res: {} as unknown as Response,
  };

  beforeAll(async () => {
    const { AuthResolver } = await import('./auth.resolver.js');
    createResolver = (service) => new AuthResolver(service);
  });

  beforeEach(() => {
    authService = {
      signup: bunTest.mock(),
      login: bunTest.mock(),
      verifyMfaLogin: bunTest.mock(),
      generateMfaSecret: bunTest.mock(),
      enableMfa: bunTest.mock(),
      disableMfa: bunTest.mock(),
      logout: bunTest.mock(),
      me: bunTest.mock(),
    };
    resolver = createResolver(authService as unknown as AuthServiceType);
  });

  describe('signup', () => {
    it('delegates user signup to authService', async () => {
      const input: SignupDto = {
        email: 'patient@example.com',
        password: 'password123',
        full_name: 'John Doe',
      };
      authService.signup.mockResolvedValue('Account created successfully');

      const result = await resolver.signup(input, mockContext);

      expect(result).toBe('Account created successfully');
      expect(authService.signup).toHaveBeenCalledWith(input, mockContext.res);
    });
  });

  describe('login', () => {
    it('delegates login to authService and returns login response', async () => {
      const input: LoginDto = {
        email: 'doctor@example.com',
        password: 'secretPassword',
      };
      const response: LoginResponseEntity = {
        message: 'Logged in successfully',
        mfa_required: false,
        mfa_ticket: null,
      };
      authService.login.mockResolvedValue(response);

      const result = await resolver.login(input, mockContext);

      expect(result).toBe(response);
      expect(authService.login).toHaveBeenCalledWith(input, mockContext.res);
    });
  });

  describe('verifyMfaLogin', () => {
    it('delegates MFA login verification to authService', async () => {
      const input: VerifyMfaLoginDto = {
        mfa_ticket: 'ticket_abc',
        code: '123456',
      };
      authService.verifyMfaLogin.mockResolvedValue('Logged in successfully');

      const result = await resolver.verifyMfaLogin(input, mockContext);

      expect(result).toBe('Logged in successfully');
      expect(authService.verifyMfaLogin).toHaveBeenCalledWith(input, mockContext.res);
    });
  });

  describe('generateMfaSecret', () => {
    it('generates MFA setup secret and QR code for authenticated user', async () => {
      const setupResponse: MfaSetupEntity = {
        secret: 'JBSWY3DPEHPK3PXP',
        qr_code_url: 'data:image/png;base64,mock',
      };
      authService.generateMfaSecret.mockResolvedValue(setupResponse);

      const result = await resolver.generateMfaSecret(userId);

      expect(result).toBe(setupResponse);
      expect(authService.generateMfaSecret).toHaveBeenCalledWith(userId);
    });
  });

  describe('enableMfa', () => {
    it('enables MFA and returns emergency backup codes', async () => {
      const input: VerifyMfaCodeDto = { code: '123456' };
      const enableResponse: MfaEnableEntity = {
        message: 'MFA enabled successfully',
        backup_codes: ['code-1', 'code-2'],
      };
      authService.enableMfa.mockResolvedValue(enableResponse);

      const result = await resolver.enableMfa(input, userId);

      expect(result).toBe(enableResponse);
      expect(authService.enableMfa).toHaveBeenCalledWith(userId, '123456');
    });
  });

  describe('disableMfa', () => {
    it('disables MFA for the user after verifying code', async () => {
      const input: VerifyMfaCodeDto = { code: '123456' };
      authService.disableMfa.mockResolvedValue('MFA disabled successfully');

      const result = await resolver.disableMfa(input, userId);

      expect(result).toBe('MFA disabled successfully');
      expect(authService.disableMfa).toHaveBeenCalledWith(userId, '123456');
    });
  });

  describe('logout', () => {
    it('delegates logout to authService', async () => {
      authService.logout.mockResolvedValue('Logged out successfully');

      const result = await resolver.logout(mockContext);

      expect(result).toBe('Logged out successfully');
      expect(authService.logout).toHaveBeenCalledWith(mockContext.res);
    });
  });

  describe('me', () => {
    it('retrieves current authenticated user entity', async () => {
      const userPayload: JwtPayload = {
        sub: userId,
        email: 'test@example.com',
        role: 'PATIENT',
      };
      const userEntity = { user_id: userId, email: 'test@example.com' } as UserEntity;
      authService.me.mockResolvedValue(userEntity);

      const result = await resolver.me(userPayload, mockContext);

      expect(result).toBe(userEntity);
      expect(authService.me).toHaveBeenCalledWith(userPayload, mockContext.req);
    });
  });
});
