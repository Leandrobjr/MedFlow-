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
import { ProceduresService } from './procedures.service';
import { CreateProcedureDto } from './dto/create-procedure.dto';
import { UpdateProcedureDto } from './dto/update-procedure.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/shared-types';

@Controller('procedures')
export class ProceduresController {
  constructor(private readonly proceduresService: ProceduresService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  create(@Req() req: any, @Body() createProcedureDto: CreateProcedureDto) {
    return this.proceduresService.create(req.tenantId, createProcedureDto);
  }

  @Get()
  findAll(@Req() req: any) {
    return this.proceduresService.findAll(req.tenantId);
  }

  @Get(':id')
  findOne(@Req() req: any, @Param('id') id: string) {
    return this.proceduresService.findOne(req.tenantId, id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() updateProcedureDto: UpdateProcedureDto,
  ) {
    return this.proceduresService.update(req.tenantId, id, updateProcedureDto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  remove(@Req() req: any, @Param('id') id: string) {
    return this.proceduresService.remove(req.tenantId, id);
  }
}
