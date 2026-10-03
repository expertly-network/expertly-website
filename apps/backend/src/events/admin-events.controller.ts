import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Req, Res } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequiresPermission } from '../auth/decorators/require-permission.decorator';
import { EventDto, type ImportEventsResponse } from '@shared/event';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';

// 🛡️ manageEvents — direct admin CRUD.
@Roles('admin')
@RequiresPermission('manageEvents')
@Controller('admin')
export class AdminEventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get('events')
  list(): Promise<EventDto[]> {
    return this.eventsService.adminList();
  }

  // Declared before `events/:id` — a literal `/events/export` must not be swallowed by the
  // `:id` param route.
  @Get('events/export')
  async export(@Res({ passthrough: false }) reply: FastifyReply): Promise<void> {
    const csv = await this.eventsService.exportToCsv();
    reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', 'attachment; filename="events.csv"')
      .send(csv);
  }

  // Bulk create/update/delete via CSV upload — see docs/rest-api.md for the full column/semantics
  // contract. All-or-nothing: a 400 means nothing was written. 200, not Nest's default 201 for
  // POST — a sync response is as often all-updates/all-deletes as it is a creation.
  @Post('events/import')
  @HttpCode(HttpStatus.OK)
  async import(@Req() request: FastifyRequest): Promise<ImportEventsResponse> {
    const part = await request.file();
    if (!part) throw new BadRequestException('No file provided.');
    if (!part.filename?.toLowerCase().endsWith('.csv')) {
      throw new BadRequestException('Only .csv files are accepted.');
    }

    const buffer = await part.toBuffer();
    if (buffer.length === 0) throw new BadRequestException('Uploaded file is empty.');

    return this.eventsService.importFromCsv(buffer);
  }

  @Get('events/:id')
  findOne(@Param('id') id: string): Promise<EventDto> {
    return this.eventsService.adminGetOne(id);
  }

  @Post('events')
  create(@Body() dto: CreateEventDto): Promise<EventDto> {
    return this.eventsService.create(dto);
  }

  @Patch('events/:id')
  update(@Param('id') id: string, @Body() dto: UpdateEventDto): Promise<EventDto> {
    return this.eventsService.update(id, dto);
  }

  @Delete('events/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string): Promise<void> {
    return this.eventsService.remove(id);
  }
}
