import { ResourcesModule } from './resources/resources.module';
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AppRepository } from './app.repository';
import { AuthModule } from './auth/auth.module';
import { CategoriesModule } from './categories/categories.module';
import { ServicesModule } from './services/services.module';
import { ApplicationsModule } from './applications/applications.module';
import { MembersModule } from './members/members.module';
import { RecommendationsModule } from './recommendations/recommendations.module';
import { EventsModule } from './events/events.module';
import { ConsultationsModule } from './consultations/consultations.module';
import { ArticlesModule } from './articles/articles.module';
import { SearchModule } from './search/search.module';

@Module({
  imports: [
    AuthModule,
    ResourcesModule,
    CategoriesModule,
    ServicesModule,
    ApplicationsModule,
    MembersModule,
    RecommendationsModule,
    EventsModule,
    ConsultationsModule,
    ArticlesModule,
    SearchModule,
  ],
  controllers: [AppController],
  providers: [AppService, AppRepository],
})
export class AppModule {}
