// Database unique constraints are the final guard. Timestamp + random entropy keeps
// normal document creation readable without relying on a fragile client-side counter.
export function businessNumber(prefix) {
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  const entropy = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${stamp}-${entropy}`;
}

