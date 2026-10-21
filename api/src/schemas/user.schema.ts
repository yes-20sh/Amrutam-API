import { Entity, PrimaryGeneratedColumn, Column, OneToOne, OneToMany, CreateDateColumn, UpdateDateColumn, Unique } from 'typeorm';
import { Profile } from './profile.schema';
import { Doctor } from './doctor.schema';
import { Consultation } from './consultation.schema';
import { AuditLog } from './audit_log.schema';
import { UserRole } from '../common/enum/user-role.enum';
import { UserStatus } from '../common/enum/user-status.enum';

@Entity('users')
@Unique(['email'])
export class User {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  user_id: string; // using string to accommodate bigint

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 255 })
  password_hash: string;

  @Column({ type: 'enum', enum: UserRole })
  role: UserRole;

  @Column({ type: 'enum', enum: UserStatus, default: UserStatus.ACTIVE })
  status: UserStatus;

  @Column({ type: 'boolean', default: false })
  email_verified: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  last_login_at: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  // Relations
  @OneToOne(() => Profile, profile => profile.user)
  profile: Profile;

  @OneToOne(() => Doctor, doctor => doctor.user)
  doctor: Doctor;

  @OneToMany(() => Consultation, consultation => consultation.patient)
  consultations: Consultation[];

  @OneToMany(() => AuditLog, auditLog => auditLog.user)
  audit_logs: AuditLog[];
}
