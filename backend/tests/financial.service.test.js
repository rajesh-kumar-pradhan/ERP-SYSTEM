import { describe, expect, it } from 'vitest';
import { calculateQuotation } from '../src/services/financial.service.js';

describe('quotation financial calculation', () => {
  it('calculates discount, GST, and grand total using decimal rounding', () => {
    const result = calculateQuotation([
      { productId: 'pump', quantity: 2, unitPrice: '48500.00', discountPercent: '5', gstPercent: '18' },
      { productId: 'valve', quantity: 12, unitPrice: '7350.00', discountPercent: '5', gstPercent: '18' },
    ]);
    expect(result.subtotal.toFixed(2)).toBe('185200.00');
    expect(result.discountAmount.toFixed(2)).toBe('9260.00');
    expect(result.gstAmount.toFixed(2)).toBe('31669.20');
    expect(result.grandTotal.toFixed(2)).toBe('207609.20');
    expect(result.items[0].lineAmount.toFixed(2)).toBe('108737.00');
  });
});

