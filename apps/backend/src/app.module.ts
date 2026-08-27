import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { PracticeAreasModule } from './practice-areas/practice-areas.module';
import { ApplicationsModule } from './applications/applications.module';
import { MembersModule } from './members/members.module';
import { EventsModule } from './events/events.module';
import { ArticlesModule } from './articles/articles.module';

// PracticeAreasModule backs both the application wizard's Services & Rates step and the
// /members directory filter bar's GET /v1/practice-areas call. ApplicationsModule is the
// membership-application feature. MembersModule is the member directory/profile feature
// (controller/service/DTOs already existed under src/members/ but this AppModule import was
// missing, so GET /v1/members had no reachable route — found while verifying Task 10's
// /members page against a live backend). EventsModule backs the homepage's Upcoming Events
// section (GET /v1/events, published + upcoming only) — the `events` table already existed
// live (docs/database-erd.md's drift note), only the module/controller/service were missing.
// ArticlesModule was restored from main-backup's 763bf75 (dropped in a prior rewrite, docs/
// shared-types already documented it unchanged) for the Articles browse/detail pages.
@Module({
  imports: [
    AuthModule,
    PracticeAreasModule,
    ApplicationsModule,
    MembersModule,
    EventsModule,
    ArticlesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
