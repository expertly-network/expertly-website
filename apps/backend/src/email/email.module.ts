import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EmailRepository } from './email.repository';
import { EmailConfig } from './email.config';
import { EmailService } from './email.service';
import { EmailSenderService } from './email-sender.service';
import { RenewalRemindersService } from './renewal-reminders.service';
import { AdminEmailController } from './admin-email.controller';
import { EmailWebhooksController } from './email-webhooks.controller';
import { EMAIL_PROVIDER } from './provider/email-provider';
import { ResendProvider } from './provider/resend.provider';
import { LogProvider } from './provider/log.provider';
@Module({
  imports: [AuthModule],
  controllers: [AdminEmailController, EmailWebhooksController],
  providers: [
    EmailRepository,
    EmailConfig,
    EmailService,
    EmailSenderService,
    RenewalRemindersService,
    {
      provide: EMAIL_PROVIDER,
      useFactory: () =>
        process.env.EMAIL_PROVIDER === 'resend' ? new ResendProvider(process.env.RESEND_API_KEY!) : new LogProvider(),
    },
  ],
  exports: [EmailService, EmailSenderService, RenewalRemindersService],
})
export class EmailModule {}
