import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Prescription } from '../../schemas/prescription.schema';
import { Consultation } from '../../schemas/consultation.schema';
import { handleServiceError } from '../../utils/error/error.util';
import { CreatePrescriptionDto } from './dto/create-prescription.dto';
import { UpdatePrescriptionDto } from './dto/update-prescription.dto';
import { PrescriptionEntity } from './entities/prescription.entity';

@Injectable()
export class PrescriptionService {
  private readonly logger = new Logger(PrescriptionService.name);

  constructor(
    @InjectRepository(Prescription)
    private readonly prescriptionRepository: Repository<Prescription>,
    @InjectRepository(Consultation)
    private readonly consultationRepository: Repository<Consultation>,
  ) {}

  /**
   * Insert: Doctor creates and issues a new prescription for a consultation.
   */
  async createPrescription(
    doctorUserId: string,
    createDto: CreatePrescriptionDto,
  ): Promise<string> {
    try {
      const consultation = await this.consultationRepository.findOne({
        where: { consultation_id: createDto.consultation_id },
        relations: {
          doctor: { user: { profile: true } },
          patient: { profile: true },
        },
      });

      if (!consultation) {
        throw new NotFoundException('Consultation not found');
      }

      if (consultation.doctor?.user_id !== doctorUserId) {
        throw new ForbiddenException(
          'Only the assigned doctor can issue prescriptions for this consultation',
        );
      }

      if (consultation.status === 'CANCELLED') {
        throw new BadRequestException(
          'Cannot issue prescriptions for a cancelled consultation',
        );
      }

      const prescription = this.prescriptionRepository.create({
        consultation_id: createDto.consultation_id,
        diagnosis: createDto.diagnosis.trim(),
        medication_details: createDto.medication_details,
        instructions: createDto.instructions?.trim() || null,
      });

      await this.prescriptionRepository.save(prescription);

      return 'Prescription created successfully';
    } catch (error) {
      handleServiceError(
        error,
        this.logger,
        'PrescriptionService.createPrescription',
      );
    }
  }

  /**
   * Update: Doctor updates an existing prescription.
   */
  async updatePrescription(
    doctorUserId: string,
    prescriptionId: string,
    updateDto: UpdatePrescriptionDto,
  ): Promise<string> {
    try {
      const prescription = await this.prescriptionRepository.findOne({
        where: { prescription_id: prescriptionId },
        relations: {
          consultation: {
            doctor: { user: { profile: true } },
            patient: { profile: true },
          },
        },
      });

      if (!prescription) {
        throw new NotFoundException('Prescription not found');
      }

      if (prescription.consultation?.doctor?.user_id !== doctorUserId) {
        throw new ForbiddenException(
          'Only the issuing doctor can modify this prescription',
        );
      }

      if (updateDto.diagnosis !== undefined) {
        prescription.diagnosis = updateDto.diagnosis.trim();
      }

      if (updateDto.medication_details !== undefined) {
        prescription.medication_details = updateDto.medication_details;
      }

      if (updateDto.instructions !== undefined) {
        prescription.instructions = updateDto.instructions?.trim() || null;
      }

      await this.prescriptionRepository.save(prescription);
      return 'Prescription updated successfully';
    } catch (error) {
      handleServiceError(
        error,
        this.logger,
        'PrescriptionService.updatePrescription',
      );
    }
  }

  /**
   * Get: Retrieve a single prescription by ID.
   */
  async getPrescriptionById(
    prescriptionId: string,
    userId?: string,
  ): Promise<PrescriptionEntity> {
    try {
      const prescription = await this.prescriptionRepository.findOne({
        where: { prescription_id: prescriptionId },
        relations: {
          consultation: {
            doctor: { user: { profile: true } },
            patient: { profile: true },
          },
        },
      });

      if (!prescription) {
        throw new NotFoundException('Prescription not found');
      }

      if (userId) {
        const isPatient = prescription.consultation?.patient_id === userId;
        const isDoctor =
          prescription.consultation?.doctor?.user_id === userId;

        if (!isPatient && !isDoctor) {
          throw new ForbiddenException(
            'You are not authorized to view this prescription',
          );
        }
      }

      return prescription as unknown as PrescriptionEntity;
    } catch (error) {
      handleServiceError(
        error,
        this.logger,
        'PrescriptionService.getPrescriptionById',
      );
    }
  }

  /**
   * Get: Retrieve all prescriptions associated with a specific consultation.
   */
  async getPrescriptionsByConsultation(
    userId: string,
    consultationId: string,
  ): Promise<PrescriptionEntity[]> {
    try {
      const consultation = await this.consultationRepository.findOne({
        where: { consultation_id: consultationId },
        relations: {
          doctor: { user: true },
          patient: true,
        },
      });

      if (!consultation) {
        throw new NotFoundException('Consultation not found');
      }

      const isPatient = consultation.patient_id === userId;
      const isDoctor = consultation.doctor?.user_id === userId;

      if (!isPatient && !isDoctor) {
        throw new ForbiddenException(
          'You are not authorized to view prescriptions for this consultation',
        );
      }

      const prescriptions = await this.prescriptionRepository.find({
        where: { consultation_id: consultationId },
        relations: {
          consultation: {
            doctor: { user: { profile: true } },
            patient: { profile: true },
          },
        },
        order: { issued_at: 'DESC' },
      });

      return prescriptions as unknown as PrescriptionEntity[];
    } catch (error) {
      handleServiceError(
        error,
        this.logger,
        'PrescriptionService.getPrescriptionsByConsultation',
      );
    }
  }

  /**
   * Get: List all prescriptions for the current authenticated user (patient or doctor).
   */
  async myPrescriptions(userId: string): Promise<PrescriptionEntity[]> {
    try {
      const prescriptions = await this.prescriptionRepository
        .createQueryBuilder('prescription')
        .leftJoinAndSelect('prescription.consultation', 'consultation')
        .leftJoinAndSelect('consultation.doctor', 'doctor')
        .leftJoinAndSelect('doctor.user', 'doctorUser')
        .leftJoinAndSelect('doctorUser.profile', 'doctorProfile')
        .leftJoinAndSelect('consultation.patient', 'patient')
        .leftJoinAndSelect('patient.profile', 'patientProfile')
        .where(
          'consultation.patient_id = :userId OR doctor.user_id = :userId',
          { userId },
        )
        .orderBy('prescription.issued_at', 'DESC')
        .getMany();

      return prescriptions as unknown as PrescriptionEntity[];
    } catch (error) {
      handleServiceError(
        error,
        this.logger,
        'PrescriptionService.myPrescriptions',
      );
    }
  }

}

