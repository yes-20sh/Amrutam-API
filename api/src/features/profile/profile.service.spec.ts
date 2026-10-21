import { NotFoundException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import type { CloudinaryService } from '../../core/cloudinary/cloudinary.service';
import type { RedisService } from '../../core/redis/redis.service';
import type { ProfileService as ProfileServiceType } from './profile.service';
import type { Profile } from '../../schemas/profile.schema';
import type { User } from '../../schemas/user.schema';
import type { UpdateProfileInput } from './dto/update-profile.input';

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
const mockModule = bunTest.mock.module;
mockModule('../../schemas/profile.schema', () => ({
  Profile: class Profile {},
}));
mockModule('../../schemas/user.schema', () => ({
  User: class User {},
}));

type ServiceDependencies = [
  Repository<Profile>,
  Repository<User>,
  CloudinaryService,
  RedisService,
];
let createService: (...dependencies: ServiceDependencies) => ProfileServiceType;

describe('ProfileService', () => {
  let service: ProfileServiceType;
  let profileRepository: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let userRepository: { findOne: jest.Mock };
  let cloudinaryService: {
    uploadImage: jest.Mock;
    deleteImage: jest.Mock;
  };
  let redisClient: {
    get: jest.Mock;
    set: jest.Mock;
    del: jest.Mock;
  };

  const userId = 'user-123';
  const user = { user_id: userId, email: 'asha@example.com' } as User;

  beforeAll(async () => {
    const { ProfileService } = await import('./profile.service.js');
    createService = (...dependencies) => new ProfileService(...dependencies);
  });

  beforeEach(() => {
    profileRepository = {
      findOne: bunTest.mock(),
      create: bunTest.mock(),
      save: bunTest.mock(),
    };
    profileRepository.create.mockImplementation(
      (profile: Partial<Profile>) => profile,
    );
    profileRepository.save.mockImplementation(
      async (profile: Profile) => profile,
    );
    userRepository = { findOne: bunTest.mock() };
    cloudinaryService = {
      uploadImage: bunTest.mock(),
      deleteImage: bunTest.mock(),
    };
    redisClient = {
      get: bunTest.mock().mockResolvedValue(null),
      set: bunTest.mock().mockResolvedValue('OK'),
      del: bunTest.mock().mockResolvedValue(1),
    };

    service = createService(
      profileRepository as unknown as Repository<Profile>,
      userRepository as unknown as Repository<User>,
      cloudinaryService as unknown as CloudinaryService,
      { client: redisClient } as unknown as RedisService,
    );
  });

  describe('myProfile', () => {
    it('returns a cached profile without querying the repositories', async () => {
      const cachedProfile = { user_id: userId, full_name: 'Asha Patel' };
      redisClient.get.mockResolvedValue(JSON.stringify(cachedProfile));

      await expect(service.myProfile(userId)).resolves.toEqual(cachedProfile);
      expect(redisClient.get).toHaveBeenCalledWith(`profile:${userId}`);
      expect(profileRepository.findOne).not.toHaveBeenCalled();
      expect(userRepository.findOne).not.toHaveBeenCalled();
    });

    it('loads and caches an existing profile', async () => {
      const profile = { user_id: userId, full_name: 'Asha Patel' } as Profile;
      profileRepository.findOne.mockResolvedValue(profile);

      await expect(service.myProfile(userId)).resolves.toBe(profile);
      expect(profileRepository.findOne).toHaveBeenCalledWith({
        where: { user_id: userId },
      });
      expect(redisClient.set).toHaveBeenCalledWith(
        `profile:${userId}`,
        JSON.stringify(profile),
        'EX',
        3600,
      );
    });

    it('creates and caches a default profile when the user has none', async () => {
      const profile = { user_id: userId, full_name: 'asha' } as Profile;
      profileRepository.findOne.mockResolvedValue(null);
      userRepository.findOne.mockResolvedValue(user);
      profileRepository.create.mockReturnValue(profile);
      profileRepository.save.mockResolvedValue(profile);

      await expect(service.myProfile(userId)).resolves.toBe(profile);
      expect(profileRepository.create).toHaveBeenCalledWith({
        user_id: userId,
        full_name: 'asha',
      });
      expect(profileRepository.save).toHaveBeenCalledWith(profile);
      expect(redisClient.set).toHaveBeenCalledWith(
        `profile:${userId}`,
        JSON.stringify(profile),
        'EX',
        3600,
      );
    });

    it('throws when the authenticated user does not exist', async () => {
      profileRepository.findOne.mockResolvedValue(null);
      userRepository.findOne.mockResolvedValue(null);

      await expect(service.myProfile(userId)).rejects.toThrow(
        new NotFoundException('User account not found'),
      );
      expect(profileRepository.save).not.toHaveBeenCalled();
      expect(redisClient.set).not.toHaveBeenCalled();
    });
  });

  describe('updateProfile', () => {
    it('creates a profile, trims supplied fields, saves it, and clears its cache', async () => {
      userRepository.findOne.mockResolvedValue(user);
      profileRepository.findOne.mockResolvedValue(null);
      const input: UpdateProfileInput = {
        full_name: '  Asha Patel  ',
        phone: '  1234567890 ',
        address: '  Pune  ',
        gender: 'FEMALE' as UpdateProfileInput['gender'],
      };

      await expect(service.updateProfile(userId, input)).resolves.toBe(
        'Profile created successfully',
      );
      expect(profileRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: userId,
          full_name: 'Asha Patel',
        }),
      );
      expect(profileRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          full_name: 'Asha Patel',
          phone: '1234567890',
          address: 'Pune',
          gender: 'FEMALE',
        }),
      );
      expect(redisClient.del).toHaveBeenCalledWith(`profile:${userId}`);
    });

    it('updates an existing profile and keeps its image when the image is omitted', async () => {
      const profile = {
        user_id: userId,
        full_name: 'Old name',
        profile_image_url: 'https://images.example.com/avatar.jpg',
      } as Profile;
      userRepository.findOne.mockResolvedValue(user);
      profileRepository.findOne.mockResolvedValue(profile);

      await expect(
        service.updateProfile(userId, { full_name: '  New name  ' }),
      ).resolves.toBe('Profile updated successfully');
      expect(profile.full_name).toBe('New name');
      expect(profile.profile_image_url).toBe(
        'https://images.example.com/avatar.jpg',
      );
      expect(cloudinaryService.uploadImage).not.toHaveBeenCalled();
      expect(cloudinaryService.deleteImage).not.toHaveBeenCalled();
      expect(profileRepository.save).toHaveBeenCalledWith(profile);
    });

    it('replaces an existing image and deletes the previous Cloudinary image', async () => {
      const profile = {
        user_id: userId,
        full_name: 'Asha Patel',
        profile_image_url: 'https://images.example.com/old.jpg',
      } as Profile;
      userRepository.findOne.mockResolvedValue(user);
      profileRepository.findOne.mockResolvedValue(profile);
      cloudinaryService.uploadImage.mockResolvedValue(
        'https://images.example.com/new.jpg',
      );

      await service.updateProfile(userId, {
        profile_image: '  data:image/jpeg;base64,abc  ',
      });

      expect(cloudinaryService.uploadImage).toHaveBeenCalledWith(
        'data:image/jpeg;base64,abc',
        'amrutam/profiles',
      );
      expect(cloudinaryService.deleteImage).toHaveBeenCalledWith(
        'https://images.example.com/old.jpg',
      );
      expect(profile.profile_image_url).toBe(
        'https://images.example.com/new.jpg',
      );
    });

    it('removes an existing image when the input is empty', async () => {
      const profile = {
        user_id: userId,
        full_name: 'Asha Patel',
        profile_image_url: 'https://images.example.com/old.jpg',
      } as Profile;
      userRepository.findOne.mockResolvedValue(user);
      profileRepository.findOne.mockResolvedValue(profile);

      await service.updateProfile(userId, { profile_image: '' });

      expect(profile.profile_image_url).toBeNull();
      expect(cloudinaryService.deleteImage).toHaveBeenCalledWith(
        'https://images.example.com/old.jpg',
      );
      expect(cloudinaryService.uploadImage).not.toHaveBeenCalled();
    });

    it('throws without updating when the user does not exist', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(
        service.updateProfile(userId, { full_name: 'Asha Patel' }),
      ).rejects.toThrow(new NotFoundException('User account not found'));
      expect(profileRepository.findOne).not.toHaveBeenCalled();
      expect(profileRepository.save).not.toHaveBeenCalled();
    });
  });
});
