import { Module } from '@nestjs/common';
import { FinanceService } from './finance.service';
import { FinanceController } from './finance.controller';

@Module({
  controllers: [FinanceController],
  providers: [FinanceService],
  exports: [FinanceService], // Exportar para uso em outros módulos
})
export class FinanceModule {}


