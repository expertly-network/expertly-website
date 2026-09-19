import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { CategoriesModule } from './categories/categories.module';
import { ServicesModule } from './services/services.module';
import { ApplicationsModule } from './applications/applications.module';
import { MembersModule } from './members/members.module';
import { EventsModule } from './events/events.module';
import { ArticlesModule } from './articles/articles.module';

@Module({
  imports: [
    AuthModule,
    CategoriesModule,
    ServicesModule,
    ApplicationsModule,
    MembersModule,
    EventsModule,
    ArticlesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
