import { Module } from '@nestjs/common';
import { PepService } from './pep.service';
import { PepController } from './pep.controller';
import { FinanceModule } from '../finance/finance.module';

@Module({
  imports: [FinanceModule], // Importar FinanceModule para usar FinanceService
  controllers: [PepController],
  providers: [PepService],
})
export class PepModule {}


