import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const preferencesSchema = new mongoose.Schema(
  {
    theme: { type: String, enum: ['dark', 'light', 'system'], default: 'dark' },
    answerStyle: { type: String, enum: ['concise', 'balanced', 'detailed'], default: 'balanced' },
    reasoningDepth: { type: String, enum: ['fast', 'light', 'standard', 'thorough', 'exhaustive'], default: 'standard' },
    domain: {
      type: String,
      enum: ['auto', 'general', 'coding', 'education', 'research', 'technical'],
      default: 'auto',
    },
    evidenceRetrieval: { type: Boolean, default: false },
    minRefinementIterations: { type: Number, min: 0, max: 8, default: 0 },
    maxRefinementIterations: { type: Number, min: 0, max: 8, default: 2 },
    storeAgentTranscripts: { type: Boolean, default: true },
    streamPartialAnswers: { type: Boolean, default: false },
    reducedMotion: { type: Boolean, default: false },
  },
  { _id: false },
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 1, maxlength: 80 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^@\s]+@[^@\s]+\.[^@\s]+$/, 'Invalid email address'],
    },
    passwordHash: { type: String, required: true, select: false },
    preferences: { type: preferencesSchema, default: () => ({}) },
    tokenVersion: { type: Number, default: 0 },
  },
  { timestamps: true },
);

userSchema.methods.verifyPassword = function verifyPassword(plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

userSchema.statics.hashPassword = (plain) => bcrypt.hash(plain, 12);

userSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.passwordHash;
    delete ret.tokenVersion;
    delete ret.__v;
    ret.id = ret._id;
    delete ret._id;
    return ret;
  },
});

export const User = mongoose.model('User', userSchema);
