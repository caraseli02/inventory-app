import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { useApp, useHostStyles } from '@modelcontextprotocol/ext-apps/react';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

interface Product {
  id: string;
  name: string;
  barcode?: string;
  category?: string;
  price?: number;
  supplier?: string;
  minStock?: number;
  currentStock: number;
}

interface ToolData {
  tool: string;
  products: Product[];
  query?: string;
}

function parseResult(result: CallToolResult): ToolData | null {
  try {
    const block = result.content.find((b) => b.type === 'text');
    if (!block || block.type !== 'text') return null;
    return JSON.parse(block.text) as ToolData;
  } catch {
    return null;
  }
}

function StockBadge({ stock, min }: { stock: number; min?: number }) {
  const isLow = min != null && stock <= min;
  const bg = stock === 0 ? '#fee2e2' : isLow ? '#fef9c3' : '#dcfce7';
  const color = stock === 0 ? '#991b1b' : isLow ? '#854d0e' : '#166534';
  return (
    <span style={{ background: bg, color, padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>
      {stock}
    </span>
  );
}

function ProductsTable({ products }: { products: Product[] }) {
  if (products.length === 0) {
    return <p style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-secondary, #666)' }}>No products found.</p>;
  }
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <thead>
          <tr style={{ background: 'var(--color-background-secondary, #f5f5f5)', borderBottom: '1px solid var(--color-border-primary, #e5e5e5)' }}>
            {['Name', 'Category', 'Stock', 'Price', 'Supplier'].map((h) => (
              <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {products.map((p, i) => (
            <tr key={p.id} style={{ borderBottom: '1px solid var(--color-border-primary, #e5e5e5)', background: i % 2 ? 'var(--color-background-secondary, #f9f9f9)' : 'transparent' }}>
              <td style={{ padding: '8px 12px', fontWeight: 500 }}>{p.name}</td>
              <td style={{ padding: '8px 12px', color: 'var(--color-text-secondary, #666)' }}>{p.category ?? '—'}</td>
              <td style={{ padding: '8px 12px' }}><StockBadge stock={p.currentStock} min={p.minStock} /></td>
              <td style={{ padding: '8px 12px' }}>{p.price != null ? `€${p.price.toFixed(2)}` : '—'}</td>
              <td style={{ padding: '8px 12px', color: 'var(--color-text-secondary, #666)' }}>{p.supplier ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ProductCard({ p }: { p: Product }) {
  return (
    <div style={{ border: '1px solid var(--color-border-primary, #e5e5e5)', borderRadius: 8, padding: '12px 16px', marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 15 }}>{p.name}</div>
          {p.barcode && <div style={{ fontSize: 12, color: 'var(--color-text-secondary, #666)', marginTop: 2 }}>Barcode: {p.barcode}</div>}
          {p.category && <div style={{ fontSize: 12, color: 'var(--color-text-secondary, #666)' }}>Category: {p.category}</div>}
          {p.supplier && <div style={{ fontSize: 12, color: 'var(--color-text-secondary, #666)' }}>Supplier: {p.supplier}</div>}
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <StockBadge stock={p.currentStock} min={p.minStock} />
          {p.price != null && <div style={{ fontSize: 14, fontWeight: 500, marginTop: 4 }}>€{p.price.toFixed(2)}</div>}
        </div>
      </div>
    </div>
  );
}

function App() {
  const [data, setData] = useState<ToolData | null>(null);
  const [loading, setLoading] = useState(false);

  const { app, isConnected, error } = useApp({
    appInfo: { name: 'Inventory App', version: '1.0.0' },
    capabilities: {},
    onAppCreated: (a) => {
      a.ontoolinput = () => { setLoading(true); setData(null); };
      a.ontoolresult = (result) => {
        setLoading(false);
        setData(parseResult(result));
      };
      a.ontoolcancelled = () => { setLoading(false); };
    },
  });

  useHostStyles(app, app?.getHostContext());

  if (error) {
    return <div style={{ padding: 24, color: '#991b1b' }}>Connection error: {error.message}</div>;
  }

  if (!isConnected || loading) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-secondary, #888)' }}>
        {loading ? 'Loading...' : 'Connecting...'}
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-secondary, #888)' }}>
        Ready. Ask Claude to list products or find a product by name.
      </div>
    );
  }

  return (
    <div style={{ padding: 8 }}>
      {data.query && (
        <div style={{ padding: '8px 12px', marginBottom: 8, fontSize: 13, color: 'var(--color-text-secondary, #666)' }}>
          Results for "<strong>{data.query}</strong>" — {data.products.length} product(s)
        </div>
      )}
      {!data.query && (
        <div style={{ padding: '8px 12px', marginBottom: 8, fontSize: 13, color: 'var(--color-text-secondary, #666)' }}>
          {data.products.length} product(s) in inventory
        </div>
      )}
      {data.tool === 'list_all_products' ? (
        <ProductsTable products={data.products} />
      ) : (
        <div style={{ padding: '0 4px' }}>
          {data.products.length === 0
            ? <p style={{ color: 'var(--color-text-secondary, #666)' }}>No products match that search.</p>
            : data.products.map((p) => <ProductCard key={p.id} p={p} />)
          }
        </div>
      )}
    </div>
  );
}

const root = document.getElementById('root')!;
createRoot(root).render(<App />);
