import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { Public } from './auth/decorators/public.decorator';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Public()
  @Get('health')
  getHealth() {
    return this.appService.getHealth();
  }

  // 🌐 Public — readiness probe: 200 when the database answers, 503 DATABASE_UNAVAILABLE otherwise.
  @Public()
  @Get('health/ready')
  getReadiness() {
    return this.appService.getReadiness();
  }

  @Public()
  @Get('hello')
  getHello() {
    return this.appService.getHello();
  }
}
