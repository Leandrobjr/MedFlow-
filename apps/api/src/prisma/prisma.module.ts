import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { TenantContextService } from '../common/tenant/tenant-context.service';
import { TenantPrismaService } from './tenant-prisma.service';

@Global()
@Module({
  providers: [PrismaService, TenantContextService, TenantPrismaService],
  exports: [PrismaService, TenantContextService, TenantPrismaService],
})
export class PrismaModule {}
