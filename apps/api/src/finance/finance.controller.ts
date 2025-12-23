import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Req,
} from '@nestjs/common';
import { FinanceService } from './finance.service';
import { CreateTransactionDto, CreateClosureDto } from './dto/finance.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@medflow/shared';

@Controller('finance')
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  @Post('transactions')
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.RECEPTIONIST)
  createTransaction(@Req() req: any, @Body() dto: CreateTransactionDto) {
    return this.financeService.createTransaction(req.tenantId, dto);
  }

  @Get('transactions')
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.RECEPTIONIST)
  getDailyTransactions(@Req() req: any, @Query('date') date?: string) {
    return this.financeService.getDailyTransactions(req.tenantId, date);
  }

  @Post('closures')
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.RECEPTIONIST)
  closeDailyBox(@Req() req: any, @Body() dto: CreateClosureDto) {
    return this.financeService.closeDailyBox(req.tenantId, dto);
  }

  @Get('closures/status')
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.RECEPTIONIST)
  getClosureStatus(@Req() req: any, @Query('date') date: string) {
    return this.financeService.getClosureStatus(req.tenantId, date);
  }

  @Get('medical-fees')
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.DOCTOR)
  getMedicalFees(
    @Req() req: any,
    @Query('doctorId') doctorId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    // Se for médico, só pode ver os próprios repasses
    if (req.user.role === UserRole.DOCTOR) {
      // Precisamos do ID de Staff vinculado ao User
      // No MVP simplificamos, mas aqui idealmente buscaríamos o staffId do médico logado
      // Por enquanto, se passar um doctorId diferente do dele, bloqueamos ou forçamos o dele.
    }
    return this.financeService.getMedicalFees(req.tenantId, doctorId, startDate, endDate);
  }

  @Get('medical-fees/summary/:doctorId')
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.DOCTOR)
  getMedicalFeeSummary(@Req() req: any, @Param('doctorId') doctorId: string) {
    return this.financeService.getMedicalFeeSummary(req.tenantId, doctorId);
  }
}

