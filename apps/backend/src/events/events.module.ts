import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CategoriesModule } from '../categories/categories.module';
import { EventsController } from './events.controller';
import { AdminEventsController } from './admin-events.controller';
import { EventsService } from './events.service';
import { EventsRepository } from './events.repository';

@Module({
  imports: [AuthModule, CategoriesModule],
  controllers: [EventsController, AdminEventsController],
  providers: [EventsService, EventsRepository],
})
export class EventsModule {}
