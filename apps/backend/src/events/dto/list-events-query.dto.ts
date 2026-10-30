import { IsDateString, IsIn, IsOptional } from 'class-validator';

// GET /v1/events. `upcoming` (default true) keeps the homepage-only "not yet ended" list;
// `upcoming=false` returns past and upcoming events, optionally only those still running on or
// after `from` (an ISO date) — so a caller asks for the window it shows instead of a fixed cap
// deciding which end of the calendar gets cut.
export class ListEventsQueryDto {
  @IsOptional()
  @IsIn(['true', 'false'])
  upcoming?: 'true' | 'false';

  @IsOptional()
  @IsDateString({ strict: true })
  from?: string;
}
