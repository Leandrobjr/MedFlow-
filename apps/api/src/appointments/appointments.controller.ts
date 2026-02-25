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
  import { UpdateAppointmentStatusDto } from './dto/update-appointment-status.dto';
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
      const userRole = String(req.user?.role ?? '').toLowerCase();
      const isAdmin = userRole === 'admin' || userRole === 'owner';
      const isReceptionist = userRole === 'receptionist';
      const userStaffId = req.user?.staffId;
  
      let finalDoctorId: string | undefined;
  
      if (isReceptionist) {
        finalDoctorId = undefined;
      } else if (doctorId) {
        finalDoctorId = doctorId;
      } else if (!isAdmin && userStaffId) {
        finalDoctorId = userStaffId;
      }
  
      return this.appointmentsService.findAll(
        req.tenantId,
        finalDoctorId,
        date,
        startDate,
        endDate,
      );
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
      @Body() dto: UpdateAppointmentStatusDto,
    ) {
      const userRole = req.user?.role;
      const userStaffId = req.user?.staffId;
      const currentUserId = req.user?.userId ?? req.user?.id;
  
      return this.appointmentsService.updateStatus(
        req.tenantId,
        id,
        dto,
        userRole,
        userStaffId,
        currentUserId,
      );
    }
  
    @Delete(':id')
    @Roles(UserRole.ADMIN, UserRole.OWNER)
    remove(@Req() req: any, @Param('id') id: string) {
      return this.appointmentsService.remove(req.tenantId, id);
    }
  }