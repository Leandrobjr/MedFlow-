import { IsString, IsOptional, IsNumber, Min } from 'class-validator';

export class UpdateProcedureDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'Valor deve ser um número com no máximo 2 casas decimais' },
  )
  @Min(0, { message: 'Valor deve ser maior ou igual a zero' })
  @IsOptional()
  grossAmount?: number;

  @IsString()
  @IsOptional()
  observations?: string;
}
