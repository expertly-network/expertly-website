import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { PracticeAreasModule } from './practice-areas/practice-areas.module';
import { ApplicationsModule } from './applications/applications.module';

// Only what the membership-application feature actually depends on:
// PracticeAreasModule backs the Services & Rates step's GET /v1/practice-areas call,
// ApplicationsModule is the feature itself. ArticlesModule/MembersModule were registered here
// briefly during local testing but aren't used by anything in this branch and aren't part of
// it (their source under src/articles/, src/members/ is still uncommitted, separate work) —
// pulling them in here would make this branch depend on files it doesn't actually contain.
@Module({
  imports: [AuthModule, PracticeAreasModule, ApplicationsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
