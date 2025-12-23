import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Req,
  Query,
} from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@medflow/shared';

@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.RECEPTIONIST)
  create(@Req() req: any, @Body() createAppointmentDto: CreateAppointmentDto) {
    return this.appointmentsService.create(req.tenantId, createAppointmentDto);
  }

  @Get()
  findAll(
    @Req() req: any,
    @Query('doctorId') doctorId?: string,
    @Query('date') date?: string,
  ) {
    return this.appointmentsService.findAll(req.tenantId, doctorId, date);
  }

  @Get(':id')
  findOne(@Req() req: any, @Param('id') id: string) {
    return this.appointmentsService.findOne(req.tenantId, id);
  }

  @Patch(':id/status')
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.RECEPTIONIST, UserRole.DOCTOR)
  updateStatus(
    @Req() req: any,
    @Param('id') id: string,
    @Body('status') status: string,
  ) {
    return this.appointmentsService.updateStatus(req.tenantId, id, status);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  remove(@Req() req: any, @Param('id') id: string) {
    return this.appointmentsService.remove(req.tenantId, id);
  }
}

