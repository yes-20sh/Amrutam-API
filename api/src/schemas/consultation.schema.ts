import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { User } from './user.schema';
import { Doctor } from './doctor.schema';
import { AvailabilitySlot } from './availability_slot.schema';
import { Prescription } from './prescription.schema';
import { Payment } from './payment.schema';

@Entity('consultations')
export class Consultation {
  @PrimaryGeneratedColumn('uuid')
  consultation_id: string;

  @Column({ type: 'uuid' })
  patient_id: string;

  @Column({ type: 'uuid' })
  doctor_id: string;

  @Column({ type: 'uuid', nullable: true })
  slot_id: string | null;

  @ManyToOne(() => User, user => user.consultations, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patient_id' })
  patient: User;

  @ManyToOne(() => Doctor, doctor => doctor.consultations, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'doctor_id' })
  doctor: Doctor;

  @ManyToOne(() => AvailabilitySlot, slot => slot.consultations, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'slot_id' })
  slot: AvailabilitySlot | null;

  @Column({ type: 'timestamptz' })
  scheduled_at: Date;

  @Column({ type: 'varchar', length: 20 })
  consultation_type: string; // ONLINE or IN_PERSON

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @Column({ type: 'varchar', length: 20, default: 'PENDING_PAYMENT' })
  status: string;

  @Column({ type: 'timestamptz', nullable: true })
  hold_expires_at: Date | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  // Relations
  @OneToMany(() => Prescription, prescription => prescription.consultation)
  prescriptions: Prescription[];

  @OneToMany(() => Payment, payment => payment.consultation)
  payments: Payment[];
}
