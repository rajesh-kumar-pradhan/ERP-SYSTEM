export function audit(tx, { userId, action, entityType, entityId, metadata }) {
  return tx.auditLog.create({
    data: { userId, action, entityType, entityId, metadata },
  });
}

