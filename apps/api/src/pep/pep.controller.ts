import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Req,
} from '@nestjs/common';
import { PepService } from './pep.service';
import { CreateMedicalRecordDto, UpdateMedicalRecordDto, CreateAddendumDto } from './dto/pep.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@medflow/shared';

@Controller('pep')
export class PepController {
  constructor(private readonly pepService: PepService) {}

  @Post()
  @Roles(UserRole.DOCTOR, UserRole.ADMIN, UserRole.OWNER)
  create(@Req() req: any, @Body() dto: CreateMedicalRecordDto) {
    return this.pepService.create(req.tenantId, dto);
  }

  @Get('patient/:patientId')
  @Roles(UserRole.DOCTOR, UserRole.ADMIN, UserRole.OWNER)
  findByPatient(@Req() req: any, @Param('patientId') patientId: string) {
    return this.pepService.findByPatient(req.tenantId, patientId);
  }

  @Get(':id')
  @Roles(UserRole.DOCTOR, UserRole.ADMIN, UserRole.OWNER)
  findOne(@Req() req: any, @Param('id') id: string) {
    return this.pepService.findOne(req.tenantId, id);
  }

  @Patch(':id')
  @Roles(UserRole.DOCTOR)
  update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateMedicalRecordDto,
  ) {
    return this.pepService.update(req.tenantId, id, dto);
  }

  @Post(':id/finalize')
  @Roles(UserRole.DOCTOR)
  finalize(@Req() req: any, @Param('id') id: string) {
    return this.pepService.finalize(req.tenantId, id);
  }

  @Post(':id/addendum')
  @Roles(UserRole.DOCTOR)
  addAddendum(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: CreateAddendumDto,
  ) {
    return this.pepService.addAddendum(req.tenantId, id, dto);
  }
}

