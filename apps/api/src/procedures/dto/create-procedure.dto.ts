import { IsString, IsNotEmpty, IsNumber, IsOptional, Min } from 'class-validator';

export class CreateProcedureDto {
  @IsString()
  @IsNotEmpty({ message: 'Nome do procedimento é obrigatório' })
  name: string;

  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Valor deve ser um número com no máximo 2 casas decimais' })
  @Min(0, { message: 'Valor deve ser maior ou igual a zero' })
  grossAmount: number;

  @IsString()
  @IsOptional()
  observations?: string;
}
