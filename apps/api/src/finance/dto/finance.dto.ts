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

  @IsUUID()
  @IsOptional()
  categoryId?: string;
}

export class UpdateTransactionDto {
  @IsString()
  @IsOptional()
  category?: string;

  @IsNumber()
  @IsOptional()
  amount?: number;

  @IsString()
  @IsOptional()
  method?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsUUID()
  @IsOptional()
  categoryId?: string;
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

export class CloseReceptionistBoxDto {
  @IsDateString()
  @IsNotEmpty()
  date: string;

  @IsNumber()
  @IsNotEmpty()
  initialBalance: number;

  @IsNumber()
  @IsNotEmpty()
  finalBalance: number;

  @IsNumber()
  @IsOptional()
  cashCount?: number;

  @IsNumber()
  @IsOptional()
  cardCount?: number;

  @IsNumber()
  @IsOptional()
  pixCount?: number;

  @IsString()
  @IsOptional()
  observations?: string;
}

export class CloseAdminBoxDto {
  @IsDateString()
  @IsNotEmpty()
  date: string;

  @IsNumber()
  @IsNotEmpty()
  initialBalance: number;

  @IsNumber()
  @IsNotEmpty()
  finalBalance: number;

  @IsNumber()
  @IsOptional()
  cashCount?: number;

  @IsNumber()
  @IsOptional()
  cardCount?: number;

  @IsNumber()
  @IsOptional()
  pixCount?: number;

  @IsString()
  @IsOptional()
  observations?: string;
}

export class CloseMedicalFeePaymentDto {
  @IsUUID()
  @IsNotEmpty()
  staffId: string;

  @IsDateString()
  @IsNotEmpty()
  periodStart: string;

  @IsDateString()
  @IsNotEmpty()
  periodEnd: string;

  @IsString()
  @IsOptional()
  paymentMethod?: string;

  @IsString()
  @IsOptional()
  observations?: string;
}
