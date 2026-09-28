import mongoose, { Document, ObjectId, Schema, model } from 'mongoose';
import bcrypt from 'bcryptjs';
import { Role, TokenType } from '../utils/emailService';

export interface Profile {
  firstName: string;
  lastName: string;
  bio?: string;
}

export interface IUser extends Document {
  id: ObjectId;
  email: string;
  passwordHash: string;
  username: string;
  roles: Role[];
  isEmailVerified: boolean;
  verificationToken?: string;
  verificationTokenExpires?: Date;
  profile: Profile;
  createdAt: Date;
  updatedAt?: Date;
  loginAttempts: number;
  lockUntil?: Date | null;
}

export interface JwtProps {
  sub: string;
  iat: number;
  exp: number;
  type: TokenType;
  roles: Role[];
  jti: string;
}

export interface PublicUser {
  id: ObjectId;
  email: string;
  username: string;
  profile: Profile;
  isEmailVerified: boolean;
  createdAt: Date;
}

export function toPublicUser(user: IUser): PublicUser {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    profile: user.profile,
    isEmailVerified: user.isEmailVerified,
    createdAt: user.createdAt,
  };
}

export interface IUserStore {
  findByEmail(email: string): Promise<IUser | undefined>;
  findByUsername(username: string): Promise<IUser | undefined>;
  findById(id: string): Promise<IUser | undefined>;
  findByVerificationToken(token: string): Promise<IUser | undefined>;
  create(user: IUser): Promise<IUser>;
  update(id: string, patch: Partial<IUser>): Promise<IUser | undefined>;
}

const profileSchema = new mongoose.Schema<Profile>(
  {
    firstName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },
    bio: {
      type: String,
      trim: true,
      maxlength: 280,
      default: '',
    },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema<IUser>(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    roles: { type: [String], enum: ['user', 'admin'], default: ['user'] },
    isEmailVerified: { type: Boolean, default: false },
    verificationToken: { type: String },
    verificationTokenExpires: { type: Date },
    profile: {
      type: profileSchema,
      required: true,
    },
    createdAt: { type: Date },
    updatedAt: { type: Date },
    loginAttempts: { type: Number, required: true, default: 0 },
    lockUntil: { type: Date },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: any) => {
        if (ret._id) {
          ret.id = ret._id.toString();
        }
        delete ret._id;
        delete ret.__v;
        delete ret.passwordHash;
        delete ret.password;
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
);

userSchema.pre<IUser>('save', async function () {
  if (!this.isModified('password')) return;
  const salt = await bcrypt.genSalt(10);
  this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
});

userSchema.index({ 'profile.firstName': 1, 'profile.lastName': 1 });
userSchema.index({
  username: 'text',
  'profile.firstName': 'text',
  'profile.lastName': 'text',
});

export const User = mongoose.model<IUser>('User', userSchema);

const refreshSchema = new Schema({
  jti: { type: String, required: true, unique: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  revoked: { type: Boolean, default: false, index: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
});
export const RefreshToken = model('RefreshToken', refreshSchema);

const revokedSchema = new Schema({
  jti: { type: String, required: true, unique: true, index: true },
  expiresAt: { type: Date, required: true },
});
revokedSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RevokedAccess = model('RevokedAccess', revokedSchema);
export const isTokenRevoked = (jti: string) =>
  RevokedAccess.exists({ jti, expiresAt: { $gt: new Date() } });
