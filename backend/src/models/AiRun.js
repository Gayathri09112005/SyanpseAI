import mongoose from 'mongoose';

const { Mixed, ObjectId } = mongoose.Schema.Types;

const agentOutputSchema = new mongoose.Schema(
  {
    status: { type: String, enum: ['pending', 'running', 'completed', 'failed', 'skipped'], default: 'pending' },
    provider: String,
    model: String,
    mode: { type: String, enum: ['live', 'mock'], default: 'live' },
    output: Mixed,
    error: { message: String, code: String, retryable: Boolean },
    startedAt: Date,
    completedAt: Date,
    durationMs: Number,
    usage: { promptTokens: Number, completionTokens: Number, totalTokens: Number },
    costUsd: Number,
  },
  { _id: false },
);

const sourceSchema = new mongoose.Schema(
  { title: String, url: String, snippet: String, provider: String, retrievedAt: Date },
  { _id: false },
);

const settingsSchema = new mongoose.Schema(
  {
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
  },
  { _id: false },
);

const aiRunSchema = new mongoose.Schema(
  {
    userId: { type: ObjectId, ref: 'User', required: true, index: true },
    conversationId: { type: ObjectId, ref: 'Conversation', required: true, index: true },
    parentRunId: { type: ObjectId, ref: 'AiRun' },
    kind: { type: String, enum: ['initial', 'follow-up', 'regenerate'], default: 'initial' },
    question: { type: String, required: true, maxlength: 8000 },
    settings: { type: settingsSchema, default: () => ({}) },

    agents: {
      generator: { type: agentOutputSchema, default: () => ({}) },
      verifier: { type: agentOutputSchema, default: () => ({}) },
      reasoner: { type: agentOutputSchema, default: () => ({}) },
      synthesizer: { type: agentOutputSchema, default: () => ({}) },
    },

    refinementHistory: { type: [Mixed], default: [] },
    finalAnswer: String,
    keyCorrections: { type: [String], default: [] },
    remainingUncertainty: { type: [String], default: [] },
    sources: { type: [sourceSchema], default: [] },

    status: {
      type: String,
      enum: ['queued', 'running', 'completed', 'failed', 'cancelled'],
      default: 'queued',
      index: true,
    },
    error: { message: String, code: String },
    degraded: { type: Boolean, default: false },
    usage: { promptTokens: Number, completionTokens: Number, totalTokens: Number },
    costUsd: Number,
    durationMs: Number,
    completedAt: Date,
  },
  { timestamps: true },
);

aiRunSchema.index({ userId: 1, createdAt: -1 });
aiRunSchema.index({ conversationId: 1, createdAt: 1 });

aiRunSchema.set('toJSON', {
  transform: (_doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export const AiRun = mongoose.model('AiRun', aiRunSchema);
