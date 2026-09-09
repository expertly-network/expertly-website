import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PracticeAreasController } from './practice-areas.controller';
import { PracticeAreasService } from './practice-areas.service';

@Module({
  imports: [AuthModule],
  controllers: [PracticeAreasController],
  providers: [PracticeAreasService],
  // Exported so AiModule can reuse the same `is_active` query for the write flow's
  // "suggest topics with no practice area selected yet" fallback — see AiService.suggestTopics.
  exports: [PracticeAreasService],
})
export class PracticeAreasModule {}
