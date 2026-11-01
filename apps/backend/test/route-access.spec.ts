import 'reflect-metadata';
import { RequestMethod, type Type } from '@nestjs/common';
import { GUARDS_METADATA, METHOD_METADATA, MODULE_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { IS_PUBLIC_KEY } from '../src/auth/decorators/public.decorator';
import { ROLES_KEY } from '../src/auth/decorators/roles.decorator';
import { REQUIRED_PERMISSION_KEY } from '../src/auth/decorators/require-permission.decorator';
import { RATE_LIMIT_KEY, type RateLimitPolicy } from '../src/common/rate-limit/rate-limit.decorator';

// The access rule of every route registered in AppModule, read straight off the Nest metadata the
// global guards act on. A route that silently gains @Public(), loses @Roles()/@RequiresPermission()
// or its rate-limit bucket shows up here as a diff against EXPECTED.
//
// Notation: `public` (@Public), `authed` (any signed-in active account), `member` (@Roles('member'),
// rank model so admins pass too), `admin` (@Roles('admin'), fresh DB re-check), `admin:<perm>`
// (+ @RequiresPermission). Suffixes: `rl=<bucket>` (@RateLimit; otherwise DEFAULT_RATE_LIMIT),
// `+<Guard>` for route-level guards.
const EXPECTED: Record<string, string> = {
  // App / health
  'GET /v1/health': 'public',
  'GET /v1/health/ready': 'public',
  'GET /v1/hello': 'public',

  // Auth
  'GET /v1/me': 'authed',
  'GET /v1/me/contact': 'authed',
  'GET /v1/member/ping': 'member',
  'GET /v1/admin/ping': 'admin',

  // Resources — public, with an optional bearer that unlocks role-shaped content
  'GET /v1/perks': 'public +OptionalResourceAuthGuard',
  'GET /v1/perks/:slug': 'public +OptionalResourceAuthGuard',
  'GET /v1/learnings': 'public +OptionalResourceAuthGuard',
  'GET /v1/learnings/:id': 'public +OptionalResourceAuthGuard',
  'GET /v1/templates': 'public +OptionalResourceAuthGuard',
  'GET /v1/templates/:id': 'public +OptionalResourceAuthGuard',
  'GET /v1/collections': 'public +OptionalResourceAuthGuard',
  'GET /v1/collections/:id': 'public +OptionalResourceAuthGuard',
  'POST /v1/templates/:id/download': 'member',
  'GET /v1/admin/perks': 'admin:manageResources',
  'GET /v1/admin/perks/:id': 'admin:manageResources',
  'POST /v1/admin/perks': 'admin:manageResources',
  'PATCH /v1/admin/perks/:id': 'admin:manageResources',
  'DELETE /v1/admin/perks/:id': 'admin:manageResources',
  'GET /v1/admin/learnings': 'admin:manageResources',
  'GET /v1/admin/learnings/:id': 'admin:manageResources',
  'POST /v1/admin/learnings': 'admin:manageResources',
  'PATCH /v1/admin/learnings/:id': 'admin:manageResources',
  'DELETE /v1/admin/learnings/:id': 'admin:manageResources',
  'GET /v1/admin/collections': 'admin:manageResources',
  'GET /v1/admin/collections/:id': 'admin:manageResources',
  'POST /v1/admin/collections': 'admin:manageResources',
  'PATCH /v1/admin/collections/:id': 'admin:manageResources',
  'DELETE /v1/admin/collections/:id': 'admin:manageResources',
  'GET /v1/admin/templates': 'admin:manageResources',
  'GET /v1/admin/templates/:id': 'admin:manageResources',
  'POST /v1/admin/templates/upload': 'admin:manageResources',
  'POST /v1/admin/templates': 'admin:manageResources',
  'PATCH /v1/admin/templates/:id': 'admin:manageResources',
  'DELETE /v1/admin/templates/:id': 'admin:manageResources',

  // Taxonomy
  'GET /v1/categories': 'public',
  'GET /v1/service-lines': 'public',
  'GET /v1/admin/categories': 'admin:manageTaxonomy',
  'POST /v1/admin/categories': 'admin:manageTaxonomy',
  'PATCH /v1/admin/categories/:id': 'admin:manageTaxonomy',
  'DELETE /v1/admin/categories/:id': 'admin:manageTaxonomy',
  'POST /v1/admin/categories/:categoryId/services': 'admin:manageTaxonomy',
  'PATCH /v1/admin/services/:id': 'admin:manageTaxonomy',
  'DELETE /v1/admin/services/:id': 'admin:manageTaxonomy',

  // Membership applications (client-only is enforced in the service, not by @Roles)
  'POST /v1/applications/me': 'authed rl=application-save',
  'GET /v1/applications/me': 'authed',
  'POST /v1/applications/me/linkedin-import': 'authed rl=linkedin-import',
  'POST /v1/applications/me/coupon-preview': 'authed rl=coupon',
  'POST /v1/applications/me/photo/linkedin': 'authed rl=upload',
  'POST /v1/applications/me/uploads': 'authed rl=upload',
  'GET /v1/admin/applications': 'admin:manageApplications',
  'GET /v1/admin/applications/:id': 'admin:manageApplications',
  'PATCH /v1/admin/applications/:id': 'admin:manageApplications',

  // Members
  'GET /v1/members': 'public',
  'GET /v1/members/me/profile': 'member',
  'GET /v1/members/:slug': 'authed',
  'POST /v1/members/:id/uploads': 'member rl=upload',
  'POST /v1/members/:id/edits': 'member rl=write',
  'PATCH /v1/members/:id': 'member',
  'GET /v1/members/:id/edits': 'authed',
  'GET /v1/admin/members': 'admin:manageMembers',
  'PATCH /v1/admin/members/:id': 'admin:manageMembers',
  'GET /v1/admin/members/:id/edits': 'admin:manageMembers',
  'GET /v1/admin/member-edits': 'admin:manageMembers',
  'PATCH /v1/admin/member-edits/:id': 'admin:manageMembers',

  // Recommendations
  'GET /v1/members/:id/recommendations': 'authed',
  'POST /v1/members/:id/recommendations': 'member rl=write',
  'PATCH /v1/members/:id/recommendations/:recommendationId': 'member',

  // Events
  'GET /v1/events': 'public',
  'GET /v1/events/days': 'public',
  'GET /v1/events/organisers': 'public',
  'GET /v1/events/stats': 'public',
  'GET /v1/events/calendar': 'public',
  'GET /v1/admin/events': 'admin:manageEvents',
  'GET /v1/admin/events/export': 'admin:manageEvents',
  'POST /v1/admin/events/import': 'admin:manageEvents',
  'GET /v1/admin/events/:id': 'admin:manageEvents',
  'POST /v1/admin/events': 'admin:manageEvents',
  'PATCH /v1/admin/events/:id': 'admin:manageEvents',
  'DELETE /v1/admin/events/:id': 'admin:manageEvents',

  // Consultations
  'POST /v1/consultations': 'authed rl=write',
  'GET /v1/consultations/can-request/:memberId': 'authed',
  'GET /v1/consultations/mine': 'authed',
  'GET /v1/consultations/received': 'authed',
  'PATCH /v1/consultations/:id': 'authed',
  'GET /v1/consultations/:id/messages': 'authed',
  'POST /v1/consultations/:id/messages': 'authed rl=write',
  'GET /v1/admin/consultations': 'admin:manageConsultations',
  'PATCH /v1/admin/consultations/:id': 'admin:manageConsultations',

  // Articles
  'GET /v1/articles': 'public',
  'GET /v1/articles/:idOrSlug': 'authed',
  'GET /v1/articles/:idOrSlug/preview': 'public',
  'GET /v1/articles/me': 'authed',
  'GET /v1/articles/cover-images': 'member rl=cover-images',
  'POST /v1/articles/ai-followup-questions': 'member rl=ai',
  'POST /v1/articles/ai-draft': 'member rl=ai-draft',
  'POST /v1/articles/ai-refine': 'member rl=ai',
  'POST /v1/articles/suggest-topics': 'member rl=ai',
  'POST /v1/articles': 'member rl=write',
  'PATCH /v1/articles/:id': 'member',
  'DELETE /v1/articles/:id': 'member',
  'GET /v1/admin/articles': 'admin:manageArticles',
  'PATCH /v1/admin/articles/:id': 'admin:manageArticles',
  'GET /v1/admin/ai-generations': 'admin:manageArticles',
  'GET /v1/admin/ai-generations/:id': 'admin:manageArticles',

  // AI search (own throttler on top of the global per-user limit)
  'POST /v1/search': 'authed +SearchThrottlerGuard',
};

interface RouteMeta {
  key: string;
  isPublic: boolean;
  roles: string[];
  permission: string | undefined;
  rateLimit: RateLimitPolicy | undefined;
  guards: string[];
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
type Target = Function;

function registeredControllers(root: Type): Type[] {
  const seen = new Set<unknown>();
  const controllers: Type[] = [];
  const visit = (mod: unknown): void => {
    if (!mod || seen.has(mod)) return;
    seen.add(mod);
    controllers.push(...((Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, mod as Target) ?? []) as Type[]));
    for (const imported of (Reflect.getMetadata(MODULE_METADATA.IMPORTS, mod as Target) ?? []) as unknown[]) {
      visit(imported);
    }
  };
  visit(root);
  return controllers;
}

function joinPath(...parts: (string | string[] | undefined)[]): string {
  const segments = parts.flatMap((p) => (Array.isArray(p) ? p : [p ?? ''])).join('/');
  return `/${segments}`.replace(/\/+/g, '/').replace(/(.)\/$/, '$1');
}

// Handler metadata wins over class metadata — the same precedence as Reflector.getAllAndOverride.
function meta<T>(key: string, handler: Target, cls: Target): T | undefined {
  return (Reflect.getMetadata(key, handler) ?? Reflect.getMetadata(key, cls)) as T | undefined;
}

function collectRoutes(): RouteMeta[] {
  const routes: RouteMeta[] = [];
  for (const controller of registeredControllers(AppModule)) {
    const base = Reflect.getMetadata(PATH_METADATA, controller) as string | string[] | undefined;
    const proto = controller.prototype as Record<string, unknown>;
    for (const name of Object.getOwnPropertyNames(proto)) {
      const handler = proto[name];
      if (name === 'constructor' || typeof handler !== 'function') continue;
      const path = Reflect.getMetadata(PATH_METADATA, handler) as string | string[] | undefined;
      if (path === undefined) continue;
      const method = RequestMethod[Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod];
      const guards = [
        ...((Reflect.getMetadata(GUARDS_METADATA, controller) ?? []) as Target[]),
        ...((Reflect.getMetadata(GUARDS_METADATA, handler) ?? []) as Target[]),
      ];
      routes.push({
        key: `${method} ${joinPath('v1', base, path)}`,
        isPublic: meta<boolean>(IS_PUBLIC_KEY, handler, controller) === true,
        roles: meta<string[]>(ROLES_KEY, handler, controller) ?? [],
        permission: meta<string>(REQUIRED_PERMISSION_KEY, handler, controller),
        rateLimit: meta<RateLimitPolicy>(RATE_LIMIT_KEY, handler, controller),
        guards: guards.map((g) => g.name),
      });
    }
  }
  return routes;
}

function describeAccess(route: RouteMeta): string {
  let access = route.isPublic ? 'public' : route.roles.length ? route.roles.join('|') : 'authed';
  if (route.permission) access += `:${route.permission}`;
  if (route.rateLimit) access += ` rl=${route.rateLimit.bucket}`;
  for (const guard of route.guards) access += ` +${guard}`;
  return access;
}

describe('route access matrix', () => {
  const routes = collectRoutes();

  it('registers each method+path once', () => {
    const keys = routes.map((r) => r.key);
    expect(keys.filter((k, i) => keys.indexOf(k) !== i)).toEqual([]);
  });

  it('matches the expected access table exactly (no route added, dropped or re-gated silently)', () => {
    const actual = Object.fromEntries(routes.map((r) => [r.key, describeAccess(r)]));
    expect(actual).toEqual(EXPECTED);
  });

  it('never combines @Public() with a role or permission requirement', () => {
    expect(routes.filter((r) => r.isPublic && (r.roles.length > 0 || r.permission)).map((r) => r.key)).toEqual([]);
  });

  it('pairs every @RequiresPermission() with @Roles("admin")', () => {
    expect(routes.filter((r) => r.permission && !r.roles.includes('admin')).map((r) => r.key)).toEqual([]);
  });

  it('gates every /v1/admin/* route with the admin role and (except the ping) a permission', () => {
    const adminRoutes = routes.filter((r) => r.key.split(' ')[1].startsWith('/v1/admin'));
    expect(adminRoutes.length).toBeGreaterThan(40);
    expect(adminRoutes.filter((r) => r.isPublic || !r.roles.includes('admin')).map((r) => r.key)).toEqual([]);
    expect(adminRoutes.filter((r) => !r.permission).map((r) => r.key)).toEqual(['GET /v1/admin/ping']);
  });

  it('gives every paid / expensive route its own rate-limit bucket', () => {
    const bucketOf = (key: string) => routes.find((r) => r.key === key)?.rateLimit?.bucket;
    expect(bucketOf('POST /v1/articles/ai-draft')).toBe('ai-draft');
    expect(bucketOf('POST /v1/applications/me/linkedin-import')).toBe('linkedin-import');
    expect(bucketOf('POST /v1/applications/me/coupon-preview')).toBe('coupon');
    expect(bucketOf('GET /v1/articles/cover-images')).toBe('cover-images');
  });
});
