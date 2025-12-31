import { IsNotEmpty, IsOptional, IsString, IsNumber, IsBoolean, IsObject, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class DayPeriodDto {
  @IsString()
  start: string; // "HH:mm"

  @IsString()
  end: string; // "HH:mm"
}

export class DayScheduleDto {
  @IsBoolean()
  enabled: boolean;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => DayPeriodDto)
  periods?: DayPeriodDto[];
}

export class WeeklyScheduleDto {
  monday?: DayScheduleDto;
  tuesday?: DayScheduleDto;
  wednesday?: DayScheduleDto;
  thursday?: DayScheduleDto;
  friday?: DayScheduleDto;
  saturday?: DayScheduleDto;
  sunday?: DayScheduleDto;
}

export class CreateScheduleConfigDto {
  @IsString()
  @IsNotEmpty()
  staffId: string;

  @IsNumber()
  @IsNotEmpty()
  defaultDuration: number; // em minutos

  @IsObject()
  @ValidateNested()
  @Type(() => WeeklyScheduleDto)
  weeklySchedule: WeeklyScheduleDto;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateScheduleConfigDto {
  @IsNumber()
  @IsOptional()
  defaultDuration?: number;

  @IsObject()
  @IsOptional()
  @ValidateNested()
  @Type(() => WeeklyScheduleDto)
  weeklySchedule?: WeeklyScheduleDto;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

