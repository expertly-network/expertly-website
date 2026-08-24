import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PracticeAreasController } from './practice-areas.controller';
import { PracticeAreasService } from './practice-areas.service';

@Module({
  imports: [AuthModule],
  controllers: [PracticeAreasController],
  providers: [PracticeAreasService],
})
export class PracticeAreasModule {}
