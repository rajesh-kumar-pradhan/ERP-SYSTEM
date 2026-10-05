import { prisma } from '../lib/prisma.js';

export function listAuditLogs() {
  return prisma.auditLog.findMany({
    include: { user: { select: { name: true, email: true, role: true } } },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
}

