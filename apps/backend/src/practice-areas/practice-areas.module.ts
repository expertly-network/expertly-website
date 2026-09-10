import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PracticeAreasController } from './practice-areas.controller';
import { PracticeAreasService } from './practice-areas.service';
import { PracticeAreasRepository } from './practice-areas.repository';

@Module({
  imports: [AuthModule],
  controllers: [PracticeAreasController],
  providers: [PracticeAreasService, PracticeAreasRepository],
  exports: [PracticeAreasService],
})
export class PracticeAreasModule {}
