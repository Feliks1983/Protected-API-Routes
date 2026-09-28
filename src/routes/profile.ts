import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { User } from '../models/User';
import { Role } from '../utils/emailService';
import { authenticateToken } from '../middleware/auth';

export const router = Router();

const Profile = ['firstName', 'lastName', 'bio'];

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

export function parseUpdate(
  body: unknown,
  allowRoles: boolean
): { set: Record<string, unknown> } | { error: string } {
  if (!isObj(body)) return { error: 'Body must be an object' };
  const allowedTop = allowRoles ? ['profile', 'roles'] : ['profile'];
  const set: Record<string, unknown> = {};

  for (const key of Object.keys(body)) {
    if (!allowedTop.includes(key)) return { error: `Field not allowed: ${key}` };
  }
  if (body.profile !== undefined) {
    if (!isObj(body.profile)) return { error: 'profile must be an object' };
    for (const [k, v] of Object.entries(body.profile)) {
      if (!Profile.includes(k)) return { error: `Field not allowed: profile.${k}` };
      if (typeof v !== 'string') return { error: `profile.${k} must be a string` };
      if (k !== 'bio' && v.trim() === '') return { error: `profile.${k} must not be empty` };
      set[`profile.${k}`] = v;
    }
  }
  if (body.roles !== undefined) {
    const r = body.roles;
    if (!Array.isArray(r) || r.length === 0 || !r.every(x => x.includes(x as Role))) {
      return { error: "roles must be a non-empty array of 'user' | 'admin'" };
    }
    set.roles = [...new Set(r)];
  }
  if (Object.keys(set).length === 0) return { error: 'No fields to update' };
  return { set };
}

router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = await User.findById(req.user!.id)
      .select('_id email username role isEmailVerified profile createdAt')
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'USER_NOT_FOUND',
        message: 'user not found',
      });
    }

    return res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error('GET /profile:', error);

    return res.status(500).json({
      success: false,
      error: 'INTERNAL_SERVER_ERROR',
      message: 'internal server error',
    });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({
        success: false,
        error: 'USER_NOT_FOUND',
        message: "user not found"
      });
    }

    const user = await User.findById(id).select('_id username profile createdAt').lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'USER_NOT_FOUND',
        message: "user not found"
      });
    }

    return res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error('GET /profile/:id:', error);

    return res.status(500).json({
      success: false,
      error: 'INTERNAL_SERVER_ERROR',
      message: "internal server error"
    });
  }
});

router.put('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const body = req.body ?? {};

    if (typeof body !== 'object' || Array.isArray(body) || body === null) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_BODY',
        message: 'invalid body'
      });
    }

    for (const key of Object.keys(body)) {
      if (!Profile.includes(key)) {
        return res.status(400).json({
          success: false,
          error: 'FIELD_NOT_ALLOWED',
          message: `Field not allowed: ${key}`,
        });
      }
    }

    const update: Record<string, string> = {};

    for (const field of Profile) {
      if (body[field] !== undefined) {
        if (typeof body[field] !== 'string') {
          return res.status(400).json({
            success: false,
            error: 'INVALID_FIELD',
            message: `${field} must be a string`,
          });
        }

        const value = body[field].trim();

        if ((field === 'firstName' || field === 'lastName' || field === 'bio') && !value) {
          return res.status(400).json({
            success: false,
            error: 'INVALID_FIELD',
            message: `${field} must not be empty`,
          });
        }

        update[`profile.${field}`] = value;
      }
    }

    if (Object.keys(update).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'NO_FIELDS_TO_UPDATE',
        message: "no fields to update"
      });
    }

    const user = await User.findByIdAndUpdate(
      req.user!.id,
      { $set: update },
      { new: true, runValidators: true }
    )
      .select('_id email username role isEmailVerified profile createdAt')
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'USER_NOT_FOUND',
      });
    }

    return res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error('PUT /profile:', error);

    return res.status(500).json({
      success: false,
      error: 'INTERNAL_SERVER_ERROR',
      message: "internal server error"
    });
  }
});

