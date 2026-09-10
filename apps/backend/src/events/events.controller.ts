import { Controller, Get, Query } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { EventsService } from './events.service';
import { EventDto } from '@shared/event';

// 🌐 Public — the browse list. `upcoming` defaults to true.
@Controller('events')
export class EventsController {
  constructor(private readonly service: EventsService) {}

  @Public()
  @Get()
  list(@Query('upcoming') upcoming?: string): Promise<EventDto[]> {
    return upcoming === 'false' ? this.service.listAll() : this.service.listUpcoming();
  }
}
