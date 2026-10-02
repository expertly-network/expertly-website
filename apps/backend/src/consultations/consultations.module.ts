import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ConsultationsController } from './consultations.controller';
import { AdminConsultationsController } from './admin-consultations.controller';
import { ConsultationsService } from './consultations.service';
import { ConsultationsRepository } from './consultations.repository';

@Module({
  imports: [AuthModule],
  controllers: [ConsultationsController, AdminConsultationsController],
  providers: [ConsultationsService, ConsultationsRepository],
})
export class ConsultationsModule {}
