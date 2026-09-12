import { SetMetadata } from '@nestjs/common';
import type { AdminPermission } from '../constants/admin-permissions';

export const REQUIRED_PERMISSION_KEY = 'requiredPermission';

// Sets the admin permission required to access a route. Pair with @Roles('admin').
export const RequiresPermission = (permission: AdminPermission) =>
  SetMetadata(REQUIRED_PERMISSION_KEY, permission);
