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
import { SuppliersService } from './suppliers.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/shared-types';

@Controller('suppliers')
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  create(@Req() req: any, @Body() createSupplierDto: CreateSupplierDto) {
    return this.suppliersService.create(req.tenantId, createSupplierDto);
  }

  @Get()
  findAll(@Req() req: any) {
    return this.suppliersService.findAll(req.tenantId);
  }

  @Get(':id')
  findOne(@Req() req: any, @Param('id') id: string) {
    return this.suppliersService.findOne(req.tenantId, id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() updateSupplierDto: UpdateSupplierDto,
  ) {
    return this.suppliersService.update(req.tenantId, id, updateSupplierDto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  remove(@Req() req: any, @Param('id') id: string) {
    return this.suppliersService.remove(req.tenantId, id);
  }
}
