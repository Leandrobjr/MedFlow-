import { IsNotEmpty, IsOptional, IsString, IsDateString, IsUUID } from 'class-validator';

export class CreateAppointmentDto {
  @IsUUID()
  @IsNotEmpty({ message: 'Paciente é obrigatório' })
  patientId: string;

  @IsUUID()
  @IsNotEmpty({ message: 'Profissional/Médico é obrigatório' })
  staffId: string;

  @IsDateString({}, { message: 'Data/Hora de início inválida' })
  @IsNotEmpty({ message: 'Horário de início é obrigatório' })
  startTime: string;

  @IsDateString({}, { message: 'Data/Hora de término inválida' })
  @IsNotEmpty({ message: 'Horário de término é obrigatório' })
  endTime: string;

  @IsString()
  @IsOptional()
  type?: string;

  @IsString()
  @IsOptional()
  observations?: string;
}

