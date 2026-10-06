import { describe, expect, it } from 'vitest';
import { assertTransition } from '../src/services/state-machine.service.js';

describe('explicit state transitions', () => {
  it('allows only documented quotation transitions', () => {
    expect(() => assertTransition('quotation', 'DRAFT', 'SENT')).not.toThrow();
    expect(() => assertTransition('quotation', 'DRAFT', 'ACCEPTED')).toThrow(/Cannot change/);
    expect(() => assertTransition('quotation', 'REJECTED', 'SENT')).toThrow(/Cannot change/);
  });

  it('allows enquiries to move from NEW to QUOTED/LOST, then keeps terminal outcomes closed', () => {
    expect(() => assertTransition('enquiry', 'NEW', 'QUOTED')).not.toThrow();
    expect(() => assertTransition('enquiry', 'NEW', 'LOST')).not.toThrow();
    expect(() => assertTransition('enquiry', 'QUOTED', 'LOST')).not.toThrow();
    expect(() => assertTransition('enquiry', 'LOST', 'QUOTED')).toThrow(/Cannot change/);
    expect(() => assertTransition('enquiry', 'WON', 'LOST')).toThrow(/Cannot change/);
  });

  it('allows cancellation before or after reservation, but not after dispatch', () => {
    expect(() => assertTransition('salesOrder', 'PENDING', 'CANCELLED')).not.toThrow();
    expect(() => assertTransition('salesOrder', 'CONFIRMED', 'CANCELLED')).not.toThrow();
    expect(() => assertTransition('salesOrder', 'DISPATCHED', 'CANCELLED')).toThrow(/Cannot change/);
  });
});

