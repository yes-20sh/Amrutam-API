import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { User } from './user.schema';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  audit_id: string;

  @Column({ type: 'uuid', nullable: true })
  user_id: string | null;

  @ManyToOne(() => User, user => user.audit_logs, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user: User | null;

  @Column({ type: 'varchar', length: 100 })
  action: string;

  @Column({ type: 'varchar', length: 100 })
  entity_name: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  entity_id: string | null;

  @Column({ type: 'inet', nullable: true })
  ip_address: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
