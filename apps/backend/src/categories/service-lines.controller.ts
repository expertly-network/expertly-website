import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { ServiceLineDto } from '@shared/category';
import { CategoriesService } from './categories.service';

// 🌐 GET /v1/service-lines — the full active taxonomy as a tree: service line → category → service.
@Controller('service-lines')
export class ServiceLinesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Public()
  @Get()
  list(): Promise<ServiceLineDto[]> {
    return this.categoriesService.listServiceLines();
  }
}
