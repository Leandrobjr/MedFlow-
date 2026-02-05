import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Req,
} from '@nestjs/common';
import { PatientsService } from './patients.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/shared-types';

@Controller('patients')
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.RECEPTIONIST)
  create(@Req() req: any, @Body() createPatientDto: CreatePatientDto) {
    return this.patientsService.create(req.tenantId, createPatientDto);
  }

  @Get()
  findAll(@Req() req: any) {
    return this.patientsService.findAll(req.tenantId);
  }

  @Get(':id')
  findOne(@Req() req: any, @Param('id') id: string) {
    return this.patientsService.findOne(req.tenantId, id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.RECEPTIONIST, UserRole.DOCTOR)
  async update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() updatePatientDto: any,
  ) {
    console.log('[PatientsController.update] Recebido:', {
      id,
      body: updatePatientDto,
    });
    const result = await this.patientsService.update(
      req.tenantId,
      id,
      updatePatientDto,
    );
    console.log('[PatientsController.update] Resultado:', {
      id: result.id,
      allergies: result.allergies,
      medications: result.medications,
    });
    return result;
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  remove(@Req() req: any, @Param('id') id: string) {
    return this.patientsService.remove(req.tenantId, id);
  }
}
