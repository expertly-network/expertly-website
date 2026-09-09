import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { UnsplashService } from './unsplash.service';

@Module({
  providers: [AiService, UnsplashService],
  exports: [AiService, UnsplashService],
})
export class AiModule {}
