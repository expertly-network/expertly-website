import { SetMetadata } from '@nestjs/common';
import type { Role } from '../types/auth.types';

export const ROLES_KEY = 'roles';

// Sets the roles allowed to access a route, e.g. @Roles('member') or @Roles('admin').
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
