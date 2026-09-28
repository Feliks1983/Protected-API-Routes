import mongoose, { model, Schema, ObjectId } from 'mongoose';

export enum Priority {
  Low = 'low',
  Medium = 'medium',
  High = 'high',
}

export interface Todo {
  id: number;
  text: string;
  completed: boolean;
  createdAt: Date;
  updatedAt?: Date;
  priority?: Priority;
  category?: string;
  dueDate?: Date;
  userId: string;
}

export interface CreateTodoInput {
  text: string;
  priority?: Priority;
  category?: string;
  dueDate?: Date;
  userId: string;
}

export interface UpdateTodoInput {
  text?: string;
  completed?: boolean;
  priority?: Priority;
  category?: string;
  dueDate?: Date;
}

export interface TodoQuery {
  userId?: string;
  page?: number;
  limit?: number;
  completed?: boolean;
  priority?: Priority;
  search?: string;
  category?: string;
}

export interface PaginatedResult {
  todos: Todo[];
  total: number;
  page: number;
  limit: number;
}

export interface TodoMeta {
  page: number;
  limit: number;
  total: number;
  items: [];
}

export interface TodoFilters {
  completed?: boolean;
  priority?: Priority;
  search?: string;
}

export interface TodoStats {
  total: number;
  completed: number;
  pending: number;
  overdue: number;
}

export interface ValidationDetail {
  field: string;
  message: string;
  value: unknown;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  details?: ValidationDetail[];
  meta?: {
    total: number;
    page: number;
    limit: number;
  };
}

export interface TodoService {
  list(filters: TodoFilters, page: number, limit: number): Promise<PaginatedResult>;
  getById(id: number): Promise<Todo | null>;
  create(text: string): Promise<Todo>;
  update(id: number, updates: Partial<Pick<Todo, 'text' | 'completed'>>): Promise<Todo | null>;
  delete(id: number): Promise<boolean>;
}

const todoSchema = new Schema<Todo>(
  {
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },

    completed: {
      type: Boolean,
      default: false,
    },

    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium',
    },
    category: { type: String, trim: true },
    dueDate: {
      type: Date,
      default: undefined,
    },
    userId: {
      type: String,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

todoSchema.index({ userId: 1, createdAt: -1 });
todoSchema.index({ userId: 1, completed: 1 });
export const Todo = model<Todo>('Todo', todoSchema);
export const todoService: TodoService = {} as TodoService;

let todos: Todo[] = [];
let nextId = 1;

const isOverdue = (todo: Todo): boolean =>
  !todo.completed && !!todo.dueDate && todo.dueDate.getTime() < Date.now();

export const getTodos = (
  options: TodoQuery = {}
): PaginatedResult => {
  const { userId, page = 1, limit = 10, completed, priority, search, category } = options;

  let filtered = [...todos];

   if (userId !== undefined) {
     filtered = filtered.filter(todo => todo.userId === userId);
   }

  if (completed !== undefined) {
    filtered = filtered.filter(todo => todo.completed === completed);
  }

  if (priority !== undefined) {
    filtered = filtered.filter(todo => todo.priority === priority);
  }

  if (category !== undefined) {
    const categorySearch = category.trim().toLowerCase();

    filtered = filtered.filter(todo => todo.category?.toLowerCase() === categorySearch);
  }

  if (search) {
    const searchText = search.trim().toLowerCase();

    filtered = filtered.filter(todo => todo.text.toLowerCase().includes(searchText));
  }

  const total = filtered.length;
  const start = (page - 1) * limit;
  const paginatedTodos = filtered.slice(start, start + limit);

  return { todos: paginatedTodos, total, page, limit };
};

export const getTodoById = (id: number, userId?: string): Todo | null => {
   const todo = todos.find(t => t.id === id);
   if (!todo) return null;
   if (userId !== undefined && todo.userId !== userId) return null;
   return todo;
};

export const createTodo = (input: CreateTodoInput): Todo => {
  const todo: Todo = {
    id: nextId++,
    text: input.text.trim(),
    completed: false,
    priority: input.priority || Priority.Medium,
    category: input.category?.trim() || undefined,
    dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
    createdAt: new Date(),
    userId: input.userId,
  };
  todos.push(todo);
  return todo;
};

export const updateTodo = (id: number, userId: string, input: UpdateTodoInput): Todo | null => {
  const todoIndex = todos.findIndex(todo => todo.id === id && todo.userId === userId);

  if (todoIndex === -1) {
    return null;
  }
  const todo = todos[todoIndex];

  if (input.text !== undefined) {
    todo.text = input.text.trim();
  }

  if (input.completed !== undefined) {
    todo.completed = input.completed;
  }

  if (input.priority !== undefined) {
    todo.priority = input.priority;
  }

  if (input.category !== undefined) {
    todo.category = input.category.trim() || undefined;
  }

  if (input.dueDate !== undefined) {
    todo.dueDate = input.dueDate ? new Date(input.dueDate) : undefined;
  }
  todo.updatedAt = new Date();
  return todo;
};

export const deleteTodo = (id: number, user: any): boolean => {
  const index = todos.findIndex(todo => todo.id === id);
  if (index === -1) {
    return false;
  }
  todos.splice(index, 1);
  return true;
};

export const getStats = (userId: string | undefined): TodoStats => {
   const own = todos.filter(todo => todo.userId === userId);
   const total = own.length;
   const completed = own.filter(todo => todo.completed).length;
   const pending = total - completed;
   const overdue = own.filter(isOverdue).length;
   return { total, completed, pending, overdue };
};

export const getGlobalStats = (): TodoStats => {
  const total = todos.length;
  const completed = todos.filter(todo => todo.completed).length;
  const pending = total - completed;
  const overdue = todos.filter(isOverdue).length;
  return { total, completed, pending, overdue };
};
