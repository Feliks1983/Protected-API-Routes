import bcrypt from 'bcryptjs';
import { User } from '../models/User';
import { generateSecureToken, sendVerificationEmail } from '../utils/emailService';

const SALT_ROUNDS = 12;

export interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  fieldErrors?: string[];
}

export const registrationService = {
  async registerUser(userData: any) {
    try {
      const { email, username, password, profile, roles } = userData;
      const normalizedEmail = email?.toLowerCase().trim();

      const existingEmail = await User.findOne({ email: normalizedEmail });
      if (existingEmail) return { success: false, error: 'User with this email already exists' };

      const existingUsername = await User.findOne({ username });
      if (existingUsername) return { success: false, error: 'Username is already taken' };

      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
      const { token, expires } = generateSecureToken();

      const newUser = new User({
        email: normalizedEmail,
        username,
        passwordHash,
        profile,
        roles: roles && roles.length > 0 ? roles : ['user'],
        verificationToken: token,
        verificationTokenExpires: expires,
      });

      await newUser.save();
      await sendVerificationEmail(newUser.email, token);

      return {
        success: true,
        data: {
          id: newUser._id,
          email: newUser.email,
          username: newUser.username,
          roles: newUser.roles,
          isEmailVerified: newUser.isEmailVerified,
          profile: newUser.profile,
        },
      };
    } catch (error: any) {
      return { success: false, error: error.message || 'Registration failed' };
    }
  },

  async verifyEmail(token: string) {
    try {
      const user = await User.findOne({
        verificationToken: token,
        verificationTokenExpires: { $gt: new Date() },
      });

      if (!user) {
        return {
          success: false,
          error: 'Invalid or expired verification token',
        };
      }

      user.isEmailVerified = true;
      user.verificationToken = undefined;
      user.verificationTokenExpires = undefined;
      await user.save();

      return { success: true, message: 'Email verified successfully' };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  async resendVerification(email: string) {
    try {
      const normalizedEmail = email?.toLowerCase().trim();
      const user = await User.findOne({ email: normalizedEmail });

      if (!user) {
        return { success: false, error: 'User not found' };
      }

      if (user.isEmailVerified) {
        return { success: false, error: 'Email is already verified' };
      }

      const { token, expires } = generateSecureToken();
      user.verificationToken = token;
      user.verificationTokenExpires = expires;
      await user.save();

      await sendVerificationEmail(user.email, token);
      return { success: true, message: 'Verification email resent' };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },
};
