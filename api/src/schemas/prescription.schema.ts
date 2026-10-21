import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Consultation } from './consultation.entity';

@Entity('prescriptions')
export class Prescription {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  prescription_id: string;

  @Column({ type: 'bigint' })
  consultation_id: string;

  @ManyToOne(() => Consultation, consultation => consultation.prescriptions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'consultation_id' })
  consultation: Consultation;

  @Column({ type: 'text' })
  diagnosis: string;

  @Column({ type: 'jsonb' })
  medication_details: object;

  @Column({ type: 'text', nullable: true })
  instructions: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  issued_at: Date;
}
