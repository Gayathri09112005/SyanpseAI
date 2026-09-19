import { Conversation } from '../models/Conversation.js';
import { AiRun } from '../models/AiRun.js';
import { notFound } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/** Every query is scoped by req.user._id — ownership is never taken from the client. */
const owned = (req) => ({ _id: req.params.id, userId: req.user._id });

export const list = asyncHandler(async (req, res) => {
  const { page, limit, q } = req.valid.query;
  const filter = { userId: req.user._id };
  // A RegExp instance, not a $regex POJO: mongoose's sanitizeFilter would rewrite the latter to $eq.
  if (q) filter.title = new RegExp(escapeRegex(q), 'i');

  const [items, total] = await Promise.all([
    Conversation.find(filter).sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit).select('-messages'),
    Conversation.countDocuments(filter),
  ]);
  res.json({ items, page, limit, total, hasMore: page * limit < total });
});

export const create = asyncHandler(async (req, res) => {
  const conversation = await Conversation.create({
    userId: req.user._id,
    title: req.valid.body.title || 'New conversation',
  });
  res.status(201).json({ conversation });
});

export const get = asyncHandler(async (req, res) => {
  const conversation = await Conversation.findOne(owned(req));
  if (!conversation) throw notFound('Conversation');
  const runs = await AiRun.find({ conversationId: conversation._id, userId: req.user._id }).sort({ createdAt: 1 });
  res.json({ conversation, runs });
});

export const update = asyncHandler(async (req, res) => {
  const conversation = await Conversation.findOneAndUpdate(owned(req), { title: req.valid.body.title }, { new: true });
  if (!conversation) throw notFound('Conversation');
  res.json({ conversation });
});

export const remove = asyncHandler(async (req, res) => {
  const conversation = await Conversation.findOneAndDelete(owned(req));
  if (!conversation) throw notFound('Conversation');
  await AiRun.deleteMany({ conversationId: conversation._id, userId: req.user._id });
  res.status(204).end();
});

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
