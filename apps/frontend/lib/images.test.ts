import { describe, expect, it } from 'vitest';
import { mustHotlink } from './images';

describe('mustHotlink', () => {
  it.each([
    'https://project.supabase.test/storage/v1/object/public/application-assets/members/x.png',
    'https://randomuser.me/api/portraits/women/1.jpg',
    '/images/hero.png',
  ])('lets next/image optimise %j', (src) => {
    expect(mustHotlink(src)).toBe(false);
  });

  it.each([
    'https://images.unsplash.com/photo-123',
    'https://media.licdn.com/dms/image/abc',
    'https://lh3.googleusercontent.com/a/abc',
    // A different Supabase project, or a non-public bucket path, is not on the allow-list.
    'https://other.supabase.test/storage/v1/object/public/x.png',
    'https://project.supabase.test/storage/v1/object/sign/private/x.png',
    'https://randomuser.me/other/1.jpg',
    '//evil.com/x.png',
    'not a url',
  ])('loads %j directly (unoptimized)', (src) => {
    expect(mustHotlink(src)).toBe(true);
  });
});
