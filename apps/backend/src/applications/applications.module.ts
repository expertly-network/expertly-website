import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ApplicationsController } from './applications.controller';
import { AdminApplicationsController } from './admin-applications.controller';
import { ApplicationsService } from './applications.service';
import { LinkedInImportProvider } from './linkedin-import/linkedin-import.provider';
import { N8nLinkedInImportProvider } from './linkedin-import/n8n-linkedin-import.provider';

@Module({
  imports: [AuthModule],
  controllers: [ApplicationsController, AdminApplicationsController],
  providers: [
    ApplicationsService,

    {
      provide: LinkedInImportProvider,
      useFactory: () => {
        if (!process.env.LINKEDIN_IMPORT_WEBHOOK_URL) {
          throw new Error(
            'LINKEDIN_IMPORT_WEBHOOK_URL is required — set it in apps/backend/.env to your n8n webhook URL.'
          );
        }
        return new N8nLinkedInImportProvider();
      },
    },
  ],
})
export class ApplicationsModule { }
