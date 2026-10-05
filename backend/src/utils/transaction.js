import { Prisma } from '@prisma/client';

function isSerializationConflict(error) {
  // Prisma may surface PostgreSQL SQLSTATE 40001 as P2034 or as a raw-query P2010.
  return error?.code === 'P2034' || error?.meta?.code === '40001';
}

/** PostgreSQL serializable transactions can intentionally abort a concurrent
 * contender. Retrying the complete operation gives it a fresh snapshot, after
 * which business validation returns a useful stock/state conflict if needed. */
export async function serializableTransaction(client, callback, options = {}) {
  const attempts = options.attempts || 3;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await client.$transaction(callback, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: options.timeout || 10000,
      });
    } catch (error) {
      if (!isSerializationConflict(error) || attempt === attempts - 1) throw error;
    }
  }
}

