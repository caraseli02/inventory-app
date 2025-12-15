import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, X, Loader2, Package } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useProductSearch } from '@/hooks/useProductSearch';
import type { Product } from '@/types';
import { logger } from '@/lib/logger';

interface ProductSearchDropdownProps {
  /** Called when a product is selected from the dropdown */
  onProductSelect: (product: Product) => void;
  /** Placeholder text for the search input */
  placeholder?: string;
  /** Whether the component is disabled */
  disabled?: boolean;
  /** Auto-focus the input on mount */
  autoFocus?: boolean;
  /** Custom class name for the container */
  className?: string;
}

/**
 * Product search input with dropdown results.
 * Shows product thumbnail, name, price, and stock level.
 * Supports keyboard navigation.
 */
export const ProductSearchDropdown = ({
  onProductSelect,
  placeholder,
  disabled = false,
  autoFocus = false,
  className = '',
}: ProductSearchDropdownProps) => {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const {
    searchQuery,
    setSearchQuery,
    searchResults,
    isLoading,
    isSearching,
    hasResults,
    noResults,
    clearSearch,
    error,
  } = useProductSearch();

  // Auto-focus on mount if requested
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  // Compute isOpen based on state (not using effect)
  const isOpen = useMemo(() => {
    if (!searchQuery.trim()) return false;
    if (!isFocused) return false;
    return hasResults || noResults || isSearching;
  }, [searchQuery, isFocused, hasResults, noResults, isSearching]);

  // Compute selectedIndex safely - clamp to valid range
  const safeSelectedIndex = selectedIndex >= searchResults.length ? -1 : selectedIndex;

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsFocused(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = useCallback((product: Product) => {
    onProductSelect(product);
    clearSearch();
    setSelectedIndex(-1);
    // Keep focus on input for continuous searching - don't manipulate focus state
    // The input naturally keeps focus after clearing
  }, [onProductSelect, clearSearch]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || searchResults.length === 0) return;

    const maxIndex = searchResults.length - 1;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev < maxIndex ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : maxIndex));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (safeSelectedIndex >= 0) {
        handleSelect(searchResults[safeSelectedIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsFocused(false);
      inputRef.current?.blur();
    }
  };

  const defaultPlaceholder = t('search.placeholder', 'Search products...');

  return (
    <div className={`relative ${className}`}>
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-5 top-1/2 transform -translate-y-1/2 h-6 w-6 text-zinc-500" />
        <Input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            // Delay blur to allow click on dropdown items
            setTimeout(() => {
              if (!dropdownRef.current?.contains(document.activeElement)) {
                setIsFocused(false);
              }
            }, 150);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder ?? defaultPlaceholder}
          disabled={disabled}
          className="h-16 pl-14 pr-14 border-2 border-zinc-300 focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 text-xl font-semibold rounded-xl shadow-md"
          aria-label={t('search.ariaLabel', 'Search for products')}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          role="combobox"
          autoComplete="off"
        />
        {/* Clear button or loading spinner */}
        {searchQuery && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            {isSearching || isLoading ? (
              <Loader2 className="h-6 w-6 text-zinc-400 animate-spin" />
            ) : (
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 hover:bg-zinc-100 rounded-lg transition-colors"
                onClick={() => {
                  clearSearch();
                  inputRef.current?.focus();
                }}
                aria-label={t('search.clear', 'Clear search')}
              >
                <X className="h-5 w-5 text-zinc-500" />
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Results Dropdown */}
      {isOpen && searchQuery.trim() && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-3 bg-white border-2 border-zinc-200 rounded-xl shadow-lg max-h-96 overflow-y-auto"
          role="listbox"
        >
          {/* Error State */}
          {error && !isSearching && (
            <div className="p-6 text-center text-red-600">
              <Package className="h-8 w-8 mx-auto mb-3 opacity-40" />
              <p className="text-base font-medium">{t('search.error', 'Failed to load products')}</p>
              <p className="text-sm mt-1 text-red-500">{t('search.errorRetry', 'Please try again later')}</p>
            </div>
          )}

          {/* Loading State */}
          {isSearching && !error && (
            <div className="p-6 text-center text-zinc-500">
              <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
              <p className="text-base">{t('search.searching', 'Searching...')}</p>
            </div>
          )}

          {/* No Results */}
          {noResults && !isSearching && !error && (
            <div className="p-6 text-center text-zinc-400">
              <Package className="h-8 w-8 mx-auto mb-3 opacity-40" />
              <p className="text-base font-medium">{t('search.noResults', 'No products found')}</p>
              <p className="text-sm mt-1">{t('search.tryDifferent', 'Try a different search term')}</p>
            </div>
          )}

          {/* Results List */}
          {hasResults && !isSearching && !error && (
            <ul className="py-2">
              {searchResults.map((product, index) => {
                return (
                  <SearchResultItem
                    key={product.id}
                    product={product}
                    index={index}
                    isSelected={index === safeSelectedIndex}
                    onSelect={handleSelect}
                    onMouseEnter={setSelectedIndex}
                  />
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

// Search result item component with image error handling
interface SearchResultItemProps {
  product: Product;
  index: number;
  isSelected: boolean;
  onSelect: (product: Product) => void;
  onMouseEnter: (index: number) => void;
}

const SearchResultItem = ({ product, index, isSelected, onSelect, onMouseEnter }: SearchResultItemProps) => {
  const { t } = useTranslation();
  const [imageError, setImageError] = useState(false);
  const imageUrl = product.fields.Image?.[0]?.url;
  const price = product.fields.Price;
  const stock = product.fields['Current Stock Level'] ?? 0;
  const isLowStock = stock < (product.fields['Min Stock Level'] ?? 5);

  const handleImageError = () => {
    logger.warn('Failed to load product image in search', {
      productId: product.id,
      productName: product.fields.Name,
      imageUrl,
    });
    setImageError(true);
  };

  return (
    <li
      role="option"
      aria-selected={isSelected}
      className={`px-5 py-4 cursor-pointer flex items-center gap-4 transition-colors duration-150 ${
        isSelected ? 'bg-zinc-100' : 'hover:bg-zinc-50'
      }`}
      onClick={() => onSelect(product)}
      onMouseEnter={() => onMouseEnter(index)}
    >
      {/* Product Image */}
      <div className="w-14 h-14 rounded-lg bg-zinc-50 flex items-center justify-center overflow-hidden shrink-0 border border-zinc-200">
        {imageUrl && !imageError ? (
          <img
            src={imageUrl}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
            onError={handleImageError}
          />
        ) : (
          <Package className="h-6 w-6 text-zinc-300" />
        )}
      </div>

      {/* Product Info */}
      <div className="flex-1 min-w-0">
        <p className="text-lg font-semibold text-zinc-900 truncate">
          {product.fields.Name}
        </p>
        <p className="text-sm text-zinc-500 truncate mt-1">
          {product.fields.Barcode && (
            <span className="mr-2">{product.fields.Barcode}</span>
          )}
          {product.fields.Category && (
            <span className="text-zinc-400">{product.fields.Category}</span>
          )}
        </p>
      </div>

      {/* Price & Stock */}
      <div className="text-right shrink-0">
        {price != null && (
          <p className="text-lg font-bold text-zinc-900">
            €{price.toFixed(2)}
          </p>
        )}
        <p className={`text-sm mt-1 ${isLowStock ? 'text-amber-600 font-medium' : 'text-zinc-500'}`}>
          {stock} {t('search.inStock', 'in stock')}
        </p>
      </div>
    </li>
  );
};
