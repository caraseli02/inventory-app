import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Package, Clock, Grid3X3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getAllProducts } from '@/lib/api';
import { useRecentProducts } from '@/hooks/useRecentProducts';
import type { Product } from '@/types';

// Category definitions with icons/colors
const CATEGORIES = [
  { id: 'all', icon: Grid3X3, color: 'bg-stone-500' },
  { id: 'recent', icon: Clock, color: 'bg-purple-500' },
  { id: 'Produce', icon: null, color: 'bg-green-500' },
  { id: 'Dairy', icon: null, color: 'bg-blue-400' },
  { id: 'Meat', icon: null, color: 'bg-red-500' },
  { id: 'Pantry', icon: null, color: 'bg-amber-600' },
  { id: 'Snacks', icon: null, color: 'bg-orange-400' },
  { id: 'Beverages', icon: null, color: 'bg-cyan-500' },
  { id: 'Household', icon: null, color: 'bg-slate-500' },
  { id: 'Conserve', icon: null, color: 'bg-yellow-600' },
  { id: 'General', icon: null, color: 'bg-stone-400' },
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
      <div className="space-y-3">
        {/* Category tabs skeleton */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-9 w-20 bg-stone-200 rounded-full animate-pulse shrink-0" />
          ))}
        </div>
        {/* Product grid skeleton */}
        <div className="grid grid-cols-4 gap-2">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="aspect-square bg-stone-100 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
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
                variant={isSelected ? 'default' : 'outline'}
                size="sm"
                className={`shrink-0 rounded-full px-4 h-9 font-medium transition-all ${
                  isSelected
                    ? `${cat.color} text-white border-transparent hover:opacity-90`
                    : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-50'
                }`}
                onClick={() => setSelectedCategory(cat.id)}
              >
                {Icon && <Icon className="h-4 w-4 mr-1.5" />}
                {getCategoryLabel(cat.id)}
                <span className={`ml-1.5 text-xs ${isSelected ? 'text-white/80' : 'text-stone-400'}`}>
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
          <div className="flex flex-col items-center justify-center py-8 text-stone-400">
            <Package className="h-10 w-10 mb-2 opacity-50" />
            <p className="text-sm font-medium">{t('search.noCategoryProducts', 'No products in this category')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-2">
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
      className={`relative flex flex-col items-center p-2 rounded-xl border-2 transition-all text-left ${
        isOutOfStock
          ? 'border-stone-200 bg-stone-50 opacity-50 cursor-not-allowed'
          : 'border-stone-200 hover:border-[var(--color-forest)] hover:bg-stone-50 active:scale-95 cursor-pointer'
      }`}
      onClick={() => !isOutOfStock && onSelect(product)}
      disabled={isOutOfStock}
      title={product.fields.Name}
    >
      {/* Product Image */}
      <div className="w-12 h-12 rounded-lg bg-stone-100 flex items-center justify-center overflow-hidden mb-1.5 border border-stone-200">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <Package className="h-6 w-6 text-stone-400" />
        )}
      </div>

      {/* Product Name */}
      <p className="text-[10px] font-medium text-stone-700 text-center line-clamp-2 leading-tight w-full min-h-[24px]">
        {product.fields.Name}
      </p>

      {/* Price */}
      {price != null && (
        <p className="text-xs font-bold text-stone-900 mt-0.5">
          €{price.toFixed(2)}
        </p>
      )}

      {/* Stock indicator */}
      {!isOutOfStock && stock <= 5 && (
        <span className="absolute top-1 right-1 w-2 h-2 bg-amber-400 rounded-full" title={`${stock} in stock`} />
      )}

      {/* Out of Stock Overlay */}
      {isOutOfStock && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80 rounded-xl">
          <span className="text-[10px] font-medium text-stone-500">
            {t('search.outOfStock', 'Out')}
          </span>
        </div>
      )}
    </button>
  );
};
