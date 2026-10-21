import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { Consultation } from './consultation.schema';

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  payment_id: string;

  @Column({ type: 'uuid' })
  consultation_id: string;

  @ManyToOne(() => Consultation, consultation => consultation.payments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'consultation_id' })
  consultation: Consultation;

  @Column({ type: 'numeric', precision: 10, scale: 2 })
  amount: string;

  @Column({ type: 'char', length: 3, default: 'INR' })
  currency: string;

  @Column({ type: 'varchar', length: 30 })
  payment_method: string;

  @Column({ type: 'varchar', length: 20, default: 'PENDING' })
  payment_status: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  transaction_reference: string;

  @Column({ type: 'timestamptz', nullable: true })
  paid_at: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
