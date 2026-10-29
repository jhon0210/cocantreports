import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Clock } from '../../application/ports/clock.port';
import { todayInTimezone } from '../../shared/utils/date.util';
import { AppConfig } from '../config/app.config';

@Injectable()
export class SystemClock implements Clock {
  private readonly timezone: string;

  constructor(config: ConfigService<AppConfig, true>) {
    this.timezone = config.get('timezone', { infer: true });
  }

  now(): Date {
    return new Date();
  }

  today(): Date {
    return todayInTimezone(this.timezone);
  }
}
