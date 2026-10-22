import { Injectable, Logger } from '@nestjs/common';
import {
  ThrottlerStorage,
  ThrottlerStorageService,
} from '@nestjs/throttler';
import { RedisService } from '../redis/redis.service';
import { ThrottlerStorageRecord } from '@nestjs/throttler/dist/throttler-storage-record.interface';

/**
 * Lua script for atomic rate limiting with optional block duration.
 * KEYS[1]: Rate limit key
 * KEYS[2]: Block key
 * ARGV[1]: TTL in milliseconds
 * ARGV[2]: Request limit
 * ARGV[3]: Block duration in milliseconds
 */
const LUA_RATE_LIMIT_SCRIPT = `
local mainKey = KEYS[1]
local blockKey = KEYS[2]
local ttl = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
local blockDuration = tonumber(ARGV[3])

local isBlocked = redis.call('EXISTS', blockKey)
if isBlocked == 1 then
    local blockPttl = redis.call('PTTL', blockKey)
    local mainPttl = redis.call('PTTL', mainKey)
    return { limit + 1, mainPttl, 1, blockPttl }
end

local currentHits = redis.call('INCR', mainKey)
if currentHits == 1 then
    redis.call('PEXPIRE', mainKey, ttl)
end

local pttl = redis.call('PTTL', mainKey)
local blocked = 0
local blockPttl = 0

if currentHits > limit then
    blocked = 1
    if blockDuration > 0 then
        redis.call('SET', blockKey, '1', 'PX', blockDuration)
        blockPttl = blockDuration
    end
end

return { currentHits, pttl, blocked, blockPttl }
`;

@Injectable()
export class ThrottlerStorageRedisService implements ThrottlerStorage {
  private readonly logger = new Logger(ThrottlerStorageRedisService.name);
  private readonly memoryFallback = new ThrottlerStorageService();

  constructor(private readonly redisService: RedisService) { }

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const client = this.redisService.client;

    // Graceful fallback to memory storage if Redis is offline
    if (!client) {
      return this.memoryFallback.increment(
        key,
        ttl,
        limit,
        blockDuration,
        throttlerName,
      );
    }

    try {
      const mainKey = `amrutam:throttle:${throttlerName}:${key}`;
      const blockKey = `${mainKey}:blocked`;

      const result = (await client.eval(
        LUA_RATE_LIMIT_SCRIPT,
        2,
        mainKey,
        blockKey,
        ttl,
        limit,
        blockDuration,
      )) as [number, number, number, number];

      const [totalHits, pttl, isBlocked, blockPttl] = result;

      const timeToExpire =
        pttl > 0 ? Math.ceil(pttl / 1000) : Math.ceil(ttl / 1000);
      const timeToBlockExpire =
        blockPttl > 0
          ? Math.ceil(blockPttl / 1000)
          : isBlocked
            ? timeToExpire
            : 0;

      return {
        totalHits: Number(totalHits),
        timeToExpire,
        isBlocked: isBlocked === 1,
        timeToBlockExpire,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Redis throttler error, falling back to in-memory counter: ${message}`,
      );
      return this.memoryFallback.increment(
        key,
        ttl,
        limit,
        blockDuration,
        throttlerName,
      );
    }
  }
}
