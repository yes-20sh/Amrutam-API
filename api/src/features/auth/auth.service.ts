import {
  Injectable,
  Logger,
  ConflictException,
  UnauthorizedException,
  NotFoundException,
  ForbiddenException,
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
import { JwtPayload } from '../../common/decorator/current-user.decorator';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { UserEntity } from './entities/user.entity';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Profile)
    private readonly profileRepository: Repository<Profile>,
    private readonly jwtService: JwtService,
  ) { }

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

  async login(loginDto: LoginDto, res?: Response): Promise<string> {
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

      user.last_login_at = new Date();
      await this.userRepository.save(user);

      if (res) {
        setAuthTokenCookie(res, user, this.jwtService);
      }

      return 'Logged in successfully';
    } catch (error) {
      handleServiceError(error, this.logger, 'AuthService.login');
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

