import { ResourceQueryDto } from './dto/resource-query.dto';
import {
  Controller,
  Get,
  Header,
  HttpCode,
  Post,
  Query,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/auth.types';
import { OptionalResourceAuthGuard } from './optional-resource-auth.guard';
import { ResourcesService } from './resources.service';
// 🌐 Metadata is public; an optional verified bearer token unlocks role-specific content.
@Public()
@UseGuards(OptionalResourceAuthGuard)
@Controller()
export class ResourcesController {
  constructor(private readonly service: ResourcesService) {}
  @Get('perks')
  @Header('Cache-Control', 'private, no-store')
  @Header('Vary', 'Authorization')
  listPerks(
    @Query() query: ResourceQueryDto,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.service.listPerks(user?.role, query);
  }
  @Get('perks/:slug')
  @Header('Cache-Control', 'private, no-store')
  @Header('Vary', 'Authorization')
  getPerk(
    @Param('slug') slug: string,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.service.getPerk(slug, user?.role);
  }
  @Get('learnings')
  @Header('Cache-Control', 'private, no-store')
  @Header('Vary', 'Authorization')
  listLearnings(
    @Query() query: ResourceQueryDto,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.service.listLearnings(user?.role, query);
  }
  @Get('learnings/:id')
  @Header('Cache-Control', 'private, no-store')
  @Header('Vary', 'Authorization')
  getLearning(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.service.getLearning(id, user?.role);
  }
  @Get('templates')
  @Header('Cache-Control', 'private, no-store')
  @Header('Vary', 'Authorization')
  listTemplates(
    @Query() query: ResourceQueryDto,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.service.listTemplates(user?.role, query);
  }
  @Get('templates/:id')
  @Header('Cache-Control', 'private, no-store')
  @Header('Vary', 'Authorization')
  getTemplate(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.service.getTemplate(id, user?.role);
  }
  @Get('collections')
  @Header('Cache-Control', 'private, no-store')
  @Header('Vary', 'Authorization')
  listCollections(
    @Query() query: ResourceQueryDto,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.service.listCollections(user?.role, query);
  }
  @Get('collections/:id')
  @Header('Cache-Control', 'private, no-store')
  @Header('Vary', 'Authorization')
  getCollection(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.service.getCollection(id, user?.role);
  }
}

// 🔒 member — a short-lived signed link to the template file. Not @Public: a guest gets 401, a
// client 403 (JWT role), and the service re-confirms the member role from the database.
@Roles('member')
@Controller('templates')
export class TemplateDownloadsController {
  constructor(private readonly service: ResourcesService) {}
  @Post(':id/download')
  @HttpCode(200)
  @Header('Cache-Control', 'private, no-store')
  download(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.downloadTemplate(id, user.id);
  }
}
