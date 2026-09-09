import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';

interface UnsplashSearchResult {
  results: { urls: { regular: string } }[];
}

const SEARCH_URL = 'https://api.unsplash.com/search/photos';
const RESULTS_PER_QUERY = 5;
const TIMEOUT_MS = 8_000;

// Proxies the write flow's "auto-selected cover image" through the backend so the Unsplash
// access key never reaches the client (same posture as AiService's provider API keys) — the
// frontend only ever sees the resulting image URLs, never UNSPLASH_ACCESS_KEY itself. Plain
// `fetch`, no SDK: Unsplash's search endpoint is small enough that a client library would be
// pure overhead for the one call this makes.
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
