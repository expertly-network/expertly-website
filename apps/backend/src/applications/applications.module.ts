import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ApplicationsController } from './applications.controller';
import { AdminApplicationsController } from './admin-applications.controller';
import { ApplicationsService } from './applications.service';
import { LinkedInImportProvider } from './linkedin-import/linkedin-import.provider';
import { MockLinkedInImportProvider } from './linkedin-import/mock-linkedin-import.provider';

@Module({
  imports: [AuthModule],
  controllers: [ApplicationsController, AdminApplicationsController],
  providers: [
    ApplicationsService,
    // Swap point for the real n8n-backed provider — see linkedin-import.provider.ts.
    { provide: LinkedInImportProvider, useClass: MockLinkedInImportProvider },
  ],
})
export class ApplicationsModule {}
