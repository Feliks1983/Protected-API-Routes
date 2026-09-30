import mongoose, { model, Schema, Types } from 'mongoose';

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
    toJSON: {
      transform: (_doc, ret: any) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

todoSchema.index({ userId: 1, createdAt: -1 });
todoSchema.index({ userId: 1, completed: 1 });
export const TodoModel = model('Todo', todoSchema);
export const todoService: TodoService = {} as TodoService;

let todos = (doc: any): Todo => ({
  id: doc._id.toString(),
  text: doc.text,
  completed: doc.completed,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
  priority: doc.priority,
  category: doc.category,
  dueDate: doc.dueDate,
  userId: doc.userId,
});

const isOverdue = (todo: Todo): boolean =>
  !todo.completed && !!todo.dueDate && todo.dueDate.getTime() < Date.now();

export const getTodos = async(
  options: TodoQuery = {}
): Promise<PaginatedResult> => {
  const { userId, page = 1, limit = 10, completed, priority, search, category } = options;

  let filtered: Record<string, any> = {};

    if (userId !== undefined) filtered.userId = userId;
    if (completed !== undefined) filtered.completed = completed;
    if (priority !== undefined) filtered.priority = priority;
    if (category !== undefined) filtered.category = category.trim();
    if (search) filtered.text = { $regex: search.trim(), $options: 'i' };

  const [docs, total] = await Promise.all([
    TodoModel.find(filtered)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    TodoModel.countDocuments(filtered),
  ]);

  return { todos: docs.map(todos), total, page, limit };
};

export const getTodoById = async(id: string, userId?: string): Promise<Todo | null> => {
   if (!Types.ObjectId.isValid(id)) return null;
   const filtered: Record<string, any> = { _id: id };
   if (userId !== undefined) filtered.userId = userId;
   const doc = await TodoModel.findOne(filtered);
   return doc ? todos(doc) : null;
};

export const createTodo = async(input: CreateTodoInput): Promise<Todo> => {
  const todo = await TodoModel.create({
    text: input.text.trim(),
    completed: false,
    priority: input.priority || Priority.Medium,
    category: input.category?.trim() || undefined,
    dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
    createdAt: new Date(),
    userId: input.userId,
  });

  return todos(todo);
};

export const updateTodo = async(id: string, userId: string, input: UpdateTodoInput): Promise<Todo | null> => {
  if (!Types.ObjectId.isValid(id)) return null;

  const update: Record<string, any> = {};
  if (input.text !== undefined) update.text = input.text.trim();
  if (input.completed !== undefined) update.completed = input.completed;
  if (input.priority !== undefined) update.priority = input.priority;
  if (input.category !== undefined) update.category = input.category.trim() || undefined;
  if (input.dueDate !== undefined) {
    update.dueDate = input.dueDate ? new Date(input.dueDate) : undefined;
  }

  const doc = await TodoModel.findOneAndUpdate(
    { _id: id, userId },
    { $set: update },
    { new: true, runValidators: true }
  );
  return doc ? todos(doc) : null;
};

export const deleteTodo = async(id: string, userId: string): Promise<boolean> => {
 if (!Types.ObjectId.isValid(id)) return false;
 const result = await TodoModel.deleteOne({ _id: id, userId });
 return result.deletedCount === 1;
};

export const getStats = async(userId: string): Promise<TodoStats> => {
   const [total, completed, overdue] = await Promise.all([
     TodoModel.countDocuments({ userId }),
     TodoModel.countDocuments({ userId, completed: true }),
     TodoModel.countDocuments({ userId, ...isOverdue }),
   ]);
   return { total, completed, pending: total - completed, overdue };
};

export const getGlobalStats = async(): Promise<TodoStats> => {
  const [total, completed, overdue] = await Promise.all([
    TodoModel.countDocuments({}),
    TodoModel.countDocuments({ completed: true }),
    TodoModel.countDocuments(isOverdue),
  ]);
  return { total, completed, pending: total - completed, overdue };
};
