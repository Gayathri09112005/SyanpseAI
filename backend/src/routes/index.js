import { Router } from 'express';
import * as auth from '../controllers/auth.controller.js';
import * as conversations from '../controllers/conversations.controller.js';
import * as answers from '../controllers/answers.controller.js';
import * as system from '../controllers/system.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { authLimiter, runLimiter } from '../middleware/rateLimit.js';
import * as s from '../validators/schemas.js';

export const router = Router();

router.get('/health', system.health);
router.get('/ready', system.ready);
router.get('/providers/status', system.providers);

router.post('/auth/register', authLimiter, validate(s.registerSchema), auth.register);
router.post('/auth/login', authLimiter, validate(s.loginSchema), auth.login);
router.post('/auth/logout', auth.logout);
router.get('/auth/me', requireAuth, auth.me);
router.patch('/auth/preferences', requireAuth, validate(s.preferencesSchema), auth.updatePreferences);
router.delete('/auth/account', requireAuth, auth.deleteAccount);

router.use('/conversations', requireAuth);
router.get('/conversations', validate(s.paginationSchema, 'query'), conversations.list);
router.post('/conversations', validate(s.createConversationSchema), conversations.create);
router.get('/conversations/:id', conversations.get);
router.patch('/conversations/:id', validate(s.updateConversationSchema), conversations.update);
router.delete('/conversations/:id', conversations.remove);

router.use('/answers', requireAuth);
router.post('/answers', runLimiter, validate(s.createAnswerSchema), answers.create);
router.get('/answers/:id', answers.get);
router.get('/answers/:id/stream', answers.stream);
router.post('/answers/:id/follow-up', runLimiter, validate(s.followUpSchema), answers.followUp);
router.post('/answers/:id/regenerate', runLimiter, answers.regenerate);
router.post('/answers/:id/cancel', answers.cancel);
