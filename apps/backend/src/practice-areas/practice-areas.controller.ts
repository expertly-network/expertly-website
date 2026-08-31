import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { PracticeAreasService } from './practice-areas.service';
// Real (not `import type`) import — Swagger's @ApiResponse needs the actual class at runtime.
import { PracticeAreaDto } from '@shared/practice-area';

// 🌐 Public — backs both the application wizard's service-preference
// dropdowns and (later) the member directory's practice-area filter.
@Controller('practice-areas')
export class PracticeAreasController {
  constructor(private readonly service: PracticeAreasService) {}

  @Public()
  @Get()
  list(): Promise<PracticeAreaDto[]> {
    return this.service.list();
  }
}
