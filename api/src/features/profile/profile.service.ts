import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Profile } from '../../schemas/profile.schema';
import { User } from '../../schemas/user.schema';
import { CloudinaryService } from '../../core/cloudinary/cloudinary.service';
import { RedisService } from '../../core/redis/redis.service';
import { handleServiceError } from '../../utils/error/error.util';
import { UpdateProfileInput } from './dto/update-profile.input';
import { ProfileEntity } from './entities/profile.entity';

@Injectable()
export class ProfileService {
  private readonly logger = new Logger(ProfileService.name);

  constructor(
    @InjectRepository(Profile)
    private readonly profileRepository: Repository<Profile>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly cloudinaryService: CloudinaryService,
    private readonly redisService: RedisService,
  ) {}

  /**
   * Fetch the profile for the authenticated user from Redis cache or database.
   */
  async myProfile(userId: string): Promise<ProfileEntity> {
    try {
      const cacheKey = `profile:${userId}`;

      // 1. Try reading from Redis cache
      const cached = await this.redisService.client?.get(cacheKey);
      if (cached) {
        return JSON.parse(cached) as ProfileEntity;
      }

      // 2. Query profile from database
      let profile = await this.profileRepository.findOne({
        where: { user_id: userId },
      });

      // 3. Fallback: If user exists without a profile record, auto-initialize one
      if (!profile) {
        const user = await this.userRepository.findOne({
          where: { user_id: userId },
        });

        if (!user) {
          throw new NotFoundException('User account not found');
        }

        profile = this.profileRepository.create({
          user_id: userId,
          full_name: user.email.split('@')[0],
        });
        profile = await this.profileRepository.save(profile);
      }

      // 4. Cache in Redis for 1 hour (3600 seconds)
      await this.redisService.client?.set(
        cacheKey,
        JSON.stringify(profile),
        'EX',
        3600,
      );

      return profile;
    } catch (error) {
      handleServiceError(error, this.logger, 'ProfileService.myProfile');
    }
  }

  /**
   * Upsert profile: Creates if not existing, updates if existing.
   * Handles text updates, Cloudinary avatar upload/replacement, and avatar removal.
   */
  async updateProfile(
    userId: string,
    input: UpdateProfileInput,
  ): Promise<string> {
    try {
      // 1. Verify user exists
      const user = await this.userRepository.findOne({
        where: { user_id: userId },
      });

      if (!user) {
        throw new NotFoundException('User account not found');
      }

      // 2. Load existing profile or initialize new one (UPSERT)
      let profile = await this.profileRepository.findOne({
        where: { user_id: userId },
      });

      const isNew = !profile;

      if (!profile) {
        profile = this.profileRepository.create({
          user_id: userId,
          full_name: input.full_name?.trim() || user.email.split('@')[0],
        });
      }

      // 3. Handle Cloudinary Avatar Upload / Replace / Remove
      if (input.profile_image !== undefined) {
        const oldImageUrl = profile.profile_image_url;

        if (input.profile_image && input.profile_image.trim().length > 0) {
          // Upload new image to Cloudinary (folder: amrutam/profiles)
          const secureUrl = await this.cloudinaryService.uploadImage(
            input.profile_image.trim(),
            'amrutam/profiles',
          );
          profile.profile_image_url = secureUrl;

          // Delete old Cloudinary image if one previously existed
          if (oldImageUrl) {
            await this.cloudinaryService.deleteImage(oldImageUrl);
          }
        } else {
          // Explicit null or empty string -> Delete avatar
          profile.profile_image_url = null;
          if (oldImageUrl) {
            await this.cloudinaryService.deleteImage(oldImageUrl);
          }
        }
      }

      // 4. Apply scalar field updates
      if (input.full_name !== undefined) {
        profile.full_name = input.full_name.trim();
      }

      if (input.date_of_birth !== undefined) {
        profile.date_of_birth = input.date_of_birth;
      }

      if (input.gender !== undefined) {
        profile.gender = input.gender;
      }

      if (input.phone !== undefined) {
        profile.phone = input.phone?.trim() || null;
      }

      if (input.address !== undefined) {
        profile.address = input.address?.trim() || null;
      }

      // 5. Persist to database
      await this.profileRepository.save(profile);

      // 6. Invalidate Redis cache
      await this.redisService.client?.del(`profile:${userId}`);

      return isNew
        ? 'Profile created successfully'
        : 'Profile updated successfully';
    } catch (error) {
      handleServiceError(error, this.logger, 'ProfileService.updateProfile');
    }
  }
}
