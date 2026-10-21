import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import type { StringValue } from 'ms';
import { AuthService } from './auth.service';
import { AuthResolver } from './auth.resolver';

@Module({
  imports: [
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET || 'super-secret-jwt-key',
      signOptions: {
        expiresIn: (process.env.JWT_EXPIRES_IN || '1d') as StringValue,
      },
    }),
  ],
  providers: [AuthResolver, AuthService],
  exports: [AuthService, JwtModule],
})
export class AuthModule { }