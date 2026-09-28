import { Router, Request, Response } from 'express';
import { body, query, validationResult } from 'express-validator';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
dotenv.config();
import { registrationService } from '../services/registrationService';
import { JwtProps, RefreshToken, RevokedAccess, User } from '../models/User';
import { signToken, TokenType, verifyToken } from '../utils/emailService';
import { authService, generateTokens } from '../services/authService';

export const router = Router();

const validateUser = [
  body('email').isEmail().normalizeEmail().withMessage('Must be a valid email'),
  body('password')
    .isLength({ min: 8, max: 100 })
    .withMessage('Password must be between 8 and 100 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=(?:.*\d){2,})(?=.*[@$!%*?&])(?!\s)/)
    .withMessage(
      'PasswordHash must contain uppercase, lowercase, at least 2 digits, a special character, and no spaces'
    )
    .custom(value => {
      const forbidden = ['PasswordHash', 'Password123'];
      if (forbidden.includes(value)) {
        throw new Error('PasswordHash is too common');
      }
      return true;
    }),
  body('username')
    .trim()
    .isLength({ min: 2, max: 50 })
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers, and underscores'),
  body('profile.firstName').notEmpty().withMessage('First name is required').trim().escape(),
  body('profile.lastName').notEmpty().withMessage('Last name is required').trim().escape(),
  body('profile.bio').optional().trim().escape(),
];

export const registrationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many registration attempts. Please try again later.',
  },
});

export const resendVerificationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many requests. Please try again later.',
  },
});

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many login attempts. Please try again later.',
  },
});

const ACCESS_TTL_SEC = 15 * 60;


const verify = (token: string, type: TokenType): JwtProps | null => {
  try {
    return verifyToken(token, type);
  } catch {
    return null;
  }
};

router.post('/register', registrationLimiter, validateUser, async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  const result = await registrationService.registerUser(req.body);
  if (!result.success) {
    return res.status(400).json({success: false, data: result});
  }

  res.status(201).json({ success: true, data: result });
});

router.get(
  '/verify-email',
  [query('token').notEmpty().withMessage('Token is required').trim()],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const result = await registrationService.verifyEmail(req.query.token as string);
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.status(200).json(result);
  }
);

router.post(
  '/resend-verification',
  resendVerificationLimiter,
  [body('email').isEmail().withMessage('Invalid email format').normalizeEmail()],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    const result = await registrationService.resendVerification(req.body.email);
    if (!result.success) {
      return res.status(400).json({ success: false, data: result });
    }
    res.status(200).json({ success: true, data: result });
  }
);

router.post('/login', loginLimiter, async (req: Request, res: Response) => {
  try {
    const { emailOrUsername, password } = req.body || {};
    if (!emailOrUsername || !password) {
      return res.status(400).json({ success: false, error: 'emailOrUsername and password are required.' });
    }

    const result = await authService.attemptLogin(emailOrUsername, password);
    if (!result.success || !result.data) {
      return res.status(401).json({ success: false, data: result });
    }

    const user = result.data;
    const tokens = await generateTokens(user);

    return res.status(200).json({
      success: true,
      ...tokens,
      user: {
        id: user._id.toString(),
        email: user.email,
        username: user.username,
        roles: user.roles,
      },
    });
  } catch (err) {
    console.error('POST /login error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }
});

router.post('/refresh', async (req: Request, res: Response) => {
  const { refreshToken } = req.body || {};
  if (typeof refreshToken !== 'string' || !refreshToken) {
    res.status(400).json({ success: false, error: 'refreshToken is required' });
    return;
  }
  let jwtJti: JwtProps;
  try {
    jwtJti = verifyToken(refreshToken, 'refresh');
  } catch (err) {
    console.error('refresh verify failed:', (err as Error).message);
    return res.status(401).json({ success: false, error: 'Invalid refresh token' });
  }

  const record = await RefreshToken.findOne({
    jti: jwtJti.jti,
    revoked: { $ne: true },
    expiresAt: { $gt: new Date() },
  }).lean();
  if (!record) {
    res.status(401).json({ success: false, error: 'Refresh token revoked or already used' });
    return;
  }
  const user = await User.findById(record.userId);
  if (!user) {
    return res.status(401).json({ success: false, error: 'User not found' });
  }
  const refresh = signToken(
    { sub: String(user._id), type: 'access', roles: user.roles },
    ACCESS_TTL_SEC
  );
  return res.json({ refreshToken: refresh.token });
});

router.post('/logout', async (req: Request, res: Response) => {
  const { refreshToken } = req.body ?? {};
  if (typeof refreshToken !== 'string' || !refreshToken) {
    return res.status(400).json({ success: false, error: 'refreshToken is required' });
  }

  try {
    const refresh = verify(refreshToken, 'refresh');
    if (refresh) {
      await RefreshToken.updateOne({ jti: refresh.jti }, { $set: { revoked: true } });
    }
    const header = req.headers.authorization;
    if (header?.startsWith('Bearer ')) {
      const access = verify(header.slice(7), 'access');
      if (access) {
        await RevokedAccess.updateOne(
          { jti: access.jti },
          { $set: { expiresAt: new Date(access.exp * 1000) } },
          { upsert: true }
        );
      }
    }
    return res.status(204).end();
  } catch (err) {
    console.error('POST /logout error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }
});
