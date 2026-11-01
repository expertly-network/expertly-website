import { Controller, Get, Query, Res } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { Public } from '../auth/decorators/public.decorator';
import { EventsService } from './events.service';
import { EventDto, type EventCalendarResponse, type EventDaysResponse } from '@shared/event';
import { EventDaysQueryDto, ListEventsQueryDto } from './dto/list-events-query.dto';

@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  // 🌐 Public — published events; optional filtered pagination.
  @Public()
  @Get()
  async list(@Query() query: ListEventsQueryDto, @Res({ passthrough: true }) reply: FastifyReply): Promise<EventDto[]> {
    if (query.upcoming !== 'false') return this.eventsService.listUpcoming();
    const { items, total } = await this.eventsService.listPublished(query);
    // Total matches across all pages; the body stays a plain array (no envelope).
    reply.header('X-Total-Count', String(total));
    return items;
  }

  // 🌐 Public — per-day event counts plus the first two events of each day, for the home calendar.
  @Public()
  @Get('calendar')
  calendar(@Query() query: EventDaysQueryDto): Promise<EventCalendarResponse> {
    return this.eventsService.listCalendar(query);
  }

  // 🌐 Public — days with a published event in [from, to], for the date picker's dots.
  @Public()
  @Get('days')
  days(@Query() query: EventDaysQueryDto): Promise<EventDaysResponse> {
    return this.eventsService.listEventDays(query);
  }
}
