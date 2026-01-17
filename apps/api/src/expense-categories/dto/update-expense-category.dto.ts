import { IsOptional, IsString, IsBoolean, IsUUID } from 'class-validator';

export class UpdateExpenseCategoryDto {
  @IsUUID()
  @IsOptional()
  parentId?: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  code?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsBoolean()
  @IsOptional()
  isFixed?: boolean;

  @IsString()
  @IsOptional()
  costCenter?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
