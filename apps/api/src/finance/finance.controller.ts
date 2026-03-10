import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Query,
  Req,
  Param,
  BadRequestException,
} from '@nestjs/common';
import { FinanceService } from './finance.service';
import {
  CreateTransactionDto,
  UpdateTransactionDto,
  CreateClosureDto,
  CloseReceptionistBoxDto,
  CloseAdminBoxDto,
  CloseMedicalFeePaymentDto,
} from './dto/finance.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/shared-types';

@Controller('finance')
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  @Post('transactions')
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.RECEPTIONIST)
  createTransaction(@Req() req: any, @Body() dto: CreateTransactionDto) {
    return this.financeService.createTransaction(
      req.tenantId,
      dto,
      req.user?.id,
      req.user?.role,
    );
  }

  @Put('transactions/:id')
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.RECEPTIONIST)
  updateTransaction(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateTransactionDto,
  ) {
    return this.financeService.updateTransaction(
      req.tenantId,
      id,
      dto,
      req.user?.id,
      req.user?.role,
    );
  }

  @Get('transactions')
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.RECEPTIONIST)
  getDailyTransactions(
    @Req() req: any,
    @Query('date') date?: string,
    @Query('createdById') createdById?: string,
  ) {
    return this.financeService.getDailyTransactions(
      req.tenantId,
      date,
      createdById,
    );
  }

  @Post('closures')
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.RECEPTIONIST)
  closeDailyBox(@Req() req: any, @Body() dto: CreateClosureDto) {
    return this.financeService.closeDailyBox(req.tenantId, dto);
  }

  @Get('closures/status')
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.RECEPTIONIST)
  getClosureStatus(
    @Req() req: any,
    @Query('date') date: string,
    @Query('userId') userId?: string,
    @Query('closureType') closureType?: string,
  ) {
    return this.financeService.getClosureStatus(
      req.tenantId,
      date,
      userId,
      closureType,
    );
  }

  @Get('boxes/status')
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.RECEPTIONIST)
  getBoxStatus(
    @Req() req: any,
    @Query('date') date?: string,
    @Query('userId') userId?: string,
  ) {
    const today = new Date();
    const dateStr =
      date ||
      `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, '0')}-${String(today.getUTCDate()).padStart(2, '0')}`;
    return this.financeService.getBoxStatus(
      req.tenantId,
      dateStr,
      userId || undefined,
    );
  }

  @Post('boxes/receptionist/close')
  @Roles(UserRole.RECEPTIONIST, UserRole.ADMIN, UserRole.OWNER)
  closeReceptionistBox(@Req() req: any, @Body() dto: CloseReceptionistBoxDto) {
    if (!req.user?.id) {
      throw new BadRequestException('Usuário não identificado');
    }
    return this.financeService.closeReceptionistBox(
      req.tenantId,
      req.user.id,
      dto,
    );
  }

  @Post('boxes/admin/close')
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  closeAdminBox(@Req() req: any, @Body() dto: CloseAdminBoxDto) {
    if (!req.user?.id) {
      throw new BadRequestException('Usuário não identificado');
    }
    return this.financeService.closeAdminBox(req.tenantId, req.user.id, dto);
  }

  @Get('medical-fees')
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.DOCTOR, UserRole.RECEPTIONIST)
  getMedicalFees(
    @Req() req: any,
    @Query('doctorId') doctorId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('status') status?: string,
  ) {
    // Se for médico, só pode ver os próprios repasses
    if (req.user.role === UserRole.DOCTOR && req.user.staffId) {
      // Forçar o staffId do médico logado
      doctorId = req.user.staffId;
    }
    return this.financeService.getMedicalFees(
      req.tenantId,
      doctorId,
      startDate,
      endDate,
      status,
    );
  }

  @Post('medical-fees/close')
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.RECEPTIONIST)
  closeMedicalFeePayment(
    @Req() req: any,
    @Body() dto: CloseMedicalFeePaymentDto,
  ) {
    if (!req.user?.id) {
      throw new Error('Usuário não identificado');
    }
    return this.financeService.closeMedicalFeePayment(
      req.tenantId,
      req.user.id,
      dto,
    );
  }

  @Get('medical-fees/payments')
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.DOCTOR, UserRole.RECEPTIONIST)
  getMedicalFeePayments(
    @Req() req: any,
    @Query('staffId') staffId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    // Se for médico, só pode ver os próprios fechamentos
    if (req.user.role === UserRole.DOCTOR && req.user.staffId) {
      staffId = req.user.staffId;
    }
    return this.financeService.getMedicalFeePayments(
      req.tenantId,
      staffId,
      startDate,
      endDate,
    );
  }

  @Get('medical-fees/summary/:doctorId')
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.DOCTOR)
  getMedicalFeeSummary(@Req() req: any, @Param('doctorId') doctorId: string) {
    return this.financeService.getMedicalFeeSummary(req.tenantId, doctorId);
  }

  @Get('transactions/check-appointment/:appointmentId')
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.RECEPTIONIST)
  checkAppointmentBilling(
    @Req() req: any,
    @Param('appointmentId') appointmentId: string,
  ) {
    return this.financeService.checkAppointmentBilling(
      req.tenantId,
      appointmentId,
    );
  }

  @Get('closures')
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.RECEPTIONIST)
  getDailyClosures(
    @Req() req: any,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('userId') userId?: string,
    @Query('closureType') closureType?: string,
  ) {
    // Se for recepcionista, só pode ver os próprios fechamentos
    if (req.user.role === UserRole.RECEPTIONIST) {
      userId = req.user.id;
    }
    return this.financeService.getDailyClosures(
      req.tenantId,
      startDate,
      endDate,
      userId,
      closureType,
    );
  }

  @Get('closures/preview')
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.RECEPTIONIST)
  getClosurePreview(
    @Req() req: any,
    @Query('date') date: string,
    @Query('closureType') closureType?: string,
  ) {
    if (!date) {
      throw new BadRequestException('Data é obrigatória');
    }
    const type =
      closureType ||
      (req.user.role === UserRole.RECEPTIONIST ? 'RECEPTIONIST' : 'ADMIN');
    return this.financeService.getClosurePreview(
      req.tenantId,
      date,
      req.user.id,
      type,
    );
  }

  @Post('medical-fees/recreate-missing')
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  recreateMissingMedicalFees(
    @Req() req: any,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.financeService.recreateMissingMedicalFees(
      req.tenantId,
      startDate,
      endDate,
    );
  }

  @Get('medical-fees/diagnose')
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.RECEPTIONIST)
  diagnoseMedicalFees(@Req() req: any) {
    return this.financeService.diagnoseMedicalFees(req.tenantId);
  }

  @Post('medical-fees/fix-lais')
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  async fixDraLaisFees(@Req() req: any) {
    return this.financeService.fixDraLaisFees(req.tenantId);
  }

  @Get('medical-fees/diagnose-deep')
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  diagnoseDeepDraLais(@Req() req: any) {
    return this.financeService.diagnoseDeepDraLais(req.tenantId);
  }

  @Post('medical-fees/fix-staff-ids')
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  fixTransactionStaffIds(@Req() req: any) {
    return this.financeService.fixTransactionStaffIds(req.tenantId);
  }
}
