import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../enum/user-role.enum';

export const ROLES = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES, roles);
