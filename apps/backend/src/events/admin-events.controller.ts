import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequiresPermission } from '../auth/decorators/require-permission.decorator';
// Real (not `import type`) import — Swagger's @ApiResponse needs the actual class at runtime,
// same as ArticlesController/AdminApplicationsController.
import { EventDto } from '@shared/event';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';

// 🛡️ manageEvents — @Roles('admin') for the base role (freshly re-checked by RolesGuard),
// @RequiresPermission('manageEvents') to further narrow to admins whose admin_role actually
// carries it (freshly re-checked by AdminPermissionGuard). Same pattern as
// AdminApplicationsController / AdminMembersController. Direct CRUD only — no suggestion-queue
// endpoints here, see docs/superpowers/specs/2026-09-08-admin-events-crud-design.md.
@Roles('admin')
@RequiresPermission('manageEvents')
@Controller('admin')
export class AdminEventsController {
  constructor(private readonly service: EventsService) {}

  @Get('events')
  list(): Promise<EventDto[]> {
    return this.service.adminList();
  }

  @Get('events/:id')
  findOne(@Param('id') id: string): Promise<EventDto> {
    return this.service.adminGetOne(id);
  }

  @Post('events')
  create(@Body() dto: CreateEventDto): Promise<EventDto> {
    return this.service.create(dto);
  }

  @Patch('events/:id')
  update(@Param('id') id: string, @Body() dto: UpdateEventDto): Promise<EventDto> {
    return this.service.update(id, dto);
  }

  @Delete('events/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string): Promise<void> {
    return this.service.remove(id);
  }
}
