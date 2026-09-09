import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EventsController } from './events.controller';
import { AdminEventsController } from './admin-events.controller';
import { EventsService } from './events.service';

@Module({
  imports: [AuthModule],
  controllers: [EventsController, AdminEventsController],
  providers: [EventsService],
})
export class EventsModule {}
