import type { HealthService as HealthServiceType } from './health.service';

const bunTest = require('bun:test') as {
  describe: (name: string, callback: () => void) => void;
  expect: jest.Expect;
  it: (name: string, callback: () => void | Promise<void>) => void;
};
const { describe, expect, it } = bunTest;

describe('HealthService', () => {
  it('returns the API welcome message', async () => {
    const { HealthService } = await import('./health.service.js');
    const service: HealthServiceType = new HealthService();

    expect(service.getHealth()).toBe('Welcome to Amrutam API');
  });
});
