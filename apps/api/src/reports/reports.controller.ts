import {
  Controller,
  Get,
  Query,
  Param,
  Req,
  Res,
  Header,
} from '@nestjs/common';
import { ReportsService } from './reports.service';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/shared-types';
import { Response } from 'express';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('daily-closure/:closureId')
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.RECEPTIONIST)
  @Header('Content-Type', 'application/pdf')
  async getDailyClosureReport(
    @Req() req: any,
    @Param('closureId') closureId: string,
    @Res() res: Response,
  ) {
    const pdf = await this.reportsService.generateDailyClosureReport(
      req.tenantId,
      closureId,
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="fechamento-caixa-${closureId}.pdf"`,
    );
    res.send(pdf);
  }

  @Get('billing')
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.RECEPTIONIST)
  @Header('Content-Type', 'application/pdf')
  async getBillingReport(
    @Req() req: any,
    @Res() res: Response,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('procedureId') procedureId?: string,
    @Query('staffId') staffId?: string,
    @Query('patientId') patientId?: string,
  ) {
    if (!startDate || !endDate) {
      return res
        .status(400)
        .json({ message: 'startDate e endDate são obrigatórios' });
    }

    const pdf = await this.reportsService.generateBillingReport(
      req.tenantId,
      startDate,
      endDate,
      procedureId,
      staffId,
      patientId,
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="faturamento-${startDate}-${endDate}.pdf"`,
    );
    res.send(pdf);
  }

  @Get('medical-fee/:paymentId')
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.DOCTOR, UserRole.RECEPTIONIST)
  @Header('Content-Type', 'application/pdf')
  async getMedicalFeeReport(
    @Req() req: any,
    @Param('paymentId') paymentId: string,
    @Res() res: Response,
  ) {
    // Se for médico, verificar se o repasse é dele
    if (req.user.role === UserRole.DOCTOR && req.user.staffId) {
      const payment = await this.reportsService[
        'prisma'
      ].client.medicalFeePayment.findFirst({
        where: {
          id: paymentId,
          tenantId: req.tenantId,
          staffId: req.user.staffId,
        },
      });

      if (!payment) {
        return res.status(403).json({
          message: 'Você não tem permissão para acessar este relatório.',
        });
      }
    }

    const pdf = await this.reportsService.generateMedicalFeeReport(
      req.tenantId,
      paymentId,
      req.user?.role,
      req.user?.staffId,
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="repasse-medico-${paymentId}.pdf"`,
    );
    res.send(pdf);
  }

  @Get('medical-fee-pending')
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.DOCTOR, UserRole.RECEPTIONIST)
  @Header('Content-Type', 'application/pdf')
  async getPendingMedicalFeeReport(
    @Req() req: any,
    @Res() res: Response,
    @Query('staffId') staffId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    if (!staffId || !startDate || !endDate) {
      return res
        .status(400)
        .json({ message: 'staffId, startDate e endDate são obrigatórios' });
    }

    // Se for médico, só pode ver seus próprios repasses
    if (req.user.role === UserRole.DOCTOR && req.user.staffId) {
      if (staffId !== req.user.staffId) {
        return res.status(403).json({
          message: 'Você não tem permissão para acessar este relatório.',
        });
      }
    }

    const pdf = await this.reportsService.generatePendingMedicalFeeReport(
      req.tenantId,
      staffId,
      startDate,
      endDate,
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="repasse-pendente-${staffId}-${startDate}.pdf"`,
    );
    res.send(pdf);
  }

  @Get('expenses')
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.RECEPTIONIST)
  @Header('Content-Type', 'application/pdf')
  async getExpenseReport(
    @Req() req: any,
    @Res() res: Response,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('categoryId') categoryId?: string,
  ) {
    if (!startDate || !endDate) {
      return res
        .status(400)
        .json({ message: 'startDate e endDate são obrigatórios' });
    }

    const pdf = await this.reportsService.generateExpenseReport(
      req.tenantId,
      startDate,
      endDate,
      categoryId,
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="saidas-${startDate}-${endDate}.pdf"`,
    );
    res.send(pdf);
  }

  @Get('closures')
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.RECEPTIONIST)
  @Header('Content-Type', 'application/pdf')
  async getClosuresReport(
    @Req() req: any,
    @Res() res: Response,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('userId') userId?: string,
  ) {
    if (!startDate || !endDate) {
      return res
        .status(400)
        .json({ message: 'startDate e endDate são obrigatórios' });
    }

    // Se for recepcionista, só pode ver os próprios fechamentos
    let userIdToUse = userId;
    if (req.user.role === UserRole.RECEPTIONIST) {
      userIdToUse = req.user.id;
    }

    const pdf = await this.reportsService.generateClosuresReport(
      req.tenantId,
      startDate,
      endDate,
      userIdToUse,
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="fechamentos-caixa-${startDate}-${endDate}.pdf"`,
    );
    res.send(pdf);
  }
}
