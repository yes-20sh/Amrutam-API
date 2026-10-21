import type { HealthResolver as HealthResolverType } from './health.resolver';
import type { HealthService as HealthServiceType } from './health.service';

const bunTest = require('bun:test') as {
  beforeAll: (callback: () => void | Promise<void>) => void;
  describe: (name: string, callback: () => void) => void;
  expect: jest.Expect;
  it: (name: string, callback: () => void | Promise<void>) => void;
  mock: () => jest.Mock;
};
const { beforeAll, describe, expect, it } = bunTest;

let createResolver: (service: HealthServiceType) => HealthResolverType;

describe('HealthResolver', () => {
  beforeAll(async () => {
    const { HealthResolver } = await import('./health.resolver.js');
    createResolver = (service) => new HealthResolver(service);
  });

  it('returns the health message from the service', () => {
    const healthService = {
      getHealth: bunTest.mock(),
    };
    const resolver = createResolver(
      healthService as unknown as HealthServiceType,
    );
    healthService.getHealth.mockReturnValue('Welcome to Amrutam API');

    expect(resolver.health()).toBe('Welcome to Amrutam API');
    expect(healthService.getHealth).toHaveBeenCalledTimes(1);
  });
});
