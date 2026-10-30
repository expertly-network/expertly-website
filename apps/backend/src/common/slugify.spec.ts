import { InternalServerErrorException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { argsOf, fakeDb } from '../../test/helpers/fake-supabase';
import {
  SlugTakenException,
  generateUniqueSlug,
  generateUniqueSlugs,
  isSlugUniqueViolation,
  slugify,
  withUniqueSlugRetry,
} from './slugify';

// A slugs table: `.in('slug', chunk)` answers with whichever of the chunk is already taken.
function slugTable(taken: Iterable<string>) {
  const existing = new Set(taken);
  return fakeDb((call) => {
    const [, chunk] = argsOf(call, 'in') as [string, string[]];
    return { data: chunk.filter((s) => existing.has(s)).map((slug) => ({ slug })) };
  });
}

describe('slugify', () => {
  it.each([
    ['Hello, World!', 'hello-world'],
    ['  Tax  &  GST — 2026  ', 'tax-gst-2026'],
    ['---a---b---', 'a-b'],
    ['Café Déjà Vu', 'caf-d-j-vu'],
  ])('%j → %j', (title, slug) => {
    expect(slugify(title, 'article')).toBe(slug);
  });

  it.each(['', '   ', '!!!', 'सलाह'])('falls back for %j', (title) => {
    expect(slugify(title, 'article')).toBe('article');
  });
});

describe('generateUniqueSlug', () => {
  it('uses the base when it is free', async () => {
    const { db, calls } = slugTable([]);
    await expect(generateUniqueSlug(db, 'articles', 'Tax Tips', 'article')).resolves.toBe('tax-tips');
    expect(calls).toHaveLength(1);
    expect(calls[0].table).toBe('articles');
  });

  it('picks the first free sequential suffix in one query', async () => {
    const { db, calls } = slugTable(['tax-tips', 'tax-tips-2', 'tax-tips-4']);
    await expect(generateUniqueSlug(db, 'articles', 'Tax Tips', 'article')).resolves.toBe('tax-tips-3');
    expect(calls).toHaveLength(1);
  });

  it('treats reserved slugs as taken and reserves the one it returns', async () => {
    const { db } = slugTable(['tax-tips']);
    const reserved = new Set(['tax-tips-2']);
    await expect(generateUniqueSlug(db, 'articles', 'Tax Tips', 'article', reserved)).resolves.toBe('tax-tips-3');
    expect(reserved.has('tax-tips-3')).toBe(true);
  });

  it('switches to a random suffix once more than 50 sequential slugs are taken', async () => {
    const taken = ['tax-tips', ...Array.from({ length: 60 }, (_, i) => `tax-tips-${i + 2}`)];
    const { db, calls } = slugTable(taken);
    const slug = await generateUniqueSlug(db, 'articles', 'Tax Tips', 'article');
    expect(slug).toMatch(/^tax-tips-[0-9a-f]{8}$/);
    expect(taken).not.toContain(slug);
    // One query for the 50 sequential candidates, one to confirm the random one is free.
    expect(calls).toHaveLength(2);
    expect((argsOf(calls[0], 'in') as [string, string[]])[1]).toHaveLength(50);
  });

  it('fails with a 500 when the existence check errors', async () => {
    const { db } = fakeDb(() => ({ error: { message: 'boom' } }));
    await expect(generateUniqueSlug(db, 'articles', 'x', 'article')).rejects.toBeInstanceOf(
      InternalServerErrorException
    );
  });
});

describe('generateUniqueSlugs', () => {
  it('keeps a batch unique against the table and itself', async () => {
    const { db } = slugTable(['event', 'summit']);
    await expect(generateUniqueSlugs(db, 'events', ['Summit', 'Summit', 'Meetup', ''], 'event')).resolves.toEqual([
      'summit-2',
      'summit-3',
      'meetup',
      'event-2',
    ]);
  });
});

describe('isSlugUniqueViolation', () => {
  it.each([
    [{ code: '23505', message: 'duplicate key value violates unique constraint "articles_slug_key"' }, true],
    [{ code: '23505', message: 'duplicate', details: 'Key (slug)=(x) already exists.' }, true],
    [{ code: '23505', message: 'duplicate key on "articles_pkey"' }, false],
    [{ code: '23503', message: 'slug fk' }, false],
    [null, false],
  ])('%j → %s', (error, expected) => {
    expect(isSlugUniqueViolation(error)).toBe(expected);
  });
});

describe('withUniqueSlugRetry', () => {
  it('regenerates and retries when the insert loses a slug race', async () => {
    const generate = vi.fn().mockResolvedValueOnce('a').mockResolvedValueOnce('a-2');
    const insert = vi
      .fn()
      .mockRejectedValueOnce(new SlugTakenException('ARTICLE_SLUG_TAKEN'))
      .mockResolvedValueOnce({ id: 1 });
    await expect(withUniqueSlugRetry(generate, insert)).resolves.toEqual({ id: 1 });
    expect(insert.mock.calls).toEqual([['a'], ['a-2']]);
  });

  it('gives up after three attempts with the last SlugTakenException', async () => {
    const insert = vi.fn().mockRejectedValue(new SlugTakenException('ARTICLE_SLUG_TAKEN'));
    await expect(withUniqueSlugRetry(async () => 's', insert)).rejects.toBeInstanceOf(SlugTakenException);
    expect(insert).toHaveBeenCalledTimes(3);
  });

  it('does not retry other errors', async () => {
    const insert = vi.fn().mockRejectedValue(new Error('db down'));
    await expect(withUniqueSlugRetry(async () => 's', insert)).rejects.toThrow('db down');
    expect(insert).toHaveBeenCalledTimes(1);
  });
});
