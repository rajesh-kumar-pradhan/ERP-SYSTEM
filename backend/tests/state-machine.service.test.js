import { describe, expect, it } from 'vitest';
import { assertTransition } from '../src/services/state-machine.service.js';

describe('explicit state transitions', () => {
  it('allows only documented quotation transitions', () => {
    expect(() => assertTransition('quotation', 'DRAFT', 'SENT')).not.toThrow();
    expect(() => assertTransition('quotation', 'DRAFT', 'ACCEPTED')).toThrow(/Cannot change/);
    expect(() => assertTransition('quotation', 'REJECTED', 'SENT')).toThrow(/Cannot change/);
  });
});

