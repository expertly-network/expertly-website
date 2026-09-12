import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';

interface UnsplashSearchResult {
  results: { urls: { regular: string } }[];
}

const SEARCH_URL = 'https://api.unsplash.com/search/photos';
const RESULTS_PER_QUERY = 1;
const TIMEOUT_MS = 8_000;

// Searches Unsplash for cover image suggestions, keeping the access key server-side.
@Injectable()
export class UnsplashService {
  private readonly logger = new Logger(UnsplashService.name);

  async search(query: string): Promise<string[]> {
    const accessKey = process.env.UNSPLASH_ACCESS_KEY;
    if (!accessKey) {
      throw new ServiceUnavailableException(
        'Cover image suggestions are not configured (set UNSPLASH_ACCESS_KEY).'
      );
    }

    const url = new URL(SEARCH_URL);
    url.searchParams.set('query', query);
    url.searchParams.set('per_page', String(RESULTS_PER_QUERY));
    url.searchParams.set('orientation', 'landscape');
    url.searchParams.set('content_filter', 'high');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        headers: { Authorization: `Client-ID ${accessKey}` },
        signal: controller.signal,
      });
      if (!res.ok) {
        throw new Error(`Unsplash search failed with status ${res.status}.`);
      }
      const body = (await res.json()) as UnsplashSearchResult;
      return body.results.map((r) => r.urls.regular);
    } catch (error) {
      this.logger.error(
        `Unsplash search failed for query "${query}"`,
        error instanceof Error ? error.stack : error
      );
      throw new ServiceUnavailableException('Could not fetch cover image suggestions — try again.');
    } finally {
      clearTimeout(timeout);
    }
  }
}
