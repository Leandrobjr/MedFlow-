import { IsNotEmpty, IsOptional, IsString, IsNumber, IsEnum, IsUUID, IsDateString } from 'class-validator';

export enum TransactionType {
  INCOME = 'income',
  EXPENSE = 'expense',
}

export class CreateTransactionDto {
  @IsEnum(TransactionType)
  @IsNotEmpty()
  type: TransactionType;

  @IsString()
  @IsNotEmpty()
  category: string;

  @IsNumber()
  @IsNotEmpty()
  amount: number;

  @IsString()
  @IsOptional()
  method?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsUUID()
  @IsOptional()
  patientId?: string;

  @IsUUID()
  @IsOptional()
  appointmentId?: string;

  @IsUUID()
  @IsOptional()
  staffId?: string;
}

export class CreateClosureDto {
  @IsDateString()
  @IsNotEmpty()
  date: string;

  @IsUUID()
  @IsNotEmpty()
  closedById: string;

  @IsString()
  @IsOptional()
  observations?: string;
}

