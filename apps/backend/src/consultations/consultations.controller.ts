import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/auth.types';
import { ConsultationMessageDto, ConsultationRequestDto } from '@shared/consultation-request';
import { ConsultationsService } from './consultations.service';
import { CreateConsultationRequestDto } from './dto/create-consultation-request.dto';
import { UpdateConsultationStatusDto } from './dto/update-consultation-status.dto';
import { CreateConsultationMessageDto } from './dto/create-consultation-message.dto';
import { RateConsultationRequestDto } from './dto/rate-consultation-request.dto';

// 🔑 Auth on create; 🔒 Owner on the rest — ownership/role checks live in ConsultationsService,
// not here.
@Controller('consultations')
export class ConsultationsController {
  constructor(private readonly service: ConsultationsService) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateConsultationRequestDto
  ): Promise<ConsultationRequestDto> {
    return this.service.create(user, dto);
  }

  // Read-only probe the frontend calls before opening the request form, so a requester who's
  // already blocked (a pending request to this member, or the daily rate limit) finds out before
  // filling the form out, not after submitting. Literal 'can-request' segment, not ':id' — never
  // collides with the ':id/...' routes below (those require a second literal segment this path
  // doesn't have).
  @Get('can-request/:memberId')
  checkEligibility(
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<{ blocked: boolean; reason: 'pending' | 'rate_limited' | null; retryAfter: string | null }> {
    return this.service.checkEligibility(user, memberId);
  }

  @Get('mine')
  findMine(@CurrentUser() user: AuthenticatedUser): Promise<ConsultationRequestDto[]> {
    return this.service.findMine(user.id);
  }

  @Get('received')
  findReceived(@CurrentUser() user: AuthenticatedUser): Promise<ConsultationRequestDto[]> {
    return this.service.findReceived(user);
  }

  @Patch(':id')
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateConsultationStatusDto
  ): Promise<ConsultationRequestDto> {
    return this.service.updateStatus(id, user, dto);
  }

  // 🔒 Owner — the request's own requester, checked in the service.
  @Patch(':id/rating')
  rate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RateConsultationRequestDto
  ): Promise<ConsultationRequestDto> {
    return this.service.rateRequest(id, user, dto);
  }

  // 🔒 Owner — either participant (requester or member) on this request, checked in the service.
  @Get(':id/messages')
  listMessages(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<ConsultationMessageDto[]> {
    return this.service.listMessages(id, user);
  }

  @Post(':id/messages')
  postMessage(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateConsultationMessageDto
  ): Promise<ConsultationMessageDto> {
    return this.service.postMessage(id, user, dto);
  }
}
