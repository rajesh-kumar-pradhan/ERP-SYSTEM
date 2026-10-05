import { listAuditLogs } from '../services/audit-read.service.js';
import { serialize } from '../utils/serializers.js';

export async function list(_req, res) {
  res.json({ success: true, data: serialize(await listAuditLogs()) });
}

