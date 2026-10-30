import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Every error response body, produced by apps/backend/src/common/http-exception.filter.ts
// (docs/rest-api.md "Errors"). Clients branch on `code`, never on `message`.

/** The one error shape for the whole API. */
export class ApiErrorResponse {
  @ApiProperty() statusCode!: number;
  /** Stable, machine-readable, e.g. `CONSULTATION_PENDING_EXISTS`; status default when none is specific. */
  @ApiProperty() code!: string;
  /** Human-readable; an array of messages for request-validation failures (`VALIDATION_FAILED`). */
  @ApiProperty({ oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }] })
  message!: string | string[];
  /** Present on a 429: seconds to wait before retrying. */
  @ApiPropertyOptional() retryAfterSeconds?: number;
}
