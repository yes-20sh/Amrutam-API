import { Injectable } from '@nestjs/common';
import { TypeOrmOptionsFactory, TypeOrmModuleOptions } from '@nestjs/typeorm';

@Injectable()
export class DatabaseConfigService implements TypeOrmOptionsFactory {
  createTypeOrmOptions(): TypeOrmModuleOptions {
    const isProduction = process.env.NODE_ENV === 'production';
    const isSsl =
      process.env.DATABASE_SSL === 'true' ||
      Boolean(process.env.DATABASE_URL?.includes('supabase.com'));

    const baseOptions: TypeOrmModuleOptions = {
      type: 'postgres',
      autoLoadEntities: true,
      synchronize: true,
      migrationsRun: false,
      ssl: isSsl ? { rejectUnauthorized: false } : false,
      extra: {
        max: Number.parseInt(process.env.DATABASE_POOL_MAX || '10', 10),
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      },
    };

    if (process.env.DATABASE_URL) {
      return {
        ...baseOptions,
        url: process.env.DATABASE_URL,
      };
    }

    return {
      ...baseOptions,
      host: process.env.DATABASE_HOST || 'localhost',
      port: Number.parseInt(process.env.DATABASE_PORT || '5432', 10),
      username: process.env.DATABASE_USER || 'postgres',
      password: process.env.DATABASE_PASSWORD,
      database: process.env.DATABASE_NAME || 'postgres',
    };
  }
}
