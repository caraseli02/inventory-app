import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Package, Clock, Grid3X3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getAllProducts } from '@/lib/api';
import { useRecentProducts } from '@/hooks/useRecentProducts';
import type { Product } from '@/types';

// Category definitions with icons and subtle indicator dots
// Using neutral base with ONE accent color (forest green) for selections
const CATEGORIES = [
  { id: 'all', icon: Grid3X3, dot: 'bg-zinc-400' },
  { id: 'recent', icon: Clock, dot: 'bg-zinc-400' },
  { id: 'Produce', icon: null, dot: 'bg-emerald-500' },
  { id: 'Dairy', icon: null, dot: 'bg-sky-400' },
  { id: 'Meat', icon: null, dot: 'bg-rose-400' },
  { id: 'Pantry', icon: null, dot: 'bg-amber-500' },
  { id: 'Snacks', icon: null, dot: 'bg-orange-400' },
  { id: 'Beverages', icon: null, dot: 'bg-cyan-400' },
  { id: 'Household', icon: null, dot: 'bg-slate-400' },
  { id: 'Conserve', icon: null, dot: 'bg-yellow-500' },
  { id: 'General', icon: null, dot: 'bg-zinc-400' },
] as const;

interface ProductBrowsePanelProps {
  /** Called when a product is tapped */
  onProductSelect: (product: Product) => void;
  /** Maximum height for the panel */
  maxHeight?: string;
}

/**
 * Browse products by category with one-tap addition.
 * Features category tabs and a scrollable product grid.
 * Based on restaurant/retail POS design patterns.
 */
export const ProductBrowsePanel = ({
  onProductSelect,
  maxHeight = '300px',
}: ProductBrowsePanelProps) => {
  const { t } = useTranslation();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const { recentProducts, hasRecentProducts } = useRecentProducts();

  // Fetch all products
  const { data: allProducts, isLoading } = useQuery({
    queryKey: ['products', 'all'],
    queryFn: getAllProducts,
    staleTime: 1000 * 60 * 5,
  });

  // Get unique categories from products
  const availableCategories = useMemo(() => {
    if (!allProducts) return new Set<string>();
    const cats = new Set<string>();
    allProducts.forEach(p => {
      if (p.fields.Category) cats.add(p.fields.Category);
    });
    return cats;
  }, [allProducts]);

  // Filter categories to only show ones that have products
  const visibleCategories = CATEGORIES.filter(cat => {
    if (cat.id === 'all') return true;
    if (cat.id === 'recent') return hasRecentProducts;
    return availableCategories.has(cat.id);
  });

  // Filter products based on selected category
  const filteredProducts = useMemo(() => {
    if (!allProducts) return [];

    if (selectedCategory === 'all') {
      return allProducts;
    }

    if (selectedCategory === 'recent') {
      return recentProducts;
    }

    return allProducts.filter(p => p.fields.Category === selectedCategory);
  }, [allProducts, selectedCategory, recentProducts]);

  // Sort products: in-stock first, then by name
  const sortedProducts = useMemo(() => {
    return [...filteredProducts].sort((a, b) => {
      const aStock = a.fields['Current Stock Level'] ?? 0;
      const bStock = b.fields['Current Stock Level'] ?? 0;
      // In-stock items first
      if (aStock > 0 && bStock <= 0) return -1;
      if (aStock <= 0 && bStock > 0) return 1;
      // Then alphabetically
      return a.fields.Name.localeCompare(b.fields.Name);
    });
  }, [filteredProducts]);

  const getCategoryLabel = (catId: string) => {
    if (catId === 'all') return t('search.allProducts', 'All');
    if (catId === 'recent') return t('search.recentItems', 'Recent');
    return t(`categories.${catId}`, catId);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {/* Category tabs skeleton */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-10 w-24 bg-zinc-100 rounded-lg animate-pulse shrink-0" />
          ))}
        </div>
        {/* Product grid skeleton */}
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-24 bg-zinc-50 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Category Tabs - Horizontally scrollable */}
      <div className="relative">
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {visibleCategories.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            const Icon = cat.icon;
            const productCount = cat.id === 'all'
              ? allProducts?.length ?? 0
              : cat.id === 'recent'
              ? recentProducts.length
              : allProducts?.filter(p => p.fields.Category === cat.id).length ?? 0;

            return (
              <Button
                key={cat.id}
                variant={isSelected ? 'default' : 'ghost'}
                size="sm"
                className={`shrink-0 rounded-lg px-4 h-10 font-medium transition-all duration-150 ${
                  isSelected
                    ? 'bg-zinc-900 text-white hover:bg-zinc-800 shadow-sm'
                    : 'bg-zinc-50 text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900'
                }`}
                onClick={() => setSelectedCategory(cat.id)}
              >
                {/* Subtle category dot */}
                {!Icon && <span className={`w-2 h-2 rounded-full ${cat.dot} mr-2`} />}
                {Icon && <Icon className="h-4 w-4 mr-2" />}
                <span>{getCategoryLabel(cat.id)}</span>
                <span className={`ml-2 text-xs tabular-nums ${isSelected ? 'text-zinc-400' : 'text-zinc-500'}`}>
                  {productCount}
                </span>
              </Button>
            );
          })}
        </div>
      </div>

      {/* Product Grid - Scrollable */}
      <div
        className="overflow-y-auto"
        style={{ maxHeight }}
      >
        {sortedProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-zinc-400">
            <Package className="h-10 w-10 mb-3 opacity-40" />
            <p className="text-base font-medium">{t('search.noCategoryProducts', 'No products in this category')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {sortedProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onSelect={onProductSelect}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// Individual product card component
interface ProductCardProps {
  product: Product;
  onSelect: (product: Product) => void;
}

const ProductCard = ({ product, onSelect }: ProductCardProps) => {
  const { t } = useTranslation();
  const imageUrl = product.fields.Image?.[0]?.url;
  const price = product.fields.Price;
  const stock = product.fields['Current Stock Level'] ?? 0;
  const isOutOfStock = stock <= 0;

  return (
    <button
      className={`
        relative flex flex-col items-center p-3 rounded-lg text-left
        transition-all duration-150
        focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-zinc-900
        ${isOutOfStock
          ? 'bg-zinc-50 opacity-50 cursor-not-allowed'
          : 'bg-white border border-zinc-200 hover:border-zinc-300 hover:shadow-sm active:scale-[0.98] cursor-pointer'
        }
      `}
      onClick={() => !isOutOfStock && onSelect(product)}
      disabled={isOutOfStock}
      title={product.fields.Name}
    >
      {/* Product Image */}
      <div className="w-14 h-14 rounded-md bg-zinc-50 flex items-center justify-center overflow-hidden mb-2">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <Package className="h-6 w-6 text-zinc-300" />
        )}
      </div>

      {/* Product Name - minimum 12px (text-xs) for readability */}
      <p className="text-xs font-medium text-zinc-900 text-center line-clamp-2 leading-snug w-full">
        {product.fields.Name}
      </p>

      {/* Price */}
      {price != null && (
        <p className="text-sm font-semibold text-zinc-900 mt-1">
          €{price.toFixed(2)}
        </p>
      )}

      {/* Low stock indicator - subtle amber dot */}
      {!isOutOfStock && stock <= 5 && (
        <span
          className="absolute top-2 right-2 w-2 h-2 bg-amber-400 rounded-full"
          title={`${stock} in stock`}
        />
      )}

      {/* Out of Stock Overlay */}
      {isOutOfStock && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/90 rounded-lg">
          <span className="text-xs font-medium text-zinc-400">
            {t('search.outOfStock', 'Out')}
          </span>
        </div>
      )}
    </button>
  );
};
