import { Prisma } from '@prisma/client';
import { AppError } from '../utils/app-error.js';

const { Decimal } = Prisma;
const ROUNDING = Decimal.ROUND_HALF_UP;
const money = (value) => new Decimal(value).toDecimalPlaces(2, ROUNDING);
const percent = (value) => new Decimal(value);

/**
 * Money stays Decimal from request interpretation through Prisma persistence.
 * Rounding each stored line to two rupees/paise decimals makes a historic
 * invoice reconstructable and avoids JavaScript binary floating-point drift.
 */
export function calculateQuotation(items) {
  if (!items?.length) throw new AppError('At least one quotation item is required', 422, 'VALIDATION_ERROR');

  const seenProducts = new Set();
  const calculatedItems = items.map((item) => {
    if (seenProducts.has(item.productId)) {
      throw new AppError('A product may appear only once in a quotation', 422, 'VALIDATION_ERROR');
    }
    seenProducts.add(item.productId);

    const unitPrice = money(item.unitPrice);
    const discountPercent = percent(item.discountPercent ?? 0);
    const gstPercent = percent(item.gstPercent ?? 18);
    if (unitPrice.isNegative() || discountPercent.isNegative() || discountPercent.gt(100) || gstPercent.isNegative() || gstPercent.gt(100)) {
      throw new AppError('Invalid price or percentage', 422, 'VALIDATION_ERROR');
    }
    const baseAmount = unitPrice.mul(item.quantity).toDecimalPlaces(2, ROUNDING);
    const discountAmount = baseAmount.mul(discountPercent).div(100).toDecimalPlaces(2, ROUNDING);
    const taxableAmount = baseAmount.minus(discountAmount).toDecimalPlaces(2, ROUNDING);
    const gstAmount = taxableAmount.mul(gstPercent).div(100).toDecimalPlaces(2, ROUNDING);
    const lineAmount = taxableAmount.plus(gstAmount).toDecimalPlaces(2, ROUNDING);
    return { ...item, unitPrice, discountPercent, gstPercent, baseAmount, discountAmount, taxableAmount, gstAmount, lineAmount };
  });

  const sum = (field) => calculatedItems.reduce((total, item) => total.plus(item[field]), new Decimal(0)).toDecimalPlaces(2, ROUNDING);
  return {
    items: calculatedItems,
    subtotal: sum('baseAmount'),
    discountAmount: sum('discountAmount'),
    gstAmount: sum('gstAmount'),
    grandTotal: sum('lineAmount'),
  };
}

