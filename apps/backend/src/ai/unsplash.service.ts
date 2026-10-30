import { BadGatewayException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';

interface UnsplashSearchResult {
  results: { urls: { regular: string } }[];
}

const SEARCH_URL = 'https://api.unsplash.com/search/photos';
// >1 so the frontend's "change image"/"try another" controls have something to actually cycle
// through from a single fetch, instead of silently re-querying (and often landing on the same
// single result) every click.
const RESULTS_PER_QUERY = 5;
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
    url.searchParams.set('per_page', String(RESULTS_PER_QUERY));
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
    return body.results.map((r) => r.urls.regular);
  }
}
