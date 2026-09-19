import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminServicesController } from './admin-services.controller';
import { ServicesService } from './services.service';
import { ServicesRepository } from './services.repository';

@Module({
  imports: [AuthModule],
  controllers: [AdminServicesController],
  providers: [ServicesService, ServicesRepository],
})
export class ServicesModule {}
