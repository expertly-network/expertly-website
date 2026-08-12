import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

// 🌐 Public per rest-api.md's access-level convention — opts a route out of the
// globally-applied SupabaseAuthGuard entirely. Everything else defaults to
// requiring a valid bearer token (🔑 Auth minimum) unless marked with this.
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
