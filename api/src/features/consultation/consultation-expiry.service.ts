import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { RedisService } from '../../core/redis/redis.service';
import { AvailabilitySlot } from '../../schemas/availability_slot.schema';
import { Consultation } from '../../schemas/consultation.schema';

@Injectable()
export class ConsultationExpiryService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(ConsultationExpiryService.name);
  private reconciliationTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly redisService: RedisService,
    private readonly dataSource: DataSource,
  ) {}

  onModuleInit() {
    this.setupRedisSubscriber();
    this.startReconciliationWorker();
  }

  private setupRedisSubscriber() {
    const sub = this.redisService.subClient;
    if (!sub) return;

    // Listen to expired keyspace events on DB 0
    sub.subscribe('__keyevent@0__:expired', (err) => {
      if (err) {
        this.logger.error(
          `Failed to subscribe to Redis expired events: ${err.message}`,
        );
      } else {
        this.logger.log(
          'Subscribed to Redis keyspace expired events for slot holds',
        );
      }
    });

    sub.on('message', async (_channel: string, expiredKey: string) => {
      if (expiredKey.startsWith('slot:hold:')) {
        const slotId = expiredKey.replace('slot:hold:', '');
        this.logger.warn(
          `Slot hold expired in Redis for slot ${slotId}. Triggering Saga compensation...`,
        );
        await this.compensateExpiredSlot(slotId);
      }
    });
  }

  /**
   * SAGA COMPENSATING ACTION:
   * When a payment was not completed within the 10-minute window,
   * rollback the slot to AVAILABLE and set the consultation to EXPIRED.
   */
  async compensateExpiredSlot(slotId: string): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const slot = await queryRunner.manager.findOne(AvailabilitySlot, {
        where: { slot_id: slotId },
      });

      if (!slot) {
        await queryRunner.rollbackTransaction();
        return;
      }

      // Only compensate if slot is still in HELD status (not BOOKED)
      if (slot.status === 'HELD') {
        slot.status = 'AVAILABLE';
        await queryRunner.manager.save(slot);

        // Expire any pending payment consultation on this slot
        await queryRunner.manager
          .createQueryBuilder()
          .update(Consultation)
          .set({ status: 'EXPIRED' })
          .where('slot_id = :slotId AND status = :status', {
            slotId,
            status: 'PENDING_PAYMENT',
          })
          .execute();

        this.logger.log(
          `Saga compensation complete: Slot ${slotId} released back to AVAILABLE.`,
        );

        // Invalidate doctor's slot cache in Redis
        if (slot.doctor_id) {
          await this.redisService.invalidateDoctorSlots(slot.doctor_id);
        }
      }

      await queryRunner.commitTransaction();
    } catch (err: any) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Failed to execute compensation for slot ${slotId}: ${err.message}`,
      );
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Fallback Reconciliation Worker:
   * Runs every 60 seconds to catch any expired holds where hold_expires_at < NOW()
   * in case of server restart or missed Redis pub/sub notifications.
   */
  private startReconciliationWorker() {
    this.reconciliationTimer = setInterval(async () => {
      try {
        const hasLock = await this.redisService.acquireLock(
          'reconciliation:worker',
          55,
        );
        if (!hasLock) {
          return;
        }

        const expiredConsultations = await this.dataSource
          .getRepository(Consultation)
          .createQueryBuilder('c')
          .where('c.status = :status', { status: 'PENDING_PAYMENT' })
          .andWhere('c.hold_expires_at IS NOT NULL')
          .andWhere('c.hold_expires_at < :now', { now: new Date() })
          .getMany();

        for (const consultation of expiredConsultations) {
          if (consultation.slot_id) {
            await this.compensateExpiredSlot(consultation.slot_id);
            // Also ensure Redis hold key is cleared
            await this.redisService.releaseSlotHold(consultation.slot_id);
          }
        }
      } catch (err: any) {
        this.logger.warn(`Reconciliation worker warning: ${err.message}`);
      }
    }, 60000);
  }

  onModuleDestroy() {
    if (this.reconciliationTimer) {
      clearInterval(this.reconciliationTimer);
    }
  }
}
