import { Controller, Get, Query } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { EventsService } from './events.service';
import { EventDto } from '@shared/event';

@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Public()
  @Get()
  list(@Query('upcoming') upcoming?: string): Promise<EventDto[]> {
    return upcoming === 'false' ? this.eventsService.listAll() : this.eventsService.listUpcoming();
  }
}
