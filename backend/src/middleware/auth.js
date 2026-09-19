import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { unauthorized } from '../utils/AppError.js';

export const COOKIE_NAME = 'synapse_session';

export const cookieOptions = () => ({
  httpOnly: true,
  secure: env.isProd,
  sameSite: env.isProd ? 'none' : 'lax',
  domain: env.cookieDomain,
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000,
});

/** remember=false issues a browser-session cookie (no Max-Age); the JWT itself still expires in 7 days. */
export function issueSession(res, user, { remember = true } = {}) {
  const token = jwt.sign({ sub: String(user._id), tv: user.tokenVersion }, env.jwtSecret, { expiresIn: '7d' });
  const options = cookieOptions();
  if (!remember) delete options.maxAge;
  res.cookie(COOKIE_NAME, token, options);
}

export function clearSession(res) {
  res.clearCookie(COOKIE_NAME, { ...cookieOptions(), maxAge: undefined });
}

/** Identity comes only from the signed cookie — never from a client-supplied id. */
export async function requireAuth(req, _res, next) {
  try {
    const token = req.cookies?.[COOKIE_NAME];
    if (!token) throw unauthorized();
    const payload = jwt.verify(token, env.jwtSecret);
    const user = await User.findById(payload.sub);
    if (!user || user.tokenVersion !== payload.tv) throw unauthorized();
    req.user = user;
    next();
  } catch (err) {
    next(err?.status ? err : unauthorized());
  }
}
