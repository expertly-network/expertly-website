import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ApplicationsController } from './applications.controller';
import { AdminApplicationsController } from './admin-applications.controller';
import { ApplicationsService } from './applications.service';
import { ApplicationsRepository } from './applications.repository';
import { LinkedInImportProvider } from './linkedin-import/linkedin-import.provider';
import { N8nLinkedInImportProvider } from './linkedin-import/n8n-linkedin-import.provider';

@Module({
  imports: [AuthModule],
  controllers: [ApplicationsController, AdminApplicationsController],
  providers: [
    ApplicationsService,
    ApplicationsRepository,
    // No mock fallback: if LINKEDIN_IMPORT_WEBHOOK_URL isn't configured, the provider itself
    // throws a clear BadGatewayException at call time rather than silently returning fake data.
    { provide: LinkedInImportProvider, useClass: N8nLinkedInImportProvider },
  ],
})
export class ApplicationsModule {}
