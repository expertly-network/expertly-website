import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequiresPermission } from '../auth/decorators/require-permission.decorator';
import { EventDto } from '@shared/event';
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
