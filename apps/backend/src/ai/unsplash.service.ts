import { BadGatewayException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';

interface UnsplashSearchResult {
  results: { urls: { regular: string } }[];
}

const SEARCH_URL = 'https://api.unsplash.com/search/photos';
// The search pool is Unsplash's maximum page size; a random RESULTS_RETURNED of it go back, in
// random order. Returning the same top few every time made articles on one topic share a cover
// and "try another" cycle through the same handful of photos.
const SEARCH_POOL_SIZE = 30;
const RESULTS_RETURNED = 10;
const TIMEOUT_MS = 8_000;

// Searches Unsplash for cover image suggestions, keeping the access key server-side.
@Injectable()
export class UnsplashService {
  private readonly logger = new Logger(UnsplashService.name);

  async search(query: string): Promise<string[]> {
    const accessKey = process.env.UNSPLASH_ACCESS_KEY;
    if (!accessKey) {
      // Which variable is missing is logged, never returned to the client.
      this.logger.error('Cover image search refused: UNSPLASH_ACCESS_KEY is not set');
      throw new ServiceUnavailableException({
        code: 'COVER_IMAGES_NOT_CONFIGURED',
        message: 'Cover image suggestions are not configured.',
      });
    }

    const url = new URL(SEARCH_URL);
    url.searchParams.set('query', query);
    url.searchParams.set('per_page', String(SEARCH_POOL_SIZE));
    url.searchParams.set('orientation', 'landscape');
    url.searchParams.set('content_filter', 'high');

    const providerError = () =>
      new BadGatewayException({ code: 'COVER_IMAGES_PROVIDER_ERROR', message: 'Unsplash search failed.' });

    // The signal also bounds reading the body, not just the response headers.
    const signal = AbortSignal.timeout(TIMEOUT_MS);
    let body: UnsplashSearchResult;
    try {
      const res = await fetch(url, { headers: { Authorization: `Client-ID ${accessKey}` }, signal });
      if (!res.ok) {
        this.logger.error(`Unsplash search failed with status ${res.status} for query "${query}"`);
        throw providerError();
      }
      body = (await res.json()) as UnsplashSearchResult;
    } catch (error) {
      if (error instanceof BadGatewayException) throw error;
      this.logger.error(`Unsplash search failed for query "${query}"`, error instanceof Error ? error.stack : error);
      throw providerError();
    }
    return shuffle([...new Set(body.results.map((r) => r.urls.regular))]).slice(0, RESULTS_RETURNED);
  }
}

// Fisher–Yates, in place; returns the same array.
export function shuffle<T>(items: T[], random: () => number = Math.random): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}
