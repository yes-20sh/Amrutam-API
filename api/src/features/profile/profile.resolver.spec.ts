import type { UpdateProfileInput } from './dto/update-profile.input';
import type { ProfileEntity } from './entities/profile.entity';
import type { ProfileResolver as ProfileResolverType } from './profile.resolver';
import type { ProfileService as ProfileServiceType } from './profile.service';
import { ROLES } from '../../common/decorator/roles.decorator';

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

let createResolver: (service: ProfileServiceType) => ProfileResolverType;
let profileResolverClass: typeof import('./profile.resolver').ProfileResolver;

describe('ProfileResolver', () => {
  let resolver: ProfileResolverType;
  let profileService: {
    myProfile: jest.Mock;
    updateProfile: jest.Mock;
  };

  beforeAll(async () => {
    const { ProfileResolver } = await import('./profile.resolver.js');
    profileResolverClass = ProfileResolver;
    createResolver = (service) => new ProfileResolver(service);
  });

  beforeEach(() => {
    profileService = {
      myProfile: bunTest.mock(),
      updateProfile: bunTest.mock(),
    };
    resolver = createResolver(profileService as unknown as ProfileServiceType);
  });

  describe('myProfile', () => {
    it('returns the authenticated user profile from the service', async () => {
      const userId = 'user-123';
      const profile = { user_id: userId } as ProfileEntity;
      profileService.myProfile.mockResolvedValue(profile);

      await expect(resolver.myProfile(userId)).resolves.toBe(profile);
      expect(profileService.myProfile).toHaveBeenCalledWith(userId);
    });
  });

  describe('updateProfile', () => {
    it('passes the input and authenticated user ID to the service', async () => {
      const userId = 'user-123';
      const input = { full_name: 'Asha Patel' } as UpdateProfileInput;
      profileService.updateProfile.mockResolvedValue(
        'Profile updated successfully',
      );

      await expect(resolver.updateProfile(input, userId)).resolves.toBe(
        'Profile updated successfully',
      );
      expect(profileService.updateProfile).toHaveBeenCalledWith(userId, input);
    });
  });

  describe('role access', () => {
    it('allows patients, doctors, and admins to query and update profiles', () => {
      expect(
        Reflect.getMetadata(
          ROLES,
          Object.getOwnPropertyDescriptor(
            profileResolverClass.prototype,
            'myProfile',
          )?.value,
        ),
      ).toEqual(['PATIENT', 'DOCTOR', 'ADMIN']);
      expect(
        Reflect.getMetadata(
          ROLES,
          Object.getOwnPropertyDescriptor(
            profileResolverClass.prototype,
            'updateProfile',
          )?.value,
        ),
      ).toEqual(['PATIENT', 'DOCTOR', 'ADMIN']);
    });
  });
});
