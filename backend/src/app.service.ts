import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealth() {
    return { status: 'ok', uptime: process.uptime() };
  }

  getHello() {
    return {
      message: 'Hello from the backend!',
      timestamp: new Date().toISOString(),
    };
  }
}
