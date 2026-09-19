import { Body, Controller, Delete, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequiresPermission } from '../auth/decorators/require-permission.decorator';
import { ServiceDto } from '@shared/service';
import { ServicesService } from './services.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';

// 🛡️ manageTaxonomy — services are always created scoped under their category.
@Roles('admin')
@RequiresPermission('manageTaxonomy')
@Controller('admin')
export class AdminServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Post('categories/:categoryId/services')
  create(@Param('categoryId') categoryId: string, @Body() dto: CreateServiceDto): Promise<ServiceDto> {
    return this.servicesService.create(categoryId, dto);
  }

  @Patch('services/:id')
  update(@Param('id') id: string, @Body() dto: UpdateServiceDto): Promise<ServiceDto> {
    return this.servicesService.update(id, dto);
  }

  @Delete('services/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string): Promise<void> {
    return this.servicesService.remove(id);
  }
}
