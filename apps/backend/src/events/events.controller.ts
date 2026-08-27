import { Controller, Get, Query } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { EventsService } from './events.service';
import type { EventDto } from '@shared/event';

// 🌐 Public — the browse list. `upcoming` (optional, default `true`) preserves the homepage's
// exact original behaviour for every existing caller; the standalone /events page passes
// `upcoming=false` to get the full past+future set for its month-grouped browse list.
@Controller('events')
export class EventsController {
  constructor(private readonly service: EventsService) {}

  @Public()
  @Get()
  list(@Query('upcoming') upcoming?: string): Promise<EventDto[]> {
    return upcoming === 'false' ? this.service.listAll() : this.service.listUpcoming();
  }
}
