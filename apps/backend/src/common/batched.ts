// Splits `items` into chunks of `size`.
export function chunked<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

// Runs `fn` over every chunk of `items`, at most `concurrency` chunks in flight at once, and
// returns the results in chunk order. Used for bulk PostgREST work that has to be split to stay
// inside URL-length and statement-timeout limits without paying one round trip at a time.
// Rejects with the first failure, after letting already-started chunks settle.
export async function mapChunks<T, R>(
  items: readonly T[],
  size: number,
  concurrency: number,
  fn: (chunk: T[], index: number) => Promise<R>
): Promise<R[]> {
  return mapInParallel(chunked(items, size), concurrency, fn);
}

// Same as mapChunks for chunks the caller has already built (e.g. sized by bytes, not count).
export async function mapInParallel<T, R>(
  items: readonly T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  let failure: { error: unknown } | null = null;

  async function worker(): Promise<void> {
    while (failure === null && next < items.length) {
      const index = next++;
      try {
        results[index] = await fn(items[index], index);
      } catch (error) {
        failure ??= { error };
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  if (failure !== null) throw (failure as { error: unknown }).error;
  return results;
}
