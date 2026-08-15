import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { PracticeAreasModule } from './practice-areas/practice-areas.module';
import { ApplicationsModule } from './applications/applications.module';
import { ArticlesModule } from './articles/articles.module';

@Module({
  imports: [AuthModule, PracticeAreasModule, ApplicationsModule, ArticlesModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
