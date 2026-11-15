import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RecommendationsController } from './recommendations.controller';
import { RecommendationsService } from './recommendations.service';
import { RecommendationsRepository } from './recommendations.repository';
import { RecommendationRequestsController } from './recommendation-requests.controller';
import { RecommendationRequestsService } from './recommendation-requests.service';
import { RecommendationRequestsRepository } from './recommendation-requests.repository';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [AuthModule, EmailModule],
  controllers: [RecommendationsController, RecommendationRequestsController],
  providers: [
    RecommendationsService,
    RecommendationsRepository,
    RecommendationRequestsService,
    RecommendationRequestsRepository,
  ],
})
export class RecommendationsModule {}
