import { IsEmail, IsNotEmpty, IsOptional, IsString, IsEnum, IsNumber } from 'class-validator';
import { UserRole } from '../../common/shared-types';

export class CreateStaffDto {
  @IsString()
  @IsNotEmpty({ message: 'Nome é obrigatório' })
  name: string;

  @IsEmail({}, { message: 'E-mail inválido' })
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsNotEmpty({ message: 'Cargo/Papel é obrigatório' })
  role: string;

  @IsString()
  @IsOptional()
  specialty?: string;

  @IsString()
  @IsOptional()
  crm?: string;

  @IsString()
  @IsOptional()
  crmState?: string;

  @IsString()
  @IsOptional()
  rqe?: string;

  @IsString()
  @IsOptional()
  rqeState?: string;

  @IsString()
  @IsOptional()
  commissionType?: string;

  @IsNumber()
  @IsOptional()
  commissionRate?: number;

  @IsNumber()
  @IsOptional()
  fixedCommission?: number;

  @IsString()
  @IsOptional()
  userId?: string;
}

