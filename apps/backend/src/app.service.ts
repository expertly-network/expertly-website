import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { AppRepository } from './app.repository';

@Injectable()
export class AppService {
  constructor(private readonly appRepository: AppRepository) {}

  getHealth() {
    return { status: 'ok', uptime: process.uptime() };
  }

  // Readiness, unlike liveness above, depends on the database being reachable.
  async getReadiness(): Promise<{ status: 'ok' }> {
    // HttpExceptionFilter logs the 503 (with the request id).
    if (!(await this.appRepository.ping())) {
      throw new ServiceUnavailableException({ code: 'DATABASE_UNAVAILABLE', message: 'Not ready.' });
    }
    return { status: 'ok' };
  }

  getHello() {
    return {
      message: 'Hello from the backend!',
      timestamp: new Date().toISOString(),
    };
  }
}
