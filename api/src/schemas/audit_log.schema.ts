import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';
import { AuditLogAction } from '../common/enum/audit-action.enum';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  audit_id: string;

  @Column({ type: 'varchar', length: 255 })
  api_name: string;

  @Column({ type: 'text' })
  error: string;

  @Column({
    type: 'enum',
    enum: AuditLogAction,
    default: AuditLogAction.PENDING,
  })
  action: AuditLogAction;

  @Column({ type: 'uuid', nullable: true })
  user_id: string | null;

  @Column({ type: 'inet', nullable: true })
  ip_address: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
