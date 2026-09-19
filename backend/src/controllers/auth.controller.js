import { User } from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { issueSession, clearSession } from '../middleware/auth.js';
import { Conversation } from '../models/Conversation.js';
import { AiRun } from '../models/AiRun.js';

export const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.valid.body;
  if (await User.exists({ email })) throw new AppError(409, 'An account with that email already exists', 'email_taken');
  const user = await User.create({ name, email, passwordHash: await User.hashPassword(password) });
  issueSession(res, user);
  res.status(201).json({ user: user.toJSON() });
});

export const login = asyncHandler(async (req, res) => {
  const { email, password, remember } = req.valid.body;
  const user = await User.findOne({ email }).select('+passwordHash');
  // Same response for unknown email and wrong password.
  if (!user || !(await user.verifyPassword(password))) {
    throw new AppError(401, 'Incorrect email or password', 'invalid_credentials');
  }
  issueSession(res, user, { remember });
  res.json({ user: user.toJSON() });
});

export const logout = asyncHandler(async (_req, res) => {
  clearSession(res);
  res.status(204).end();
});

export const me = asyncHandler(async (req, res) => res.json({ user: req.user.toJSON() }));

export const updatePreferences = asyncHandler(async (req, res) => {
  Object.assign(req.user.preferences, req.valid.body);
  await req.user.save();
  res.json({ user: req.user.toJSON() });
});

export const deleteAccount = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  await Promise.all([
    AiRun.deleteMany({ userId }),
    Conversation.deleteMany({ userId }),
    User.deleteOne({ _id: userId }),
  ]);
  clearSession(res);
  res.status(204).end();
});
