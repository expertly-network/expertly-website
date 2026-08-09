import { Body, Controller, Get, Post } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/auth.types';
import type { ApplicationDto } from '@shared/membership-application';
import { ApplicationsService } from './applications.service';
import { CreateApplicationDto } from './dto/create-application.dto';

// No @Public() on this controller — every route requires 🔑 Auth at minimum
// (enforced by the global SupabaseAuthGuard). POST further restricts to
// exactly role='client' inside the service (see the comment there for why
// that isn't expressed via @Roles()).
@Controller('applications')
export class ApplicationsController {
  constructor(private readonly service: ApplicationsService) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateApplicationDto
  ): Promise<ApplicationDto> {
    return this.service.create(user, dto);
  }

  // 🔒 Owner — always the caller's own most recent application, never
  // accepts an id, so there's no cross-user access surface to guard against.
  @Get('me')
  findMine(@CurrentUser() user: AuthenticatedUser): Promise<ApplicationDto> {
    return this.service.findMine(user.id);
  }
}
