import type { FastifyRequest } from 'fastify';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequiresPermission } from '../auth/decorators/require-permission.decorator';
import { ResourcesService } from './resources.service';
import { CreatePerkDto } from './dto/create-perk.dto';
import { UpdatePerkDto } from './dto/update-perk.dto';
import { CreateLearningDto } from './dto/create-learning.dto';
import { UpdateLearningDto } from './dto/update-learning.dto';
import { CreateCollectionDto } from './dto/create-collection.dto';
import { UpdateCollectionDto } from './dto/update-collection.dto';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
// 🛡️ All routes require fresh admin role and manageResources permission.
@Roles('admin')
@RequiresPermission('manageResources')
@Controller('admin')
export class AdminResourcesController {
  constructor(private readonly service: ResourcesService) {}
  @Get('perks')
  @Header('Cache-Control', 'private, no-store')
  listPerks() {
    return this.service.adminPerks();
  }
  @Get('perks/:id')
  @Header('Cache-Control', 'private, no-store')
  getPerk(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.adminPerk(id);
  }
  @Post('perks') createPerk(@Body() dto: CreatePerkDto) {
    return this.service.createPerk(dto);
  }
  @Patch('perks/:id') updatePerk(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdatePerkDto,
  ) {
    return this.service.updatePerk(id, dto);
  }
  @Delete('perks/:id') @HttpCode(204) deletePerk(
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.service.deletePerk(id);
  }
  @Get('learnings')
  @Header('Cache-Control', 'private, no-store')
  listLearnings() {
    return this.service.adminLearnings();
  }
  @Get('learnings/:id')
  @Header('Cache-Control', 'private, no-store')
  getLearning(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.adminLearning(id);
  }
  @Post('learnings') createLearning(@Body() dto: CreateLearningDto) {
    return this.service.createLearning(dto);
  }
  @Patch('learnings/:id') updateLearning(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateLearningDto,
  ) {
    return this.service.updateLearning(id, dto);
  }
  @Delete('learnings/:id') @HttpCode(204) deleteLearning(
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.service.deleteLearning(id);
  }
  @Get('collections')
  @Header('Cache-Control', 'private, no-store')
  listCollections() {
    return this.service.adminCollections();
  }
  @Get('collections/:id')
  @Header('Cache-Control', 'private, no-store')
  getCollection(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.adminCollection(id);
  }
  @Post('collections') createCollection(@Body() dto: CreateCollectionDto) {
    return this.service.createCollection(dto);
  }
  @Patch('collections/:id') updateCollection(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateCollectionDto,
  ) {
    return this.service.updateCollection(id, dto);
  }
  @Delete('collections/:id') @HttpCode(204) deleteCollection(
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.service.deleteCollection(id);
  }
  @Get('templates')
  @Header('Cache-Control', 'private, no-store')
  listTemplates() {
    return this.service.adminTemplates();
  }
  @Get('templates/:id')
  @Header('Cache-Control', 'private, no-store')
  getTemplate(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.adminTemplate(id);
  }
  // Multipart, field `file`. Bytes are sniffed server-side (Word/Excel/PowerPoint/PDF only, 15MB
  // max) and stored in the private bucket; the response feeds POST/PATCH /admin/templates.
  @Post('templates/upload')
  @HttpCode(200)
  async uploadTemplate(@Req() request: FastifyRequest) {
    const part = await request.file();
    if (!part) throw new BadRequestException('No file provided.');
    const buffer = await part.toBuffer();
    return this.service.uploadTemplate({
      buffer,
      size: buffer.length,
      originalname: part.filename ?? '',
    });
  }
  @Post('templates') createTemplate(@Body() dto: CreateTemplateDto) {
    return this.service.createTemplate(dto);
  }
  @Patch('templates/:id') updateTemplate(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateTemplateDto,
  ) {
    return this.service.updateTemplate(id, dto);
  }
  @Delete('templates/:id') @HttpCode(204) deleteTemplate(
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.service.deleteTemplate(id);
  }
}
