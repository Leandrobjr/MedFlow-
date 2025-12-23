import { Module } from '@nestjs/common';
import { PepService } from './pep.service';
import { PepController } from './pep.controller';

@Module({
  controllers: [PepController],
  providers: [PepService],
})
export class PepModule {}

