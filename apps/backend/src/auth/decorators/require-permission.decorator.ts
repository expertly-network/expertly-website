import { SetMetadata } from '@nestjs/common';
import type { AdminPermission } from '../constants/admin-permissions';

export const REQUIRED_PERMISSION_KEY = 'requiredPermission';

// 🛡️ _permission_ per rest-api.md — e.g. @Roles('admin') @RequiresPermission('manageMembers').
// Always pair with @Roles('admin'); this decorator alone doesn't enforce the base admin role,
// AdminPermissionGuard just narrows further within it. Checked against a fresh DB read of
// profiles.admin_role, same posture RolesGuard already uses for the plain 'admin' role.
export const RequiresPermission = (permission: AdminPermission) =>
  SetMetadata(REQUIRED_PERMISSION_KEY, permission);
