import express, { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
const helmet = require('helmet');
import mongoose from 'mongoose';
import { rateLimit } from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import { router as ApiRegister } from './routes/auth';
import { router as ApiProfile } from './routes/profile';
import { router as ApiAdmin } from './routes/admin';
import { router as ApiProtected } from './routes/protectedTodos';
import { User } from './models/User';
import { authenticateToken } from './middleware/auth';
dotenv.config();

const app = express();
app.use(express.json());

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

app.use((req, res, next) => {
  res.setHeader('X-API-Version', '1.0');
  res.setHeader('X-Powered-By', 'My-Secure-API');
  next();
});

async function seed() {
  const users = [
    {
      id: '1',
      emailOrUsername: 'user@example.com',
      username: 'user',
      password: 'Password123!',
      roles: ['user'] as const,
      firstName: 'Test',
      lastName: 'User',
    },
    {
      id: '2',
      emailOrUsername: 'admin@example.com',
      username: 'admin',
      password: 'Admin123!',
      roles: ['admin'] as const,
      firstName: 'Test',
      lastName: 'Admin',
    },
  ];
  for (const u of users) {
    const existing = await User.findOne({ email: u.emailOrUsername });
    if (existing) {
      let changed = false;
      if (!existing.passwordHash?.startsWith('$2')) {
        existing.passwordHash = await bcrypt.hash(u.password, 10);
        changed = true;
      }
      if (!existing.isEmailVerified) {
        existing.isEmailVerified = true;
        changed = true;
      }
      if (changed) {
        await existing.save();
        console.log(`Repaired ${u.emailOrUsername}`);
      }
      continue;
    }

    await User.create({
      email: u.emailOrUsername,
      username: u.username,
      passwordHash: await bcrypt.hash(u.password, 10),
      isEmailVerified: true,
      roles: [...u.roles],
      profile: { firstName: u.firstName, lastName: u.lastName },
    });
    console.log(`Seeded ${u.emailOrUsername}`);
  }
}

const config = {
  port: Number(process.env.PORT),
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigin: process.env.CORS_ORIGIN,
};

const url = process.env.MONGODB_URI as string;

app.use(
  cors({
    origin: config.corsOrigin || 'http://localhost:5173',
  })
);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  skipSuccessfulRequests: true,
  message: {
    error: 'Too many authentication attempts, please try again later.',
  },
});

app.use('/api/auth', authLimiter, ApiRegister);
app.use('/api/profile', ApiProfile);
app.use('/api/admin', authLimiter, ApiAdmin);
app.use('/api/protected/todos', authenticateToken, ApiProtected);
app.get('/', (req, res) => {
  res.status(200).json({
    message: 'Todo API is running',
  });
});

app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  if (
    error instanceof SyntaxError &&
    'status' in error &&
    error.status === 400 &&
    'body' in error
  ) {
    res.status(400).json({ error: 'Invalid JSON format in request body' });
    return;
  }
  if (res.headersSent) {
    return next(error);
  }
  res.status(500).json({ error: 'Internal server error' });
});

async function start() {
  try {
    await mongoose.connect(url as string);
    await seed();
    app.listen(config.port, () => {
      console.log(`Server started on port ${config.port}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();
