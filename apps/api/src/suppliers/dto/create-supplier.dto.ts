import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateSupplierDto {
  @IsString()
  @IsNotEmpty({ message: 'Nome do fornecedor é obrigatório' })
  name: string;

  @IsString()
  @IsOptional()
  contactInfo?: string;
}
