import { Router, Request, Response, NextFunction } from 'express';
import mongoose, { isValidObjectId } from 'mongoose';
import { User } from '../models/User';
import { authenticateToken, requireRole } from '../middleware/auth';
import { getGlobalStats, getTodos } from '../models/Todo';
export const router = Router();

const USER_EXCLUDE_FIELDS = '-password -passwordHash -refreshTokens -internalFlags';

router.get(
  '/users',
  authenticateToken,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    try {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 10;
      const search = typeof req.query.search === 'string' ? req.query.search : undefined;
      const role = typeof req.query.role === 'string' ? req.query.role : undefined;
      const status = typeof req.query.status === 'string' ? req.query.status : undefined;

      const filter: Record<string, any> = {};
      if (role) filter.roles = role;
      if (status) filter.status = status;
      if (search) {
        filter.$or = [
          { email: { $regex: search, $options: 'i' } },
          { username: { $regex: search, $options: 'i' } },
        ];
      }

      const [items, total] = await Promise.all([
        User.find(filter)
          .select(USER_EXCLUDE_FIELDS)
          .skip((page - 1) * limit)
          .limit(limit),
        User.countDocuments(filter),
      ]);

      res.status(200).json({
        success: true,
        data: { items, page, limit, total },
        message: 'Todos retrieved successfully',
      });
    } catch (err) {
      console.error('GET /admin/users error:', (err as Error).message);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
);

router.get(
  '/users/:id',
  authenticateToken,
  requireRole('admin'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        res.status(400).json({ success: false, error: 'Invalid user ID format' });
        return;
      }
      const updateData: Record<string, any> = {};
      const user = isValidObjectId(id)
        ? await User.findByIdAndUpdate(
            id,
            { $set: updateData },
            { returnDocument: 'after', runValidators: true }
          )
        : null;
      if (!user) {
        res.status(404).json({ success: false, error: 'User not found' });
        return;
      }
      res.json(user);
    } catch (err) {
      console.error('GET /admin/users/:id error:', (err as Error).message);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
);

router.put(
  '/users/:id/role',
  authenticateToken,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const { role } = req.body;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        res.status(400).json({ success: false, error: 'Invalid user ID format' });
        return;
      }

      const updateData: Record<string, any> = {};
      if (role !== undefined) updateData.roles = role;
      if (role) {
        return res.status(403).json({ success: false, error: 'You cannot change your role.' });
      }

      const user = isValidObjectId(id)
        ? await User.findByIdAndUpdate(
            id,
            { $set: updateData },
            { returnDocument: 'after', runValidators: true }
          )
        : null;

      if (!user) {
        res.status(404).json({ success: false, error: 'User not found' });
        return;
      }

      res.status(200).json({ success: true, data: user });
    } catch (err: any) {
      console.error('PATCH /admin/users/:id error:', err);
      res.status(500).json({ success: false, error: err.message || 'Internal server error' });
    }
  }
);

router.put('/users/:id/status', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id;
    const { status } = req.body;

    if (!isValidObjectId(id)) {
      res.status(400).json({ success: false, error: 'Invalid user ID format' });
      return;
    }

    if (status !== 'active' && status !== 'inactive') {
      res.status(400).json({ success: false, error: 'Invalid status' });
      return;
    }

    const updateData: Record<string, any> = {};
    const user = isValidObjectId(id)
      ? await User.findByIdAndUpdate(
          id,
          { $set: updateData },
          { returnDocument: 'after', runValidators: true }
        )
      : null;

    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    res.status(200).json({ success: true, data: user });
  } catch (err) {
    console.error('PUT /admin/users/:id/status error:', (err as Error).message);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.get('/statistics', async (req: Request, res: Response) => {
  try {
    const [usersByRole, usersByStatus, todoStats] = await Promise.all([
      User.aggregate([{ $group: { _id: '$roles', count: { $sum: 1 } } }]),
      User.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      getGlobalStats(),
    ]);

    res.status(200).json({
      success: true,
      data: {
        usersByRole,
        usersByStatus,
        todos: todoStats,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error('GET /admin/statistics error:', (err as Error).message);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.get('/users/:id/todos', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);

    if (!isValidObjectId(id)) {
      res.status(400).json({ success: false, error: 'Invalid user ID format' });
      return;
    }

    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;

    const result = getTodos({ userId: id, page, limit });

    res.status(200).json({
      success: true,
      data: {
        items: result.todos,
        page,
        limit,
        total: result.total,
      },
    });
  } catch (err) {
    console.error('GET /admin/users/:id/todos error:', (err as Error).message);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

