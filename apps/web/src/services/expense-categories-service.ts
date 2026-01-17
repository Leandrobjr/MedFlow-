import { api } from '@/lib/api';

export interface ExpenseCategory {
  id: string;
  tenantId: string;
  parentId?: string;
  name: string;
  code: string;
  description?: string;
  isFixed: boolean;
  costCenter?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  parent?: ExpenseCategory;
  children?: ExpenseCategory[];
  _count?: {
    transactions: number;
  };
}

export interface CreateExpenseCategoryDto {
  parentId?: string;
  name: string;
  code: string;
  description?: string;
  isFixed?: boolean;
  costCenter?: string;
}

export interface UpdateExpenseCategoryDto {
  parentId?: string;
  name?: string;
  code?: string;
  description?: string;
  isFixed?: boolean;
  costCenter?: string;
  isActive?: boolean;
}

export const expenseCategoriesService = {
  getAll: async (includeInactive: boolean = false) => {
    const response = await api.get<ExpenseCategory[]>('/expense-categories', {
      params: { includeInactive },
    });
    return response.data;
  },

  getHierarchicalTree: async (includeInactive: boolean = false) => {
    const response = await api.get<ExpenseCategory[]>('/expense-categories/tree/hierarchical', {
      params: { includeInactive },
    });
    return response.data;
  },

  getById: async (id: string) => {
    const response = await api.get<ExpenseCategory>(`/expense-categories/${id}`);
    return response.data;
  },

  create: async (data: CreateExpenseCategoryDto) => {
    const response = await api.post<ExpenseCategory>('/expense-categories', data);
    return response.data;
  },

  update: async (id: string, data: UpdateExpenseCategoryDto) => {
    const response = await api.patch<ExpenseCategory>(`/expense-categories/${id}`, data);
    return response.data;
  },

  delete: async (id: string) => {
    await api.delete(`/expense-categories/${id}`);
  },

  deactivate: async (id: string) => {
    const response = await api.patch<ExpenseCategory>(`/expense-categories/${id}/deactivate`);
    return response.data;
  },

  activate: async (id: string) => {
    const response = await api.patch<ExpenseCategory>(`/expense-categories/${id}/activate`);
    return response.data;
  },
};
