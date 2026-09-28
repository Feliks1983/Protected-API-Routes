import { NextFunction, Request, Response } from 'express';
import { Role } from '../utils/emailService';
import jwt, { JwtPayload } from 'jsonwebtoken';

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; role: Role[]; jti: string; email: string; isEmailVerified: boolean; };
    }
  }
}

async function isTokenBlacklisted(jti?: string): Promise<boolean> {
  if (!jti) return false;
  return false;
}

interface CustomJwtPayload extends JwtPayload {
  sub: string;
  roles: Role[];
  type: string;
  jti: string;
  isEmailVerified: boolean;
}

export async function authenticateToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'Unauthorized' });
    return;
  }

  const token = authHeader && authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as CustomJwtPayload;

    if (decoded.type && decoded.type !== 'access') {
      res.status(401).json({ success: false, error: 'Unauthorized: Invalid token type' });
      return;
    }

    const blacklisted = await isTokenBlacklisted(decoded.jti);
    if (blacklisted) {
      res.status(401).json({ success: false, error: 'Unauthorized: Token has been revoked' });
      return;
    }

    const userRoles = Array.isArray(decoded.roles)
      ? decoded.roles
      : decoded.role
        ? [decoded.role]
        : [];

    req.user = {
      id: decoded.sub || (decoded as any).id,
      role: userRoles,
      jti: decoded.jti,
      email: decoded.email,
      isEmailVerified: decoded.isEmailVerified,
    };

    next();
  } catch (err) {
    res.status(403).json({ success: false, error: 'Invalid token' });
  }
}

export const requireRole =
  (...roles: Role[]) =>
  (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'UNAUTHORIZED' });
      return;
    }
    const hasRole = roles.some(role => req.user!.role.includes(role));
    if (!hasRole) {
      res.status(403).json({ success: false, error: 'FORBIDDEN' });
      return;
    }
    next();
  };

export function requireEmailVerified(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'UNAUTHORIZED' });
  }
  if (!req.user.isEmailVerified) {
    return res.status(403).json({ success: false, error: 'EMAIL_NOT_VERIFIED' });
  }
  next();
}
