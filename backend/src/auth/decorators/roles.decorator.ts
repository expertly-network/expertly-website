import { SetMetadata } from '@nestjs/common';
import type { Role } from '../types/auth.types';

export const ROLES_KEY = 'roles';

// 👤 Member / 🛡️ Admin per rest-api.md — e.g. @Roles('member') or @Roles('admin').
// Checked by RolesGuard against the role RESOLVED FROM THE DB by
// SupabaseAuthGuard, never a client-asserted value. Higher roles satisfy lower
// requirements (admin passes @Roles('member')) via ROLE_RANK.
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
