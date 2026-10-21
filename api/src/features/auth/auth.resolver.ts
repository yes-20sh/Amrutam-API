import { Resolver, Mutation, Query, Args, Context } from '@nestjs/graphql';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { Public } from '../../common/decorator/public.decorator';
import {
  CurrentUser,
  CurrentUserId,
  JwtPayload,
} from '../../common/decorator/current-user.decorator';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyMfaLoginDto } from './dto/verify-mfa-login.dto';
import { VerifyMfaCodeDto } from './dto/verify-mfa-code.dto';
import { UserEntity } from './entities/user.entity';
import { LoginResponseEntity } from './entities/login-response.entity';
import { MfaSetupEntity } from './entities/mfa-setup.entity';
import { MfaEnableEntity } from './entities/mfa-enable.entity';

@Resolver(() => UserEntity)
export class AuthResolver {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Mutation(() => String)
  async signup(
    @Args('input') signupDto: SignupDto,
    @Context() context: { req: Request; res: Response },
  ): Promise<string> {
    return this.authService.signup(signupDto, context?.res);
  }

  @Public()
  @Mutation(() => LoginResponseEntity)
  async login(
    @Args('input') loginDto: LoginDto,
    @Context() context: { req: Request; res: Response },
  ): Promise<LoginResponseEntity> {
    return this.authService.login(loginDto, context?.res);
  }

  @Public()
  @Mutation(() => String, {
    description: 'Verify 6-digit TOTP code or backup code to complete MFA login',
  })
  async verifyMfaLogin(
    @Args('input') verifyDto: VerifyMfaLoginDto,
    @Context() context: { req: Request; res: Response },
  ): Promise<string> {
    return this.authService.verifyMfaLogin(verifyDto, context?.res);
  }

  @Mutation(() => MfaSetupEntity, {
    description: 'Generate Base32 secret and QR code Data URL for Google Authenticator setup',
  })
  async generateMfaSecret(
    @CurrentUserId() userId: string,
  ): Promise<MfaSetupEntity> {
    return this.authService.generateMfaSecret(userId);
  }

  @Mutation(() => MfaEnableEntity, {
    description: 'Verify first TOTP code from Google Authenticator and enable MFA on the account',
  })
  async enableMfa(
    @Args('input') input: VerifyMfaCodeDto,
    @CurrentUserId() userId: string,
  ): Promise<MfaEnableEntity> {
    return this.authService.enableMfa(userId, input.code);
  }

  @Mutation(() => String, {
    description: 'Disable MFA on the account after verifying current TOTP code',
  })
  async disableMfa(
    @Args('input') input: VerifyMfaCodeDto,
    @CurrentUserId() userId: string,
  ): Promise<string> {
    return this.authService.disableMfa(userId, input.code);
  }

  @Public()
  @Mutation(() => String)
  async logout(
    @Context() context: { req: Request; res: Response },
  ): Promise<string> {
    return this.authService.logout(context?.res);
  }

  @Query(() => UserEntity)
  async me(
    @CurrentUser() user: JwtPayload | undefined,
    @Context() context: { req: Request; res: Response },
  ): Promise<UserEntity> {
    return this.authService.me(user, context?.req);
  }
}
