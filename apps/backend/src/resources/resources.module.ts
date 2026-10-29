import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ResourcesController, TemplateDownloadsController } from './resources.controller';
import { AdminResourcesController } from './admin-resources.controller';
import { ResourcesRepository } from './resources.repository';
import { ResourcesService } from './resources.service';
import { OptionalResourceAuthGuard } from './optional-resource-auth.guard';
@Module({
  imports: [AuthModule],
  controllers: [ResourcesController, TemplateDownloadsController, AdminResourcesController],
  providers: [ResourcesRepository, ResourcesService, OptionalResourceAuthGuard],
})
export class ResourcesModule {}
