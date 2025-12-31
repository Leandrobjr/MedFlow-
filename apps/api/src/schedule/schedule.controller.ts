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
import { ScheduleService } from './schedule.service';
import { CreateScheduleConfigDto, UpdateScheduleConfigDto } from './dto/schedule-config.dto';
import { CreateScheduleBlockDto, UpdateScheduleBlockDto } from './dto/schedule-block.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/shared-types';

@Controller('schedule')
export class ScheduleController {
  constructor(private readonly scheduleService: ScheduleService) {}

  // ========== Schedule Config ==========
  @Post('config')
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.DOCTOR)
  createConfig(@Req() req: any, @Body() dto: CreateScheduleConfigDto) {
    return this.scheduleService.createConfig(req.tenantId, dto);
  }

  @Get('config/staff/:staffId')
  getConfigByStaff(@Req() req: any, @Param('staffId') staffId: string) {
    return this.scheduleService.getConfigByStaff(req.tenantId, staffId);
  }

  @Patch('config/staff/:staffId')
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.DOCTOR)
  updateConfig(
    @Req() req: any,
    @Param('staffId') staffId: string,
    @Body() dto: UpdateScheduleConfigDto,
  ) {
    return this.scheduleService.updateConfig(req.tenantId, staffId, dto);
  }

  // ========== Schedule Blocks ==========
  @Post('blocks')
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.DOCTOR)
  createBlock(@Req() req: any, @Body() dto: CreateScheduleBlockDto) {
    return this.scheduleService.createBlock(req.tenantId, dto);
  }

  @Get('blocks/staff/:staffId')
  getBlocksByStaff(
    @Req() req: any,
    @Param('staffId') staffId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.scheduleService.getBlocksByStaff(req.tenantId, staffId, startDate, endDate);
  }

  @Patch('blocks/:id')
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.DOCTOR)
  updateBlock(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateScheduleBlockDto,
  ) {
    return this.scheduleService.updateBlock(req.tenantId, id, dto);
  }

  @Delete('blocks/:id')
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.DOCTOR)
  deleteBlock(@Req() req: any, @Param('id') id: string) {
    return this.scheduleService.deleteBlock(req.tenantId, id);
  }
}

