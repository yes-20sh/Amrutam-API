import {
  Injectable,
  Logger,
  ConflictException,
  UnauthorizedException,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import type { Request, Response } from 'express';
import * as bcrypt from 'bcrypt';

import { User } from '../../schemas/user.schema';
import { Profile } from '../../schemas/profile.schema';
import { UserRole } from '../../common/enum/user-role.enum';
import { UserStatus } from '../../common/enum/user-status.enum';
import { handleServiceError } from '../../utils/error/error.util';
import {
  setAuthTokenCookie,
  clearAuthTokenCookie,
  extractTokenFromRequest,
} from '../../utils/cookie/cookie.util';
import {
  isMfaGloballyEnabled,
  generateMfaSecretAndQr,
  verifyTotpCode,
  generateBackupCodes,
  verifyBackupCode,
} from '../../utils/mfa/mfa.util';
import { RedisService } from '../../core/redis/redis.service';
import { JwtPayload } from '../../common/decorator/current-user.decorator';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyMfaLoginDto } from './dto/verify-mfa-login.dto';
import { UserEntity } from './entities/user.entity';
import { LoginResponseEntity } from './entities/login-response.entity';
import { MfaSetupEntity } from './entities/mfa-setup.entity';
import { MfaEnableEntity } from './entities/mfa-enable.entity';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Profile)
    private readonly profileRepository: Repository<Profile>,
    private readonly jwtService: JwtService,
    private readonly redisService: RedisService,
  ) {}

  async signup(signupDto: SignupDto, res?: Response): Promise<string> {
    try {
      const normalizedEmail = signupDto.email.trim().toLowerCase();

      // Check if user already exists
      const existingUser = await this.userRepository.findOne({
        where: { email: normalizedEmail },
      });

      if (existingUser) {
        throw new ConflictException(
          'A user with this email address already exists',
        );
      }

      // Hash user password with bcrypt
      const saltRounds = 10;
      const password_hash = await bcrypt.hash(signupDto.password, saltRounds);

      // Create new user record
      const newUser = this.userRepository.create({
        email: normalizedEmail,
        password: password_hash,
        role: signupDto.role || UserRole.PATIENT,
        status: UserStatus.ACTIVE,
        email_verified: false,
        mfa_enabled: false,
      });

      const savedUser = await this.userRepository.save(newUser);

      const newProfile = this.profileRepository.create({
        user_id: savedUser.user_id,
        full_name: signupDto.full_name.trim(),
        phone: signupDto.phone?.trim() || null,
      });

      await this.profileRepository.save(newProfile);

      if (res) {
        setAuthTokenCookie(res, savedUser, this.jwtService);
      }
      return 'Account created successfully';
    } catch (error) {
      handleServiceError(error, this.logger, 'AuthService.signup');
    }
  }

  async login(loginDto: LoginDto, res?: Response): Promise<LoginResponseEntity> {
    try {
      const normalizedEmail = loginDto.email.trim().toLowerCase();

      const user = await this.userRepository.findOne({
        where: { email: normalizedEmail },
      });

      if (!user) {
        throw new UnauthorizedException('Invalid email or password');
      }

      if (user.status === UserStatus.SUSPENDED) {
        throw new ForbiddenException(
          'Your account has been suspended. Please contact customer support.',
        );
      }

      if (user.status === UserStatus.INACTIVE) {
        throw new UnauthorizedException('Your account is currently inactive.');
      }

      const isPasswordValid = await bcrypt.compare(
        loginDto.password,
        user.password,
      );

      if (!isPasswordValid) {
        throw new UnauthorizedException('Invalid email or password');
      }

      // If MFA is globally enabled AND user has enabled it on their account
      if (isMfaGloballyEnabled() && user.mfa_enabled) {
        const mfa_ticket = this.jwtService.sign(
          {
            sub: user.user_id,
            email: user.email,
            role: user.role,
            purpose: 'MFA_PENDING',
          },
          { expiresIn: '5m' },
        );

        return {
          message: 'MFA verification required',
          mfa_required: true,
          mfa_ticket,
        };
      }

      user.last_login_at = new Date();
      await this.userRepository.save(user);

      if (res) {
        setAuthTokenCookie(res, user, this.jwtService);
      }

      return {
        message: 'Logged in successfully',
        mfa_required: false,
        mfa_ticket: null,
      };
    } catch (error) {
      handleServiceError(error, this.logger, 'AuthService.login');
    }
  }

  /**
   * Complete MFA login challenge using Google Authenticator 6-digit TOTP or backup code
   */
  async verifyMfaLogin(
    verifyDto: VerifyMfaLoginDto,
    res?: Response,
  ): Promise<string> {
    try {
      let payload: { sub: string; email: string; purpose?: string };
      try {
        payload = this.jwtService.verify(verifyDto.mfa_ticket, {
          secret: process.env.JWT_SECRET || 'super-secret-jwt-key',
        });
      } catch {
        throw new UnauthorizedException(
          'MFA session expired or invalid. Please login again.',
        );
      }

      if (payload.purpose !== 'MFA_PENDING') {
        throw new UnauthorizedException('Invalid MFA session token');
      }

      const user = await this.userRepository.findOne({
        where: { user_id: payload.sub },
      });

      if (!user || !user.mfa_enabled || !user.mfa_secret) {
        throw new UnauthorizedException('MFA is not enabled for this user');
      }

      const submittedCode = verifyDto.code.trim();

      // 1. Replay prevention check via Redis
      const replayKey = `mfa:used:${user.user_id}:${submittedCode}`;
      const alreadyUsed = await this.redisService.client?.get(replayKey);
      if (alreadyUsed) {
        throw new BadRequestException(
          'This authentication code has already been used. Please wait for a new code.',
        );
      }

      // 2. Verify with Google Authenticator TOTP via mfa.util
      let isValid = verifyTotpCode(user.mfa_secret, submittedCode);

      // 3. Fallback: Check emergency backup recovery codes
      if (!isValid && user.mfa_backup_codes && user.mfa_backup_codes.length > 0) {
        const backupResult = await verifyBackupCode(
          submittedCode,
          user.mfa_backup_codes,
        );
        if (backupResult.isValid) {
          isValid = true;
          // Consume used backup code
          user.mfa_backup_codes.splice(backupResult.matchedIndex, 1);
        }
      }

      if (!isValid) {
        throw new UnauthorizedException(
          'Invalid authentication code. Please try again.',
        );
      }

      // Store used code in Redis for 60 seconds to prevent replay
      await this.redisService.client?.set(replayKey, '1', 'EX', 60);

      user.last_login_at = new Date();
      await this.userRepository.save(user);

      if (res) {
        setAuthTokenCookie(res, user, this.jwtService);
      }

      return 'Logged in successfully';
    } catch (error) {
      handleServiceError(error, this.logger, 'AuthService.verifyMfaLogin');
    }
  }

  /**
   * Generates a new Base32 TOTP secret and QR code Data URL for enrollment in Google Authenticator
   */
  async generateMfaSecret(userId: string): Promise<MfaSetupEntity> {
    try {
      if (!isMfaGloballyEnabled()) {
        throw new BadRequestException(
          'MFA feature is currently disabled by administrator.',
        );
      }

      const user = await this.userRepository.findOne({
        where: { user_id: userId },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Generate secret, encrypted payload, and QR Code Data URL via mfa.util
      const { secret, encryptedSecret, qrCodeUrl } =
        await generateMfaSecretAndQr(user.email);

      // Save pending secret (encrypted at rest)
      user.mfa_secret = encryptedSecret;
      await this.userRepository.save(user);

      return {
        secret,
        qr_code_url: qrCodeUrl,
      };
    } catch (error) {
      handleServiceError(error, this.logger, 'AuthService.generateMfaSecret');
    }
  }

  /**
   * Verifies the initial code from Google Authenticator and activates MFA for the account
   */
  async enableMfa(userId: string, code: string): Promise<MfaEnableEntity> {
    try {
      if (!isMfaGloballyEnabled()) {
        throw new BadRequestException(
          'MFA feature is currently disabled by administrator.',
        );
      }

      const user = await this.userRepository.findOne({
        where: { user_id: userId },
      });

      if (!user || !user.mfa_secret) {
        throw new BadRequestException(
          'MFA setup has not been initiated. Please generate a QR code first.',
        );
      }

      const isValid = verifyTotpCode(user.mfa_secret, code);
      if (!isValid) {
        throw new BadRequestException(
          'Invalid authentication code. Please verify your Google Authenticator clock and code.',
        );
      }

      // Generate 8 emergency one-time backup codes via mfa.util
      const { rawCodes, hashedCodes } = await generateBackupCodes(8);

      user.mfa_enabled = true;
      user.mfa_backup_codes = hashedCodes;
      await this.userRepository.save(user);

      await this.redisService.client?.del(`user:${userId}`);

      return {
        message:
          'MFA enabled successfully. Store these backup recovery codes in a safe place.',
        backup_codes: rawCodes,
      };
    } catch (error) {
      handleServiceError(error, this.logger, 'AuthService.enableMfa');
    }
  }

  /**
   * Disables MFA for the user's account after verifying current code
   */
  async disableMfa(userId: string, code: string): Promise<string> {
    try {
      const user = await this.userRepository.findOne({
        where: { user_id: userId },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      if (!user.mfa_enabled || !user.mfa_secret) {
        throw new BadRequestException('MFA is not enabled on this account.');
      }

      const isValid = verifyTotpCode(user.mfa_secret, code);
      if (!isValid) {
        throw new BadRequestException('Invalid authentication code.');
      }

      user.mfa_enabled = false;
      user.mfa_secret = null;
      user.mfa_backup_codes = null;
      await this.userRepository.save(user);

      await this.redisService.client?.del(`user:${userId}`);

      return 'MFA disabled successfully';
    } catch (error) {
      handleServiceError(error, this.logger, 'AuthService.disableMfa');
    }
  }

  async logout(res?: Response): Promise<string> {
    try {
      if (res) {
        clearAuthTokenCookie(res);
      }
      return 'Logged out successfully';
    } catch (error) {
      handleServiceError(error, this.logger, 'AuthService.logout');
    }
  }

  async me(user?: JwtPayload, req?: Request): Promise<UserEntity> {
    try {
      let userId = user?.sub;

      if (!userId && req) {
        const token = extractTokenFromRequest(req);
        if (token) {
          try {
            const decoded = this.jwtService.verify<JwtPayload>(token, {
              secret:
                process.env.JWT_SECRET ||
                'super-secret-jwt-key-for-development-change-in-prod',
            });
            userId = decoded.sub;
          } catch {
            throw new UnauthorizedException(
              'Authentication token is invalid or expired',
            );
          }
        }
      }

      if (!userId) {
        throw new UnauthorizedException(
          'Authentication credentials were not provided',
        );
      }

      const foundUser = await this.userRepository.findOne({
        where: { user_id: userId },
        relations: { profile: true },
      });

      if (!foundUser) {
        throw new NotFoundException('User not found');
      }

      return foundUser as UserEntity;
    } catch (error) {
      handleServiceError(error, this.logger, 'AuthService.me');
    }
  }
}
