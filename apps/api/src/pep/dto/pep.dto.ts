import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateMedicalRecordDto {
  @IsUUID()
  @IsNotEmpty({ message: 'Agendamento é obrigatório' })
  appointmentId: string;

  @IsUUID()
  @IsNotEmpty({ message: 'Paciente é obrigatório' })
  patientId: string;

  @IsUUID()
  @IsNotEmpty({ message: 'Médico é obrigatório' })
  staffId: string;

  @IsString()
  @IsOptional()
  anamnesis?: string;

  @IsString()
  @IsOptional()
  physicalExam?: string;

  @IsString()
  @IsOptional()
  diagnosis?: string;

  @IsString()
  @IsOptional()
  prescription?: string;

  @IsString()
  @IsOptional()
  conduct?: string;
}

export class UpdateMedicalRecordDto {
  @IsString()
  @IsOptional()
  anamnesis?: string;

  @IsString()
  @IsOptional()
  physicalExam?: string;

  @IsString()
  @IsOptional()
  diagnosis?: string;

  @IsString()
  @IsOptional()
  prescription?: string;

  @IsString()
  @IsOptional()
  conduct?: string;
}

export class CreateAddendumDto {
  @IsString()
  @IsNotEmpty({ message: 'O conteúdo do adendo não pode ser vazio' })
  content: string;
}

