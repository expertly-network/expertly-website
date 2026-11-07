import { Type } from 'class-transformer';
import { IsBoolean, IsEmail, IsIn, IsInt, Matches, Max, Min, ValidateIf } from 'class-validator';
import type { EmailMessageStatus, UpdateEmailAutomationRequest } from '@shared/email';
import { AUTOMATION_KEYS } from '../automations';
const optional = (_: unknown, v: unknown) => v !== undefined;
export class UpdateEmailAutomationDto implements UpdateEmailAutomationRequest {
  @ValidateIf(optional) @IsBoolean() enabled?: boolean;
  // The id or alias of a published Resend template.
  @ValidateIf(optional) @Matches(/^[A-Za-z0-9_-]{1,100}$/) resendTemplate?: string;
}
export class ListEmailMessagesDto {
  @ValidateIf(optional) @Type(() => Number) @IsInt() @Min(1) @Max(1000000) page = 1;
  @ValidateIf(optional) @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 20;
  @ValidateIf(optional)
  @IsIn(['queued', 'sending', 'sent', 'delivered', 'bounced', 'complained', 'failed', 'cancelled', 'suppressed'])
  status?: EmailMessageStatus;
  @ValidateIf(optional) @IsIn(AUTOMATION_KEYS) automationKey?: string;
  @ValidateIf(optional) @IsEmail() email?: string;
}
