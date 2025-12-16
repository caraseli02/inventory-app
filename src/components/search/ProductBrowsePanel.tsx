import { useState, useMemo, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Package, Clock, Grid3X3, Plus, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getAllProducts } from '@/lib/api';
import { useRecentProducts } from '@/hooks/useRecentProducts';
import type { Product, CartItem } from '@/types';
import { logger } from '@/lib/logger';

// Category definitions with icons and subtle indicator dots
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
  /** Current cart items to show selection state */
  cartItems?: CartItem[];
}

/**
 * Browse products by category with one-tap addition.
 * Features category chips and a scrollable 3-column product grid.
 * Based on Material Design 3 and retail POS design patterns.
 */
export const ProductBrowsePanel = ({
  onProductSelect,
  maxHeight = '300px',
  cartItems = [],
}: ProductBrowsePanelProps) => {
  const { t } = useTranslation();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [itemsToShow, setItemsToShow] = useState(21); // Show 21 items initially (7 rows of 3)
  const { recentProducts, hasRecentProducts } = useRecentProducts();

  // Track which product was just added for animation
  const [justAddedId, setJustAddedId] = useState<string | null>(null);

  const ITEMS_PER_PAGE = 21;

  // Fetch all products
  const { data: allProducts, isLoading, error } = useQuery({
    queryKey: ['products', 'all'],
    queryFn: getAllProducts,
    staleTime: 1000 * 60 * 5,
  });

  // Create a map of product ID -> quantity in cart for quick lookup
  const cartQuantityMap = useMemo(() => {
    const map = new Map<string, number>();
    cartItems.forEach(item => {
      map.set(item.product.id, item.quantity);
    });
    return map;
  }, [cartItems]);

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

  // Get visible products (paginated)
  const visibleProducts = sortedProducts.slice(0, itemsToShow);
  const hasMore = itemsToShow < sortedProducts.length;

  const loadMore = () => {
    setItemsToShow(prev => prev + ITEMS_PER_PAGE);
  };

  const handleCategorySelect = (catId: string) => {
    setSelectedCategory(catId);
    setItemsToShow(ITEMS_PER_PAGE); // Reset pagination when category changes
  };

  const handleProductSelect = useCallback((product: Product) => {
    // Trigger animation
    setJustAddedId(product.id);

    // Haptic feedback
    if (navigator.vibrate) {
      navigator.vibrate(50);
    }

    // Call parent handler
    onProductSelect(product);
  }, [onProductSelect]);

  // Clear animation after delay
  useEffect(() => {
    if (justAddedId) {
      const timer = setTimeout(() => setJustAddedId(null), 600);
      return () => clearTimeout(timer);
    }
  }, [justAddedId]);

  const getCategoryLabel = (catId: string) => {
    if (catId === 'all') return t('search.allProducts', 'All');
    if (catId === 'recent') return t('search.recentItems', 'Recent');
    return t(`categories.${catId}`, catId);
  };

  // Get product count for a category
  const getProductCount = (catId: string): number => {
    if (catId === 'all') return allProducts?.length ?? 0;
    if (catId === 'recent') return recentProducts.length;
    return allProducts?.filter(p => p.fields.Category === catId).length ?? 0;
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {/* Category chips skeleton */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-9 w-20 bg-zinc-100 rounded-full animate-pulse shrink-0" />
          ))}
        </div>
        {/* Product grid skeleton - 3 columns */}
        <div className="grid grid-cols-3 gap-2">
          {[...Array(9)].map((_, i) => (
            <div key={i} className="h-28 bg-zinc-50 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-red-600">
        <Package className="h-12 w-12 mb-4 opacity-40" />
        <p className="text-lg font-semibold mb-2">{t('search.error', 'Failed to load products')}</p>
        <p className="text-sm text-red-500">{t('search.errorRetry', 'Please try again later')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Category Chips - Material Design 3 style with scroll fade */}
      <div className="relative">
        {/* Scroll fade mask on right edge */}
        <div
          className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide pr-8"
          style={{
            maskImage: 'linear-gradient(to right, black 85%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to right, black 85%, transparent 100%)',
          }}
        >
          {visibleCategories.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            const Icon = cat.icon;
            const productCount = getProductCount(cat.id);

            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => handleCategorySelect(cat.id)}
                className={`
                  shrink-0 px-3 py-2 rounded-full text-sm font-medium
                  flex items-center gap-1.5
                  transition-all duration-150
                  ${isSelected
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-white text-zinc-700 border border-zinc-200 hover:bg-zinc-50'
                  }
                `}
              >
                {/* Checkmark for selected state */}
                {isSelected && (
                  <Check className="h-4 w-4" strokeWidth={2.5} />
                )}

                {/* Icon or colored dot for unselected */}
                {!isSelected && Icon && (
                  <Icon className="h-4 w-4 text-zinc-400" />
                )}
                {!isSelected && !Icon && (
                  <span className={`w-2 h-2 rounded-full ${cat.dot}`} />
                )}

                <span>{getCategoryLabel(cat.id)}</span>

                {/* Count badge */}
                <span className={`
                  text-xs font-semibold tabular-nums
                  ${isSelected
                    ? 'bg-white/20 px-1.5 rounded-full'
                    : 'text-zinc-400'
                  }
                `}>
                  {productCount}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Product Grid - 3 columns on mobile, 4 on tablet, 5 on desktop */}
      <div
        className="overflow-y-auto pb-4"
        style={{ maxHeight }}
      >
        {sortedProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-zinc-400">
            <Package className="h-10 w-10 mb-3 opacity-40" />
            <p className="text-base font-medium">{t('search.noCategoryProducts', 'No products in this category')}</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2">
              {visibleProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onSelect={handleProductSelect}
                  quantityInCart={cartQuantityMap.get(product.id) ?? 0}
                  isJustAdded={justAddedId === product.id}
                />
              ))}
            </div>

            {/* Load More Button */}
            {hasMore && (
              <div className="flex justify-center pt-2 pb-2">
                <Button
                  onClick={loadMore}
                  variant="outline"
                  size="default"
                  className="min-w-[160px] h-10 font-semibold border-2 border-zinc-300 hover:bg-zinc-100 hover:border-zinc-400 text-zinc-700 rounded-full text-sm"
                >
                  <Plus className="h-4 w-4 mr-1.5" />
                  {t('search.loadMore', 'Load More')} ({sortedProducts.length - itemsToShow})
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// Compact product card component optimized for 3-column grid
interface ProductCardProps {
  product: Product;
  onSelect: (product: Product) => void;
  quantityInCart: number;
  isJustAdded: boolean;
}

const ProductCard = ({ product, onSelect, quantityInCart, isJustAdded }: ProductCardProps) => {
  const { t } = useTranslation();
  const [imageError, setImageError] = useState(false);
  const imageUrl = product.fields.Image?.[0]?.url;
  const price = product.fields.Price;
  const stock = product.fields['Current Stock Level'] ?? 0;
  const isOutOfStock = stock <= 0;
  const isInCart = quantityInCart > 0;

  const handleImageError = () => {
    logger.warn('Failed to load product image', {
      productId: product.id,
      productName: product.fields.Name,
      imageUrl,
    });
    setImageError(true);
  };

  return (
    <button
      type="button"
      className={`
        relative flex flex-col items-center p-2 rounded-xl text-left h-auto min-h-[120px] w-full
        transition-all duration-200 ease-out
        focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-emerald-500
        ${isOutOfStock
          ? 'bg-zinc-100 opacity-50 cursor-not-allowed'
          : isInCart
            ? 'bg-emerald-50 border-2 border-emerald-500 shadow-md'
            : 'bg-white border-2 border-zinc-200 hover:border-zinc-300 hover:shadow-md active:scale-[0.97] cursor-pointer'
        }
        ${isJustAdded ? 'scale-[0.95]' : ''}
      `}
      onClick={() => !isOutOfStock && onSelect(product)}
      disabled={isOutOfStock}
      title={product.fields.Name}
    >
      {/* Success Checkmark Overlay - Shows briefly when added */}
      <div
        className={`
          absolute inset-0 bg-emerald-500 rounded-xl flex items-center justify-center z-10
          transition-all duration-200
          ${isJustAdded ? 'opacity-100' : 'opacity-0 pointer-events-none'}
        `}
      >
        <div className="bg-white rounded-full p-1.5">
          <Check className="h-6 w-6 text-emerald-500" strokeWidth={3} />
        </div>
      </div>

      {/* Product Image - Compact size */}
      <div className={`w-12 h-12 rounded-lg flex items-center justify-center overflow-hidden mb-1.5 ${isInCart ? 'bg-emerald-100' : 'bg-zinc-100'}`}>
        {imageUrl && !imageError ? (
          <img
            src={imageUrl}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
            onError={handleImageError}
          />
        ) : (
          <Package className={`h-6 w-6 ${isInCart ? 'text-emerald-400' : 'text-zinc-300'}`} />
        )}
      </div>

      {/* Product Name - Compact */}
      <p className="text-xs font-semibold text-zinc-900 text-center line-clamp-2 leading-tight w-full mb-1">
        {product.fields.Name}
      </p>

      {/* Price and Quantity Row */}
      <div className="flex items-center justify-between w-full gap-1">
        {price != null && (
          <p className="text-xs font-bold text-zinc-900">
            €{price.toFixed(2)}
          </p>
        )}

        {/* Quantity indicator - shows when in cart */}
        {isInCart && (
          <span className="text-[10px] font-bold bg-emerald-500 text-white px-1.5 py-0.5 rounded-full">
            ×{quantityInCart}
          </span>
        )}
      </div>

      {/* Low stock indicator - subtle amber dot */}
      {!isOutOfStock && stock <= 5 && !isInCart && (
        <span
          className="absolute top-1 right-1 w-1.5 h-1.5 bg-amber-400 rounded-full"
          title={`${stock} in stock`}
        />
      )}

      {/* Out of Stock Overlay */}
      {isOutOfStock && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/90 rounded-xl">
          <span className="text-xs font-medium text-zinc-400">
            {t('search.outOfStock', 'Out')}
          </span>
        </div>
      )}
    </button>
  );
};
