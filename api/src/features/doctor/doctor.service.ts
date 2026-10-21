import {
  Injectable,
  Logger,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Doctor } from '../../schemas/doctor.schema';
import { User } from '../../schemas/user.schema';
import { UserRole } from '../../common/enum/user-role.enum';
import { VerificationStatus } from '../../common/enum/verification-status.enum';
import { handleServiceError } from '../../utils/error/error.util';
import { CreateDoctorDto } from './dto/create-doctor.dto';
import { UpdateDoctorDto } from './dto/update-doctor.dto';
import { DoctorEntity } from './entities/doctor.entity';

@Injectable()
export class DoctorService {
  private readonly logger = new Logger(DoctorService.name);

  constructor(
    @InjectRepository(Doctor)
    private readonly doctorRepository: Repository<Doctor>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) { }

  /**
   * Insert: Create new doctor profile for the authenticated user.
   */
  async createDoctorProfile(
    userId: string,
    createDoctorDto: CreateDoctorDto,
  ): Promise<string> {
    try {
      // 1. Check if doctor profile already exists for this account
      const existingDoctor = await this.doctorRepository.findOne({
        where: { user_id: userId },
      });

      if (existingDoctor) {
        throw new ConflictException(
          'Doctor profile already exists for this account',
        );
      }

      // 2. Check license number uniqueness
      const existingLicense = await this.doctorRepository.findOne({
        where: { license_number: createDoctorDto.license_number.trim() },
      });

      if (existingLicense) {
        throw new ConflictException(
          'A doctor with this license number already exists',
        );
      }

      // 3. Verify user account exists
      const user = await this.userRepository.findOne({
        where: { user_id: userId },
        relations: { profile: true },
      });

      if (!user) {
        throw new NotFoundException('User account not found');
      }

      // 4. Ensure user role is updated to DOCTOR
      if (user.role !== UserRole.DOCTOR) {
        user.role = UserRole.DOCTOR;
        await this.userRepository.save(user);
      }

      // 5. Create doctor record
      const doctor = this.doctorRepository.create({
        user_id: userId,
        specialization: createDoctorDto.specialization.trim(),
        license_number: createDoctorDto.license_number.trim(),
        qualification: createDoctorDto.qualification.trim(),
        experience_years: createDoctorDto.experience_years ?? 0,
        consultation_fee: createDoctorDto.consultation_fee.trim(),
        verification_status: VerificationStatus.PENDING,
        bio: createDoctorDto.bio?.trim() || null,
      });

      await this.doctorRepository.save(doctor);

      return 'Doctor profile created successfully';
    } catch (error) {
      handleServiceError(error, this.logger, 'DoctorService.createDoctorProfile');
    }
  }


  async updateDoctorProfile(
    userId: string,
    updateDoctorDto: UpdateDoctorDto,
  ): Promise<string> {
    try {
      // 1. Find doctor profile belonging to the user
      const doctor = await this.doctorRepository.findOne({
        where: { user_id: userId },
        relations: { user: { profile: true } },
      });

      if (!doctor) {
        throw new NotFoundException('Doctor profile not found');
      }

      // 2. Apply updates
      if (updateDoctorDto.specialization !== undefined) {
        doctor.specialization = updateDoctorDto.specialization.trim();
      }

      if (updateDoctorDto.qualification !== undefined) {
        doctor.qualification = updateDoctorDto.qualification.trim();
      }

      if (updateDoctorDto.experience_years !== undefined) {
        doctor.experience_years = updateDoctorDto.experience_years;
      }

      if (updateDoctorDto.consultation_fee !== undefined) {
        doctor.consultation_fee = updateDoctorDto.consultation_fee.trim();
      }

      if (updateDoctorDto.bio !== undefined) {
        doctor.bio = updateDoctorDto.bio?.trim() || null;
      }

      await this.doctorRepository.save(doctor);
      return 'Doctor profile updated successfully';
    } catch (error) {
      handleServiceError(error, this.logger, 'DoctorService.updateDoctorProfile');
    }
  }


  async getDoctorProfile(userId: string): Promise<DoctorEntity> {
    try {
      const doctor = await this.doctorRepository.findOne({
        where: { user_id: userId },
        relations: { user: { profile: true } },
      });

      if (!doctor) {
        throw new NotFoundException('Doctor profile not found');
      }

      return doctor as unknown as DoctorEntity;
    } catch (error) {
      handleServiceError(error, this.logger, 'DoctorService.getDoctorProfile');
    }
  }


  async getDoctorById(doctorId: string): Promise<DoctorEntity> {
    try {
      const doctor = await this.doctorRepository.findOne({
        where: { doctor_id: doctorId },
        relations: { user: { profile: true } },
      });

      if (!doctor) {
        throw new NotFoundException('Doctor not found');
      }

      return doctor as unknown as DoctorEntity;
    } catch (error) {
      handleServiceError(error, this.logger, 'DoctorService.getDoctorById');
    }
  }

  async listDoctors(): Promise<DoctorEntity[]> {
    try {
      const doctors = await this.doctorRepository.find({
        relations: { user: { profile: true } },
        order: { created_at: 'DESC' },
      });

      return doctors as unknown as DoctorEntity[];
    } catch (error) {
      handleServiceError(error, this.logger, 'DoctorService.listDoctors');
    }
  }
}
