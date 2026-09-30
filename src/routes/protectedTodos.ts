import { Router, Request, Response, NextFunction } from 'express';
import { createTodo, deleteTodo, getStats, getTodos, Priority, updateTodo } from '../models/Todo';
import { requireEmailVerified } from '../middleware/auth';

export const router = Router();

router.get(
  '/',
  requireEmailVerified,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = Number(req.query.page) || 1;

      const limit = Number(req.query.limit) || 10;

      const completed =
        req.query.completed !== undefined ? req.query.completed === 'true' : undefined;

      const priority =
        req.query.priority !== undefined ? (req.query.priority as Priority) : undefined;

      const getUserId = (req: Request): string | null =>
        req.user?.id ? String(req.user.id) : null;

      const userId = getUserId(req);
      if (!userId) {
        return res
          .status(401)
          .json({ success: false, error: 'UNAUTHORIZED', message: 'Unauthorized' });
      }

      const result = await getTodos({
        userId: req.user?.id,
        page,
        limit,
        completed,
        priority,
      });

      res.status(200).json({
        success: true,
        data: {
          items: (await result).todos,
          page: (await result).page,
          limit: (await result).limit,
          total: (await result).total,
        },
        message: 'Todos retrieved successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);
router.get(
  '/stats',
  requireEmailVerified,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const stats = await getStats(req.user?.id as string);

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      console.error('GET /todos/stats:', error);

      return res.status(500).json({
        success: false,
        error: 'INTERNAL_SERVER_ERROR',
        message: 'internal server error',
      });
    }
  }
);
router.post(
  '/',
  requireEmailVerified,
  async (req: Request, res: Response, next: NextFunction) => {
    const { text, priority, dueDate } = req.body ?? {};

    if (typeof text !== 'string' || !text.trim() || text.length > 500) {
      return res
        .status(400)
        .json({
          success: false,
          error: 'VALIDATION_ERROR',
          message: 'text is required (1-500 chars)',
        });
    }
    if (priority !== undefined && !Object.values(Priority).includes(priority)) {
      return res
        .status(400)
        .json({ success: false, error: 'VALIDATION_ERROR', message: 'invalid priority' });
    }
    if (dueDate !== undefined && Number.isNaN(new Date(dueDate).getTime())) {
      return res
        .status(400)
        .json({ success: false, error: 'VALIDATION_ERROR', message: 'invalid dueDate' });
    }

    try {
      const todo = await createTodo({
        text: req.body.text,
        priority: req.body.priority,
        category: req.body.category,
        dueDate: req.body.dueDate ? new Date(req.body.dueDate) : undefined,
        userId: String(req.user?.id),
      });

      return res.status(201).json({
        success: true,
        data: todo,
        message: 'Todo created successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);
router.put(
  '/:id',
  requireEmailVerified,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = String(req.params.id);

      if (!Number.isInteger(id)) {
        return res
          .status(404)
          .json({ success: false, error: 'INVALID_ID', message: 'Invalid todo id' });
      }

      const todo = await updateTodo(id, String(req.user?.id), {
        text: req.body.text,
        completed: req.body.completed,
        priority: req.body.priority,
        category: req.body.category,
        dueDate: req.body.dueDate ? new Date(req.body.dueDate) : undefined,
      });
      if (!todo) {
        return res.status(404).json({
          success: false,
          error: 'TODO_NOT_FOUND',
          message: 'Todo not found',
        });
      }

      res.json({
        success: true,
        data: todo,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.delete(
  '/:id',
  requireEmailVerified,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = String(req.params.id);

      if (!Number.isInteger(id)) {
        return res
          .status(400)
          .json({ success: false, error: 'INVALID_ID', message: 'Invalid todo id' });
      }

      const deleted = await deleteTodo(id, req.user?.id as string);

      if (!deleted) {
        return res.status(404).json({
          success: false,
          error: 'TODO_NOT_FOUND',
          message: 'Todo not found',
        });
      }

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);
