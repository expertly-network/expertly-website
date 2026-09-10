import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { PracticeAreasService } from './practice-areas.service';
import { PracticeAreaDto } from '@shared/practice-area';

@Controller('practice-areas')
export class PracticeAreasController {
  constructor(private readonly service: PracticeAreasService) {}

  @Public()
  @Get()
  list(): Promise<PracticeAreaDto[]> {
    return this.service.list();
  }
}
