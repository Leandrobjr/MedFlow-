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
import { StaffService } from './staff.service';
import { CreateStaffDto } from './dto/create-staff.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/shared-types';

@Controller('staff')
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  create(@Req() req: any, @Body() createStaffDto: CreateStaffDto) {
    return this.staffService.create(req.tenantId, createStaffDto);
  }

  @Get()
  findAll(@Req() req: any, @Query('role') role?: string) {
    return this.staffService.findAll(req.tenantId, role);
  }

  @Get(':id')
  findOne(@Req() req: any, @Param('id') id: string) {
    return this.staffService.findOne(req.tenantId, id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() updateStaffDto: any,
  ) {
    return this.staffService.update(req.tenantId, id, updateStaffDto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  remove(@Req() req: any, @Param('id') id: string) {
    return this.staffService.remove(req.tenantId, id);
  }

  @Get(':id/procedures')
  getProcedures(@Req() req: any, @Param('id') id: string) {
    return this.staffService.getProcedures(req.tenantId, id);
  }
}
