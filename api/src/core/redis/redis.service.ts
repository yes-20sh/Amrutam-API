import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  public client: Redis | null = null;
  public subClient: Redis | null = null;
  private isConnected = false;

  onModuleInit() {
    this.initClients();
  }

  private initClients() {
    const redisUrl = process.env.REDIS_URL;
    const isTls = redisUrl?.startsWith('rediss://');
    const redisOptions = {
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
      tls: isTls ? { rejectUnauthorized: false } : undefined,
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 500, 5000);
        return delay;
      },
    };

    try {
      this.client = redisUrl
        ? new Redis(redisUrl, redisOptions)
        : new Redis({
            host: process.env.REDIS_HOST || 'localhost',
            port: Number.parseInt(process.env.REDIS_PORT || '6379', 10),
            password: process.env.REDIS_PASSWORD || undefined,
            ...redisOptions,
          });

      this.subClient = redisUrl
        ? new Redis(redisUrl, redisOptions)
        : new Redis({
            host: process.env.REDIS_HOST || 'localhost',
            port: Number.parseInt(process.env.REDIS_PORT || '6379', 10),
            password: process.env.REDIS_PASSWORD || undefined,
            ...redisOptions,
          });

      this.client.on('connect', () => {
        this.isConnected = true;
        this.logger.log('Redis client connected successfully');
        this.enableKeyspaceNotifications();
      });

      this.client.on('error', (err) => {
        this.isConnected = false;
        this.logger.warn(`Redis connection error: ${err.message}`);
      });

      this.subClient.on('error', (err) => {
        this.logger.warn(`Redis subscriber connection error: ${err.message}`);
      });
    } catch (err: any) {
      this.logger.error(`Failed to initialize Redis clients: ${err.message}`);
    }
  }

  /**
   * Enable Redis Keyspace events for expired keys ('Ex')
   */
  private async enableKeyspaceNotifications() {
    if (!this.client) return;
    try {
      await this.client.config('SET', 'notify-keyspace-events', 'Ex');
      this.logger.log('Redis keyspace notifications (Ex) enabled for expiry tracking');
    } catch (err: any) {
      this.logger.warn(
        `Note on notify-keyspace-events: Managed Redis (e.g. Upstash) restricts CONFIG SET. (Fallback reconciliation worker handles expiry). Details: ${err.message}`,
      );
    }
  }

  /**
   * Concurrency / Reservation Hold:
   * Atomically acquires a hold on an availability slot for a given duration.
   * Returns true if acquired, false if already held by another user.
   */
  async acquireSlotHold(
    slotId: string,
    holderIdentifier: string,
    ttlSeconds = 600,
  ): Promise<boolean> {
    if (!this.client || !this.isConnected) {
      this.logger.warn('Redis unavailable, falling back to DB pessimistic lock');
      return true;
    }

    try {
      const key = `slot:hold:${slotId}`;
      const result = await this.client.set(key, holderIdentifier, 'EX', ttlSeconds, 'NX');
      return result === 'OK';
    } catch (err: any) {
      if (err.message?.includes('NOPERM') || err.message?.includes('READONLY')) {
        this.logger.error(
          "Redis Write Permission Denied: Your REDIS_URL uses 'default_ro' (Read-Only). To enable slot holds and cache writes, please provide the primary (read-write) Upstash URL ('default'). Falling back to DB pessimistic lock.",
        );
      } else {
        this.logger.warn(`Redis acquireSlotHold error: ${err.message}`);
      }
      return true; // Graceful fallback to PostgreSQL row lock
    }
  }

  /**
   * Release reservation hold on an availability slot
   */
  async releaseSlotHold(slotId: string): Promise<boolean> {
    if (!this.client || !this.isConnected) return false;
    try {
      const key = `slot:hold:${slotId}`;
      const deleted = await this.client.del(key);
      return deleted > 0;
    } catch (err: any) {
      this.logger.warn(`Redis releaseSlotHold error for slot ${slotId}: ${err.message}`);
      return false;
    }
  }

  /**
   * Get current hold metadata for a slot
   */
  async getSlotHold(slotId: string): Promise<string | null> {
    if (!this.client || !this.isConnected) return null;
    return this.client.get(`slot:hold:${slotId}`);
  }

  // --- Caching Utilities ---

  async getCache<T>(key: string): Promise<T | null> {
    if (!this.client || !this.isConnected) return null;
    try {
      const data = await this.client.get(key);
      return data ? (JSON.parse(data) as T) : null;
    } catch (err: any) {
      this.logger.warn(`Cache read failed for key "${key}": ${err.message}`);
      return null;
    }
  }

  async setCache(key: string, data: any, ttlSeconds = 120): Promise<void> {
    if (!this.client || !this.isConnected) return;
    try {
      const serialized = JSON.stringify(data);
      await this.client.set(key, serialized, 'EX', ttlSeconds);
    } catch (err: any) {
      this.logger.warn(`Cache write failed for key "${key}": ${err.message}`);
    }
  }

  async delCache(key: string): Promise<void> {
    if (!this.client || !this.isConnected) return;
    try {
      await this.client.del(key);
    } catch (err: any) {
      this.logger.warn(`Cache delete failed for key "${key}": ${err.message}`);
    }
  }

  async delByPattern(pattern: string): Promise<void> {
    if (!this.client || !this.isConnected) return;
    try {
      const stream = this.client.scanStream({ match: pattern, count: 100 });
      stream.on('data', (keys: string[]) => {
        if (keys.length && this.client) {
          const pipeline = this.client.pipeline();
          keys.forEach((key) => pipeline.del(key));
          pipeline.exec();
        }
      });
    } catch (err: any) {
      this.logger.warn(`Cache pattern delete failed for "${pattern}": ${err.message}`);
    }
  }

  /**
   * Helper: Invalidate cached availability slots for a doctor
   */
  async invalidateDoctorSlots(doctorId: string): Promise<void> {
    await this.delByPattern(`cache:slots:${doctorId}:*`);
    await this.delCache(`cache:doctor:${doctorId}:available_slots`);
  }

  onModuleDestroy() {
    if (this.client) this.client.disconnect();
    if (this.subClient) this.subClient.disconnect();
  }
}
