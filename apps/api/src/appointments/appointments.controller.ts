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
import { UserRole } from '../common/shared-types';

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
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    // Se não for admin/owner e não tiver doctorId explícito, filtrar por staffId do usuário logado
    const userRole = req.user?.role;
    const isAdmin = userRole === 'admin' || userRole === 'owner';
    const userStaffId = req.user?.staffId;
    
    // Se não for admin e não passou doctorId, usar staffId do usuário logado
    const finalDoctorId = doctorId || (!isAdmin && userStaffId ? userStaffId : undefined);
    
    return this.appointmentsService.findAll(req.tenantId, finalDoctorId, date, startDate, endDate);
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


