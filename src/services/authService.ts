import bcrypt from 'bcryptjs';
import { IUser, RefreshToken, User } from '../models/User';
import { ServiceResult } from './registrationService';
import { signToken } from '../utils/emailService';

const MAX_FAILED_LOGIN_ATTEMPTS = 100;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

const ACCESS_TTL_SEC = 15 * 60;
const REFRESH_TTL_SEC = 7 * 24 * 60 * 60;


export const authService = {
  async attemptLogin(emailOrUsername: string, passwordHash: string): Promise<ServiceResult<IUser>> {
    const idEmail = (emailOrUsername || '').trim().toLowerCase();
    const user = await User.findOne({
      $or: [{ email: idEmail }, { username: idEmail }],
    }).select('+passwordHash +roles');

    if (!user) {
      return {
        success: false,
        error: 'Invalid emailOrUsername or passwordHash.',
      };
    }

    if (user.lockUntil && user.lockUntil.getTime() > Date.now()) {
      const minutesLeft = Math.ceil((user.lockUntil.getTime() - Date.now()) / 60000);
      return {
        success: false,
        error: `Account locked. Try again in ${minutesLeft} minute(s).`,
      };
    }

    const passwordMatches = await bcrypt.compare(passwordHash, user.passwordHash);
    if (!passwordMatches) {
      user.loginAttempts += 1;
      if (user.loginAttempts >= MAX_FAILED_LOGIN_ATTEMPTS) {
        user.lockUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
        user.loginAttempts = 0;
      }
      await user.save();
      return { success: false, error: 'Invalid email or password.' };
    }

    if (!user.isEmailVerified) {
      return {
        success: false,
        error: 'Please verify your email before logging in.',
      };
    }

    user.loginAttempts = 0;
    user.lockUntil = undefined;
    await user.save();
    return { success: true, data: user };
  },
};
export async function generateTokens(user: IUser) {
  const sub = String(user.id ?? user._id);
  const access = signToken(
    { sub, type: 'access', roles: user.roles, isEmailVerified: user.isEmailVerified },
    ACCESS_TTL_SEC
  );
  const refresh = signToken(
    { sub, type: 'refresh', roles: user.roles, isEmailVerified: user.isEmailVerified },
    REFRESH_TTL_SEC
  );
  await RefreshToken.create({
    jti: refresh.payload.jti,
    userId: user._id,
    expiresAt: new Date(refresh.payload.exp * 1000),
  });
  return { accessToken: access.token, refreshToken: refresh.token };
}
