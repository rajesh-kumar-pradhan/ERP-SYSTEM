import { useEffect, useState } from 'react';

export default function ItemEditor({ products, value, onChange, quotation = false }) {
  const [items, setItems] = useState(value?.length ? value : [{ productId: '', quantity: 1, unitPrice: '', discountPercent: 0, gstPercent: 18 }]);
  useEffect(() => onChange(items), [items]);
  const edit = (index, field, val) => {
    const next = items.map((item, i) => i === index ? { ...item, [field]: val } : item);
    if (field === 'productId' && quotation) {
      const product = products.find((item) => item.id === val);
      next[index].unitPrice = product?.basePrice || '';
    }
    setItems(next);
  };
  return <div className="item-editor">
    {items.map((item, index) => <div className="item-row" key={index}>
      <select value={item.productId} onChange={(e) => edit(index, 'productId', e.target.value)} required><option value="">Product</option>{products.map((product) => <option key={product.id} value={product.id}>{product.productCode} — {product.name}</option>)}</select>
      <input type="number" min="1" value={item.quantity} onChange={(e) => edit(index, 'quantity', e.target.value)} aria-label="Quantity" required />
      {quotation && <><input type="number" min="0" step="0.01" value={item.unitPrice} onChange={(e) => edit(index, 'unitPrice', e.target.value)} aria-label="Unit price" required /><input type="number" min="0" max="100" step="0.01" value={item.discountPercent} onChange={(e) => edit(index, 'discountPercent', e.target.value)} aria-label="Discount percent" /><input type="number" min="0" max="100" step="0.01" value={item.gstPercent} onChange={(e) => edit(index, 'gstPercent', e.target.value)} aria-label="GST percent" /></>}
      {items.length > 1 && <button type="button" className="icon-button" onClick={() => setItems(items.filter((_, i) => i !== index))} aria-label="Remove item">×</button>}
    </div>)}
    <button type="button" className="secondary-button" onClick={() => setItems([...items, { productId: '', quantity: 1, unitPrice: '', discountPercent: 0, gstPercent: 18 }])}>+ Add product</button>
  </div>;
}

