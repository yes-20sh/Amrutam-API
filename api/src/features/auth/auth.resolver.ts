import { Resolver, Mutation, Query, Args, Context } from '@nestjs/graphql';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { Public } from '../../common/decorator/public.decorator';
import {
  CurrentUser,
  JwtPayload,
} from '../../common/decorator/current-user.decorator';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { UserEntity } from './entities/user.entity';

@Resolver(() => UserEntity)
export class AuthResolver {
  constructor(private readonly authService: AuthService) { }

  @Public()
  @Mutation(() => String)
  async signup(
    @Args('input') signupDto: SignupDto,
    @Context() context: { req: Request; res: Response },
  ): Promise<string> {
    return this.authService.signup(signupDto, context?.res);
  }

  @Public()
  @Mutation(() => String)
  async login(
    @Args('input') loginDto: LoginDto,
    @Context() context: { req: Request; res: Response },
  ): Promise<string> {
    return this.authService.login(loginDto, context?.res);
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
