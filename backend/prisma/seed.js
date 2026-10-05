import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const products = [
  { productCode: 'IHP-250', name: 'Industrial Hydraulic Pump 250 Bar', category: 'Hydraulics', unit: 'Nos', basePrice: '48500.00', quantity: 36 },
  { productCode: 'PCV-050', name: 'Pneumatic Control Valve 1/2 inch', category: 'Pneumatics', unit: 'Nos', basePrice: '7350.00', quantity: 120 },
  { productCode: 'SSP-304-6', name: 'Stainless Steel Pipe 304, 6m', category: 'Piping', unit: 'Length', basePrice: '2650.00', quantity: 250 },
  { productCode: 'IGB-30', name: 'Industrial Helical Gearbox 30:1', category: 'Power Transmission', unit: 'Nos', basePrice: '32900.00', quantity: 22 },
  { productCode: 'PS-16B', name: 'Pressure Sensor 16 Bar', category: 'Instrumentation', unit: 'Nos', basePrice: '5900.00', quantity: 80 },
  { productCode: 'EM-5HP', name: 'TEFC Electric Motor 5 HP', category: 'Motors', unit: 'Nos', basePrice: '21800.00', quantity: 48 },
];

async function seed() {
  const passwordHash = await bcrypt.hash('IndustrialFlow@123', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@industrialflow.local' },
    update: { name: 'Aarav Admin', role: 'ADMIN', passwordHash },
    create: { name: 'Aarav Admin', email: 'admin@industrialflow.local', passwordHash, role: 'ADMIN' },
  });
  const sales = await prisma.user.upsert({
    where: { email: 'sales@industrialflow.local' },
    update: { name: 'Meera Sales', role: 'SALES_USER', passwordHash },
    create: { name: 'Meera Sales', email: 'sales@industrialflow.local', passwordHash, role: 'SALES_USER' },
  });

  for (const item of products) {
    const product = await prisma.product.upsert({
      where: { productCode: item.productCode },
      update: { name: item.name, category: item.category, unit: item.unit, basePrice: item.basePrice },
      create: { productCode: item.productCode, name: item.name, category: item.category, unit: item.unit, basePrice: item.basePrice },
    });
    const inventory = await prisma.inventory.findUnique({ where: { productId: product.id } });
    if (!inventory) {
      const created = await prisma.inventory.create({ data: { productId: product.id, physicalQuantity: item.quantity, reservedQuantity: 0 } });
      await prisma.inventoryMovement.create({ data: { productId: product.id, type: 'STOCK_RECEIPT', quantity: item.quantity, referenceType: 'SEED', referenceId: created.id, createdById: admin.id } });
    }
  }

  const customerRows = [
    { companyName: 'Vardhan Process Equipment Pvt Ltd', contactPerson: 'Rohan Shah', mobile: '+91 98765 20101', email: 'rohan@vardhan.example', city: 'Pune' },
    { companyName: 'NexForge Components Ltd', contactPerson: 'Priya Nair', mobile: '+91 98765 20102', email: 'priya@nexforge.example', city: 'Chennai' },
    { companyName: 'Apex Food Systems', contactPerson: 'Vikram Iyer', mobile: '+91 98765 20103', email: 'vikram@apexfood.example', city: 'Bengaluru' },
  ];
  for (const data of customerRows) {
    const existing = await prisma.customer.findFirst({ where: { email: data.email } });
    if (!existing) await prisma.customer.create({ data });
  }

  const customer = await prisma.customer.findFirst({ where: { email: 'rohan@vardhan.example' } });
  const pump = await prisma.product.findUnique({ where: { productCode: 'IHP-250' } });
  const valve = await prisma.product.findUnique({ where: { productCode: 'PCV-050' } });
  const enquiry = await prisma.enquiry.upsert({
    where: { enquiryNumber: 'ENQ-DEMO-001' },
    update: {},
    create: {
      enquiryNumber: 'ENQ-DEMO-001', customerId: customer.id, requiredDate: new Date('2026-11-15'),
      notes: 'Demo enquiry for a new utility-line installation.', createdById: sales.id,
      items: { create: [{ productId: pump.id, quantity: 2 }, { productId: valve.id, quantity: 12 }] },
    },
  });
  await prisma.quotation.upsert({
    where: { quotationNumber: 'QT-DEMO-001' },
    update: {},
    create: {
      quotationNumber: 'QT-DEMO-001', enquiryId: enquiry.id, customerId: customer.id,
      validUntil: new Date('2026-11-01'), subtotal: '185200.00', discountAmount: '9260.00',
      gstAmount: '31669.20', grandTotal: '207609.20', createdById: sales.id,
      items: { create: [
        { productId: pump.id, quantity: 2, unitPrice: '48500.00', discountPercent: '5.00', gstPercent: '18.00', baseAmount: '97000.00', discountAmount: '4850.00', taxableAmount: '92150.00', gstAmount: '16587.00', lineAmount: '108737.00' },
        { productId: valve.id, quantity: 12, unitPrice: '7350.00', discountPercent: '5.00', gstPercent: '18.00', baseAmount: '88200.00', discountAmount: '4410.00', taxableAmount: '83790.00', gstAmount: '15082.20', lineAmount: '98872.20' },
      ] },
    },
  });
  console.log('Seed complete: 2 users, 6 products/inventory records, 3 customers, and a draft demo quotation.');
}

seed().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());

