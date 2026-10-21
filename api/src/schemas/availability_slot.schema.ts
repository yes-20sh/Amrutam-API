import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, OneToMany } from 'typeorm';
import { Doctor } from './doctor.schema';
import { Consultation } from './consultation.schema';

@Entity('availability_slots')
export class AvailabilitySlot {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  slot_id: string;

  @Column({ type: 'bigint' })
  doctor_id: string;

  @ManyToOne(() => Doctor, doctor => doctor.availability_slots, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'doctor_id' })
  doctor: Doctor;

  @Column({ type: 'timestamptz' })
  start_time: Date;

  @Column({ type: 'timestamptz' })
  end_time: Date;

  @Column({ type: 'varchar', length: 20, default: 'AVAILABLE' })
  status: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  // Relations
  @OneToMany(() => Consultation, consultation => consultation.slot)
  consultations: Consultation[];

}
