import { Controller, Get, Query } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { EventsService } from './events.service';
import { EventDto } from '@shared/event';
import { ListEventsQueryDto } from './dto/list-events-query.dto';

@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Public()
  @Get()
  list(@Query() query: ListEventsQueryDto): Promise<EventDto[]> {
    return query.upcoming === 'false' ? this.eventsService.listAll(query.from) : this.eventsService.listUpcoming();
  }
}
