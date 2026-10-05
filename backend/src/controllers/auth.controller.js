import * as authService from '../services/auth.service.js';
import { serialize } from '../utils/serializers.js';

export async function login(req, res) {
  const data = await authService.login(req.validatedBody);
  res.json({ success: true, data: serialize(data) });
}

export function me(req, res) {
  res.json({ success: true, data: req.user });
}

