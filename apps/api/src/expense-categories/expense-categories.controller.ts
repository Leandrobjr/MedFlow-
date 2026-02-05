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
import { ExpenseCategoriesService } from './expense-categories.service';
import { CreateExpenseCategoryDto } from './dto/create-expense-category.dto';
import { UpdateExpenseCategoryDto } from './dto/update-expense-category.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/shared-types';

@Controller('expense-categories')
export class ExpenseCategoriesController {
  constructor(
    private readonly expenseCategoriesService: ExpenseCategoriesService,
  ) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  create(@Req() req: any, @Body() createDto: CreateExpenseCategoryDto) {
    return this.expenseCategoriesService.create(req.tenantId, createDto);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.RECEPTIONIST, UserRole.DOCTOR)
  findAll(@Req() req: any) {
    return this.expenseCategoriesService.findAll(req.tenantId);
  }

  @Get('tree/hierarchical')
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.RECEPTIONIST, UserRole.DOCTOR)
  getHierarchicalTree(@Req() req: any) {
    return this.expenseCategoriesService.findTree(req.tenantId);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.RECEPTIONIST, UserRole.DOCTOR)
  findOne(@Req() req: any, @Param('id') id: string) {
    return this.expenseCategoriesService.findOne(req.tenantId, id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() updateDto: UpdateExpenseCategoryDto,
  ) {
    return this.expenseCategoriesService.update(req.tenantId, id, updateDto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  remove(@Req() req: any, @Param('id') id: string) {
    return this.expenseCategoriesService.remove(req.tenantId, id);
  }

  @Patch(':id/deactivate')
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  deactivate(@Req() req: any, @Param('id') id: string) {
    return this.expenseCategoriesService.deactivate(req.tenantId, id);
  }

  @Patch(':id/activate')
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  activate(@Req() req: any, @Param('id') id: string) {
    return this.expenseCategoriesService.activate(req.tenantId, id);
  }
}
