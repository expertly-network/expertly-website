// Ported from design/static_html/assets/admin-data.js:70-99 — the prototype's existing
// client-side-only super_admin/content_manager/reviewer model, made real (server-checked) by the
// Member Directory & Profiles session. This mapping is a backend constant, not a DB table — same
// "simplest thing that works, no admin UI exists to manage it yet" call already made for coupons
// (see docs/database-erd.md). Revisit if/when admins need to manage this mapping themselves.

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

export function adminRoleHasPermission(adminRole: AdminRole | null, permission: AdminPermission): boolean {
  // A plain admin with no admin_role set (every admin created before this session) is treated as
  // super_admin — see docs/database-erd.md's "Design decisions" note. Every admin created going
  // forward should get an explicit admin_role.
  const effectiveRole = adminRole ?? 'super_admin';
  return ADMIN_PERMISSIONS[effectiveRole].includes(permission);
}
