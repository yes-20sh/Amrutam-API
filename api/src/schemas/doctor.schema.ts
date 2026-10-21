import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn, OneToMany, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { User } from './user.schema';
import { Consultation } from './consultation.schema';
import { AvailabilitySlot } from './availability_slot.schema';

@Entity('doctors')
export class Doctor {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  doctor_id: string;

  @Column({ type: 'bigint', unique: true })
  user_id: string;

  @OneToOne(() => User, user => user.doctor)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'varchar', length: 100 })
  specialization: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  license_number: string;

  @Column({ type: 'varchar', length: 255 })
  qualification: string;

  @Column({ type: 'smallint', default: 0 })
  experience_years: number;

  @Column({ type: 'numeric', precision: 10, scale: 2 })
  consultation_fee: string;

  @Column({ type: 'varchar', length: 20, default: 'PENDING' })
  verification_status: string;

  @Column({ type: 'text', nullable: true })
  bio: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  // Relations
  @OneToMany(() => AvailabilitySlot, slot => slot.doctor)
  availability_slots: AvailabilitySlot[];

  @OneToMany(() => Consultation, consultation => consultation.doctor)
  consultations: Consultation[];
}
