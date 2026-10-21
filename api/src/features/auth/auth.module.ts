import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { User } from '../../schemas/user.schema';
import { Profile } from '../../schemas/profile.schema';
import { AuthService } from './auth.service';
import { AuthResolver } from './auth.resolver';


@Module({
  imports: [
    JwtModule.register({
      global: true,
      secret:
        process.env.JWT_SECRET ||
        'super-secret-jwt-key',
      signOptions: {
        expiresIn: process.env.JWT_EXPIRES_IN ? Number(process.env.JWT_EXPIRES_IN) : '7d',
      },
    }),
  ],
  providers: [AuthResolver, AuthService],
  exports: [AuthService, JwtModule],
})
export class AuthModule { }
