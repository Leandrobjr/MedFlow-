import { Injectable, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExpenseCategoryDto } from './dto/create-expense-category.dto';
import { UpdateExpenseCategoryDto } from './dto/update-expense-category.dto';

@Injectable()
export class ExpenseCategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, createDto: CreateExpenseCategoryDto) {
    // Verificar se o código já existe para este tenant
    const existing = await this.prisma.client.expenseCategory.findUnique({
      where: {
        tenantId_code: {
          tenantId,
          code: createDto.code,
        },
      },
    });

    if (existing) {
      throw new ConflictException('Já existe uma categoria com este código.');
    }

    // Se tiver parentId, verificar se existe e pertence ao tenant
    if (createDto.parentId) {
      const parent = await this.prisma.client.expenseCategory.findFirst({
        where: {
          id: createDto.parentId,
          tenantId,
        },
      });

      if (!parent) {
        throw new NotFoundException('Categoria pai não encontrada.');
      }
    }

    return this.prisma.client.expenseCategory.create({
      data: {
        ...createDto,
        tenantId,
        isActive: true,
      },
      include: {
        parent: { select: { id: true, name: true, code: true } },
        children: { select: { id: true, name: true, code: true } },
      },
    });
  }

  async findAll(tenantId: string, includeInactive: boolean = false) {
    const where: any = { tenantId };
    
    if (!includeInactive) {
      where.isActive = true;
    }

    return this.prisma.client.expenseCategory.findMany({
      where,
      include: {
        parent: { select: { id: true, name: true, code: true } },
        children: { 
          select: { id: true, name: true, code: true, isActive: true },
          where: includeInactive ? {} : { isActive: true },
        },
        _count: {
          select: {
            transactions: true,
          },
        },
      },
      orderBy: [
        { parentId: 'asc' },
        { code: 'asc' },
      ],
    });
  }

  async findOne(tenantId: string, id: string) {
    const category = await this.prisma.client.expenseCategory.findFirst({
      where: {
        id,
        tenantId,
      },
      include: {
        parent: { select: { id: true, name: true, code: true } },
        children: { 
          select: { id: true, name: true, code: true, isActive: true },
        },
        _count: {
          select: {
            transactions: true,
          },
        },
      },
    });

    if (!category) {
      throw new NotFoundException('Categoria não encontrada.');
    }

    return category;
  }

  async update(tenantId: string, id: string, updateDto: UpdateExpenseCategoryDto) {
    // Verificar se a categoria existe
    const category = await this.findOne(tenantId, id);

    // Se estiver atualizando o código, verificar se não existe outra com o mesmo código
    if (updateDto.code && updateDto.code !== category.code) {
      const existing = await this.prisma.client.expenseCategory.findUnique({
        where: {
          tenantId_code: {
            tenantId,
            code: updateDto.code,
          },
        },
      });

      if (existing) {
        throw new ConflictException('Já existe uma categoria com este código.');
      }
    }

    // Se estiver atualizando o parentId, verificar se não está criando um ciclo
    if (updateDto.parentId) {
      if (updateDto.parentId === id) {
        throw new BadRequestException('Uma categoria não pode ser pai de si mesma.');
      }

      // Verificar se o parentId não é um descendente desta categoria
      const isDescendant = await this.isDescendant(tenantId, updateDto.parentId, id);
      if (isDescendant) {
        throw new BadRequestException('Não é possível criar uma hierarquia circular.');
      }

      // Verificar se o parent existe
      const parent = await this.prisma.client.expenseCategory.findFirst({
        where: {
          id: updateDto.parentId,
          tenantId,
        },
      });

      if (!parent) {
        throw new NotFoundException('Categoria pai não encontrada.');
      }
    }

    return this.prisma.client.expenseCategory.update({
      where: { id },
      data: updateDto,
      include: {
        parent: { select: { id: true, name: true, code: true } },
        children: { select: { id: true, name: true, code: true, isActive: true } },
      },
    });
  }

  async remove(tenantId: string, id: string) {
    const category = await this.findOne(tenantId, id);

    // Verificar se há transações usando esta categoria
    const transactionCount = await this.prisma.client.transaction.count({
      where: {
        categoryId: id,
      },
    });

    if (transactionCount > 0) {
      throw new BadRequestException(
        `Não é possível excluir esta categoria pois existem ${transactionCount} transação(ões) vinculada(s) a ela.`
      );
    }

    // Verificar se há categorias filhas
    const childrenCount = await this.prisma.client.expenseCategory.count({
      where: {
        parentId: id,
      },
    });

    if (childrenCount > 0) {
      throw new BadRequestException(
        `Não é possível excluir esta categoria pois existem ${childrenCount} subcategoria(s) vinculada(s) a ela.`
      );
    }

    return this.prisma.client.expenseCategory.delete({
      where: { id },
    });
  }

  async deactivate(tenantId: string, id: string) {
    await this.findOne(tenantId, id);

    return this.prisma.client.expenseCategory.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async activate(tenantId: string, id: string) {
    await this.findOne(tenantId, id);

    return this.prisma.client.expenseCategory.update({
      where: { id },
      data: { isActive: true },
    });
  }

  // Método auxiliar para verificar se uma categoria é descendente de outra
  private async isDescendant(tenantId: string, potentialDescendantId: string, ancestorId: string): Promise<boolean> {
    let currentId: string | null = potentialDescendantId;

    // Limitar a profundidade para evitar loops infinitos
    let depth = 0;
    const maxDepth = 10;

    while (currentId && depth < maxDepth) {
      if (currentId === ancestorId) {
        return true;
      }

      const category: { parentId: string | null } | null = await this.prisma.client.expenseCategory.findFirst({
        where: {
          id: currentId,
          tenantId,
        },
        select: { parentId: true },
      });

      currentId = category?.parentId || null;
      depth++;
    }

    return false;
  }

  async getHierarchicalTree(tenantId: string, includeInactive: boolean = false) {
    const where: any = { tenantId, parentId: null };
    
    if (!includeInactive) {
      where.isActive = true;
    }

    const rootCategories = await this.prisma.client.expenseCategory.findMany({
      where,
      include: {
        children: {
          where: includeInactive ? {} : { isActive: true },
          orderBy: { code: 'asc' },
        },
        _count: {
          select: {
            transactions: true,
          },
        },
      },
      orderBy: { code: 'asc' },
    });

    // Função recursiva para buscar filhos
    const buildTree = async (parentId: string | null): Promise<any[]> => {
      const where: any = { tenantId, parentId };
      if (!includeInactive) {
        where.isActive = true;
      }

      const children = await this.prisma.client.expenseCategory.findMany({
        where,
        include: {
          _count: {
            select: {
              transactions: true,
            },
          },
        },
        orderBy: { code: 'asc' },
      });

      return Promise.all(
        children.map(async (child) => ({
          ...child,
          children: await buildTree(child.id),
        }))
      );
    };

    // Construir árvore completa
    return Promise.all(
      rootCategories.map(async (root) => ({
        ...root,
        children: await buildTree(root.id),
      }))
    );
  }
}
