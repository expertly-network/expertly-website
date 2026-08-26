import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ApplicationsController } from './applications.controller';
import { AdminApplicationsController } from './admin-applications.controller';
import { ApplicationsService } from './applications.service';
import { LinkedInImportProvider } from './linkedin-import/linkedin-import.provider';
import { MockLinkedInImportProvider } from './linkedin-import/mock-linkedin-import.provider';
import { N8nLinkedInImportProvider } from './linkedin-import/n8n-linkedin-import.provider';

@Module({
  imports: [AuthModule],
  controllers: [ApplicationsController, AdminApplicationsController],
  providers: [
    ApplicationsService,
    // Real provider when LINKEDIN_IMPORT_WEBHOOK_URL is configured, mock otherwise — keeps
    // `pnpm dev` working for anyone without the real n8n webhook URL. See
    // docs/superpowers/specs/2026-08-25-linkedin-import-real-provider-design.md §3.
    {
      provide: LinkedInImportProvider,
      useClass: process.env.LINKEDIN_IMPORT_WEBHOOK_URL
        ? N8nLinkedInImportProvider
        : MockLinkedInImportProvider,
    },
  ],
})
export class ApplicationsModule {}
