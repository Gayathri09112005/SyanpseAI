import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ['user', 'assistant'], required: true },
    content: { type: String, required: true, maxlength: 60000 },
    runId: { type: mongoose.Schema.Types.ObjectId, ref: 'AiRun' },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

const conversationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 160, default: 'New conversation' },
    messages: { type: [messageSchema], default: [] },
    lastMessageAt: { type: Date, default: Date.now },
    // Short status for the history list, e.g. "verified" or "verifier failed".
    lastRun: { status: String, note: String },
  },
  { timestamps: true },
);

conversationSchema.index({ userId: 1, updatedAt: -1 });
conversationSchema.index({ userId: 1, title: 'text' });

conversationSchema.set('toJSON', {
  transform: (_doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export const Conversation = mongoose.model('Conversation', conversationSchema);
