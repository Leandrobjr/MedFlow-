import { IsNotEmpty, IsOptional, IsString, IsBoolean, IsDateString, IsEnum } from 'class-validator';

export enum BlockType {
  DATE = 'date',      // Bloqueia o dia inteiro
  PERIOD = 'period',  // Bloqueia um período específico
}

export class CreateScheduleBlockDto {
  @IsString()
  @IsNotEmpty()
  staffId: string;

  @IsEnum(BlockType)
  @IsNotEmpty()
  blockType: BlockType;

  @IsDateString()
  @IsNotEmpty()
  startDate: string;

  @IsDateString()
  @IsOptional()
  endDate?: string; // Para períodos ou múltiplos dias

  @IsString()
  @IsOptional()
  startTime?: string; // "HH:mm" - apenas para blockType = "period"

  @IsString()
  @IsOptional()
  endTime?: string; // "HH:mm" - apenas para blockType = "period"

  @IsString()
  @IsOptional()
  reason?: string;

  @IsBoolean()
  @IsOptional()
  isRecurring?: boolean;
}

export class UpdateScheduleBlockDto {
  @IsEnum(BlockType)
  @IsOptional()
  blockType?: BlockType;

  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsString()
  @IsOptional()
  startTime?: string;

  @IsString()
  @IsOptional()
  endTime?: string;

  @IsString()
  @IsOptional()
  reason?: string;

  @IsBoolean()
  @IsOptional()
  isRecurring?: boolean;
}

