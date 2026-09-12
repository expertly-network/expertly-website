import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ApplicationsController } from './applications.controller';
import { AdminApplicationsController } from './admin-applications.controller';
import { ApplicationsService } from './applications.service';
import { ApplicationsRepository } from './applications.repository';
import { LinkedInImportProvider } from './linkedin-import/linkedin-import.provider';
import { MockLinkedInImportProvider } from './linkedin-import/mock-linkedin-import.provider';
import { N8nLinkedInImportProvider } from './linkedin-import/n8n-linkedin-import.provider';

@Module({
  imports: [AuthModule],
  controllers: [ApplicationsController, AdminApplicationsController],
  providers: [
    ApplicationsService,
    ApplicationsRepository,
    // Uses the real n8n provider when configured, otherwise a mock.
    {
      provide: LinkedInImportProvider,
      useClass: process.env.LINKEDIN_IMPORT_WEBHOOK_URL
        ? N8nLinkedInImportProvider
        : MockLinkedInImportProvider,
    },
  ],
})
export class ApplicationsModule {}
