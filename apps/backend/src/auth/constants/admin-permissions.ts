export type AdminRole = 'super_admin' | 'content_manager' | 'reviewer';

export type AdminPermission =
  | 'viewDashboard'
  | 'manageApplications'
  | 'manageArticles'
  | 'writeArticles'
  | 'manageEvents'
  | 'deleteContent'
  | 'manageAdmins'
  | 'manageMembers'
  | 'manageConsultations'
  | 'manageResources';

const ALL_PERMISSIONS: AdminPermission[] = [
  'viewDashboard',
  'manageApplications',
  'manageArticles',
  'writeArticles',
  'manageEvents',
  'deleteContent',
  'manageAdmins',
  'manageMembers',
  'manageConsultations',
  'manageResources',
];

// Maps each admin role to its allowed permissions.
export const ADMIN_PERMISSIONS: Record<AdminRole, AdminPermission[]> = {
  super_admin: ALL_PERMISSIONS,
  content_manager: [
    'viewDashboard',
    'manageApplications',
    'manageArticles',
    'writeArticles',
    'manageEvents',
    'manageResources',
  ],
  reviewer: ['viewDashboard', 'manageApplications'],
};

// Returns whether the given admin role has the given permission. A null role is treated as super_admin.
export function adminRoleHasPermission(adminRole: AdminRole | null, permission: AdminPermission): boolean {
  const effectiveRole = adminRole ?? 'super_admin';
  return ADMIN_PERMISSIONS[effectiveRole].includes(permission);
}
