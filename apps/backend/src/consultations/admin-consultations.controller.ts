import { Body, Controller, Get, Param, ParseUUIDPipe, Patch } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequiresPermission } from '../auth/decorators/require-permission.decorator';
import { ConsultationRequestDto } from '@shared/consultation-request';
import { ConsultationsService } from './consultations.service';
import { UpdateConsultationStatusDto } from './dto/update-consultation-status.dto';

// 🛡️ manageConsultations on every route here — same posture as AdminEventsController/
// AdminMembersController.
@Roles('admin')
@RequiresPermission('manageConsultations')
@Controller('admin')
export class AdminConsultationsController {
  constructor(private readonly service: ConsultationsService) {}

  @Get('consultations')
  list(): Promise<ConsultationRequestDto[]> {
    return this.service.adminList();
  }

  @Patch('consultations/:id')
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateConsultationStatusDto
  ): Promise<ConsultationRequestDto> {
    return this.service.adminUpdateStatus(id, dto);
  }
}
