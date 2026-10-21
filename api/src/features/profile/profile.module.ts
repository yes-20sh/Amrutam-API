import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Profile } from '../../schemas/profile.schema';
import { User } from '../../schemas/user.schema';
import { CloudinaryModule } from '../../core/cloudinary/cloudinary.module';
import { RedisModule } from '../../core/redis/redis.module';
import { ProfileService } from './profile.service';
import { ProfileResolver } from './profile.resolver';

@Module({
  imports: [
    TypeOrmModule.forFeature([Profile, User]),
    CloudinaryModule,
    RedisModule,
  ],
  providers: [ProfileResolver, ProfileService],
  exports: [ProfileService],
})
export class ProfileModule {}
