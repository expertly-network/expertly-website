import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, Res } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequiresPermission } from '../auth/decorators/require-permission.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/auth.types';
import { EmailService } from './email.service';
import { UpdateEmailAutomationDto, ListEmailMessagesDto } from './dto/email.dto';

// 🛡️ Super administrators only: automations and delivery history. Email content is edited in Resend.
@Roles('admin')
@RequiresPermission('manageEmails')
@Controller('admin/email')
export class AdminEmailController {
  constructor(private readonly email: EmailService) {}
  @Get('automations') automations() {
    return this.email.listAutomations();
  }
  @Patch('automations/:key') updateAutomation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('key') key: string,
    @Body() body: UpdateEmailAutomationDto
  ) {
    return this.email.updateAutomation(user.id, key, body);
  }
  @Get('messages') async messages(
    @Query() query: ListEmailMessagesDto,
    @Res({ passthrough: true }) response: FastifyReply
  ) {
    const result = await this.email.listMessages(query);
    response.header('X-Total-Count', result.total);
    return result;
  }
  @Get('messages/:id') message(@Param('id', ParseUUIDPipe) id: string) {
    return this.email.getMessage(id);
  }
  @Post('messages/:id/cancel') @HttpCode(204) cancel(@Param('id', ParseUUIDPipe) id: string) {
    return this.email.cancelMessage(id);
  }
  @Post('messages/:id/retry') @HttpCode(204) retry(@Param('id', ParseUUIDPipe) id: string) {
    return this.email.retryMessage(id);
  }
}
