import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import type { ExpenseCategory } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExpenseCategoryDto } from './dto/create-expense-category.dto';
import { UpdateExpenseCategoryDto } from './dto/update-expense-category.dto';

export type ExpenseCategoryNode = ExpenseCategory & { children: ExpenseCategoryNode[] };

@Injectable()
export class ExpenseCategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateExpenseCategoryDto): Promise<ExpenseCategory> {
    if (dto.parentId) {
      const parent = await this.prisma.client.expenseCategory.findFirst({
        where: { id: dto.parentId, tenantId },
      });
      if (!parent) throw new NotFoundException('Categoria pai não encontrada');
    }

    const code = dto.code ?? (await this.generateNextCode(tenantId, dto.parentId ?? null));

    const exists = await this.prisma.client.expenseCategory.findFirst({
      where: { tenantId, code },
      select: { id: true },
    });
    if (exists) throw new BadRequestException('Código já existe neste tenant');

    return this.prisma.client.expenseCategory.create({
      data: {
        tenantId,
        parentId: dto.parentId ?? null,
        name: dto.name,
        code,
        description: dto.description ?? null,
        isActive: true,
        isFixed: dto.isFixed ?? false,
        costCenter: dto.costCenter ?? null,
      },
    });
  }

  async findAll(tenantId: string): Promise<ExpenseCategory[]> {
    return this.prisma.client.expenseCategory.findMany({
      where: { tenantId },
      orderBy: [{ code: 'asc' }, { name: 'asc' }],
    });
  }

  async findTree(tenantId: string): Promise<ExpenseCategoryNode[]> {
    const categories = await this.findAll(tenantId);
    return this.buildTree(categories);
  }

  async findOne(tenantId: string, id: string): Promise<ExpenseCategory> {
    const category = await this.prisma.client.expenseCategory.findFirst({
      where: { id, tenantId },
    });

    if (!category) throw new NotFoundException('Categoria não encontrada');
    return category;
  }

  async update(
    tenantId: string,
    id: string,
    updateDto: UpdateExpenseCategoryDto,
  ): Promise<ExpenseCategory> {
    const category = await this.findOne(tenantId, id);

    if (updateDto.parentId !== undefined) {
      if (updateDto.parentId === id) {
        throw new BadRequestException('Uma categoria não pode ser pai de si mesma');
      }

      if (updateDto.parentId) {
        const parent = await this.findOne(tenantId, updateDto.parentId);
        const children = await this.getAllChildren(tenantId, id);
        if (children.some((c) => c.id === parent.id)) {
          throw new BadRequestException('Não é permitido criar ciclo na árvore');
        }
      }
    }

    if (updateDto.code !== undefined && updateDto.code !== category.code) {
      const exists = await this.prisma.client.expenseCategory.findFirst({
        where: { tenantId, code: updateDto.code! },
        select: { id: true },
      });
      if (exists) throw new BadRequestException('Código já existe neste tenant');
    }

    return this.prisma.client.expenseCategory.update({
      where: { id: category.id },
      data: {
        parentId: updateDto.parentId !== undefined ? updateDto.parentId : category.parentId,
        name: updateDto.name ?? category.name,
        code: updateDto.code ?? category.code,
        description: updateDto.description !== undefined ? updateDto.description : category.description,
        isActive: updateDto.isActive ?? category.isActive,
        isFixed: updateDto.isFixed ?? category.isFixed,
        costCenter: updateDto.costCenter ?? category.costCenter,
      },
    });
  }

  async remove(tenantId: string, id: string): Promise<void> {
    const category = await this.findOne(tenantId, id);

    const hasChildren = await this.prisma.client.expenseCategory.findFirst({
      where: { tenantId, parentId: category.id },
      select: { id: true },
    });

    if (hasChildren) {
      throw new BadRequestException('Não é permitido excluir categoria com subcategorias');
    }

    await this.prisma.client.expenseCategory.delete({ where: { id: category.id } });
  }

  async deactivate(tenantId: string, id: string): Promise<ExpenseCategory> {
    return this.update(tenantId, id, { isActive: false });
  }

  async activate(tenantId: string, id: string): Promise<ExpenseCategory> {
    return this.update(tenantId, id, { isActive: true });
  }

  private buildTree(categories: ExpenseCategory[]): ExpenseCategoryNode[] {
    const map = new Map<string, ExpenseCategoryNode>();
    const roots: ExpenseCategoryNode[] = [];

    categories.forEach((c) => map.set(c.id, { ...c, children: [] }));

    map.forEach((node) => {
      if (!node.parentId) roots.push(node);
      else {
        const parent = map.get(node.parentId);
        if (parent) parent.children.push(node);
        else roots.push(node);
      }
    });

    const sortRecursive = (n: ExpenseCategoryNode) => {
      n.children.sort(
        (a, b) => (a.code ?? '').localeCompare(b.code ?? '') || a.name.localeCompare(b.name),
      );
      n.children.forEach(sortRecursive);
    };

    roots.sort((a, b) => (a.code ?? '').localeCompare(b.code ?? '') || a.name.localeCompare(b.name));
    roots.forEach(sortRecursive);

    return roots;
  }

  private async generateNextCode(tenantId: string, parentId: string | null): Promise<string> {
    if (!parentId) {
      const last = await this.prisma.client.expenseCategory.findFirst({
        where: { tenantId, parentId: null },
        orderBy: { code: 'desc' },
        select: { code: true },
      });
      return this.nextNumericCode(last?.code);
    }

    const parent = await this.findOne(tenantId, parentId);

    const lastChild = await this.prisma.client.expenseCategory.findFirst({
      where: { tenantId, parentId },
      orderBy: { code: 'desc' },
      select: { code: true },
    });

    const nextSuffix = this.nextNumericSuffix(parent.code, lastChild?.code);
    return `${parent.code}.${nextSuffix}`;
  }

  private nextNumericCode(lastCode?: string | null): string {
    const last = lastCode ? parseInt(lastCode.replace(/\D/g, ''), 10) : 0;
    return (last + 1).toString().padStart(3, '0');
  }

  private nextNumericSuffix(parentCode: string, lastChildCode?: string | null): string {
    if (!lastChildCode) return '01';
    const parts = lastChildCode.split('.');
    const lastSuffix = parts[parts.length - 1] ?? '0';
    const n = parseInt(lastSuffix, 10);
    return (Number.isFinite(n) ? n + 1 : 1).toString().padStart(2, '0');
  }

  private async getAllChildren(tenantId: string, id: string): Promise<ExpenseCategory[]> {
    const all = await this.findAll(tenantId);

    const byParent = new Map<string, ExpenseCategory[]>();
    all.forEach((c) => {
      if (!c.parentId) return;
      const arr = byParent.get(c.parentId) ?? [];
      arr.push(c);
      byParent.set(c.parentId, arr);
    });

    const out: ExpenseCategory[] = [];
    const queue: string[] = [id];

    while (queue.length) {
      const current = queue.shift()!;
      const children = byParent.get(current) ?? [];
      for (const child of children) {
        out.push(child);
        queue.push(child.id);
      }
    }

    return out;
  }
}
