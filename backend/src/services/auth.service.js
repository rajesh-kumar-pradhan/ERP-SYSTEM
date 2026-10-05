import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/app-error.js';
import { audit } from './audit.service.js';

export async function login({ email, password }) {
  const user = await prisma.user.findUnique({ where: { email } });
  const valid = user && await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw new AppError('Invalid email or password', 401, 'UNAUTHORIZED');
  const token = jwt.sign({ role: user.role }, env.jwtSecret, { subject: user.id, expiresIn: env.jwtExpiresIn });
  await audit(prisma, { userId: user.id, action: 'LOGIN', entityType: 'USER', entityId: user.id, metadata: { email: user.email } });
  return { token, user: { id: user.id, name: user.name, email: user.email, role: user.role } };
}

