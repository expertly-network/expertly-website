import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AiService } from './ai.service';
import { AiDraftGenerationsRepository } from './ai-draft-generations.repository';
import { UnsplashService } from './unsplash.service';

@Module({
  imports: [AuthModule],
  providers: [AiService, UnsplashService, AiDraftGenerationsRepository],
  exports: [AiService, UnsplashService, AiDraftGenerationsRepository],
})
export class AiModule {}
