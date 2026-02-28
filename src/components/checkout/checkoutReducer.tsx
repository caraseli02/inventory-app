import type { CartItem, Product } from '../../types';

/**
 * CheckoutPage state managed by useReducer
 */
export interface CheckoutState {
  // Cart state
  cart: CartItem[];
  isCheckingOut: boolean;
  checkoutComplete: boolean;
  lastAddedProduct: string | null; // Name of last added product for feedback

  // Checkout summary (stored when checkout completes)
  completedItemsCount: number;
  completedTotalQuantity: number;
  completedReferenceNumber: string;

  // Scanner state
  scannedCode: string | null;
  manualCode: string;
  barcodeSource: 'scanner' | 'quick-add' | null;

  // Lookup state
  lookupRequested: boolean;
  lookupError: string | null;

  // UI state
  isCartExpanded: boolean;
  showReviewModal: boolean;
  summaryExpanded: boolean;
}

/**
 * Actions for CheckoutPage reducer
 */
export type CheckoutAction =
  // Cart actions
  | { type: 'ADD_TO_CART'; product: Product; insufficientStockMessage?: string; zeroStockMessage?: string }
  | { type: 'UPDATE_CART_ITEM_QUANTITY'; index: number; delta: number; errorMessage?: string }
  | { type: 'SET_CART'; cart: CartItem[] }
  | { type: 'CLEAR_CART' }
  | { type: 'SET_LAST_ADDED'; productName: string | null }
  | { type: 'START_CHECKOUT' }
  | { type: 'COMPLETE_CHECKOUT'; itemsCount: number; totalQuantity: number; referenceNumber: string }
  | { type: 'CANCEL_CHECKOUT' }

  // Scanner actions
  | { type: 'SET_SCANNED_CODE'; code: string | null; source?: 'scanner' | 'quick-add' }
  | { type: 'SET_MANUAL_CODE'; code: string }

  // Lookup actions
  | { type: 'REQUEST_LOOKUP' }
  | { type: 'LOOKUP_SUCCESS' }
  | { type: 'LOOKUP_ERROR'; error: string }
  | { type: 'CLEAR_LOOKUP_ERROR' }
  | { type: 'RESET_LOOKUP' }

  // UI actions
  | { type: 'TOGGLE_CART_EXPANDED' }
  | { type: 'SET_CART_EXPANDED'; expanded: boolean }
  | { type: 'SHOW_REVIEW_MODAL' }
  | { type: 'HIDE_REVIEW_MODAL' }
  | { type: 'TOGGLE_SUMMARY_EXPANDED' };

/**
 * Initial state for CheckoutPage
 */
export const initialState: CheckoutState = {
  cart: [],
  isCheckingOut: false,
  checkoutComplete: false,
  lastAddedProduct: null,
  completedItemsCount: 0,
  completedTotalQuantity: 0,
  completedReferenceNumber: '',
  scannedCode: null,
  manualCode: '',
  barcodeSource: null,
  lookupRequested: false,
  lookupError: null,
  isCartExpanded: false,
  showReviewModal: false,
  summaryExpanded: false,
};

/**
 * Reducer for CheckoutPage state management
 *
 * Centralizes all state transitions for better predictability and testability.
 * Handles cart operations, scanner state, product lookup, and UI interactions.
 */
export function checkoutReducer(state: CheckoutState, action: CheckoutAction): CheckoutState {
  switch (action.type) {
    // Cart actions
    case 'ADD_TO_CART': {
      const existingItemIndex = state.cart.findIndex(item => item.product.id === action.product.id);
      const availableStock = action.product.fields['Current Stock Level'] ?? 0;

      if (existingItemIndex >= 0) {
        const existingItem = state.cart[existingItemIndex];
        const newQuantity = existingItem.quantity + 1;

        // Validate stock before allowing increase
        if (newQuantity > availableStock) {
          // Immutable update - create new item object
          return {
            ...state,
            cart: state.cart.map((cartItem, i) =>
              i === existingItemIndex
                ? { ...cartItem, status: 'failed' as const, statusMessage: action.insufficientStockMessage }
                : cartItem
            ),
            checkoutComplete: false,
          };
        }

        // Stock available, allow increase - immutable update
        return {
          ...state,
          cart: state.cart.map((cartItem, i) =>
            i === existingItemIndex
              ? { ...cartItem, quantity: newQuantity, status: undefined, statusMessage: undefined }
              : cartItem
          ),
          checkoutComplete: false,
        };
      }

      // For new items, check if we can add at least 1 unit
      if (availableStock < 1) {
        return {
          ...state,
          cart: [...state.cart, { product: action.product, quantity: 1, status: 'failed' as const, statusMessage: action.zeroStockMessage }],
          checkoutComplete: false,
        };
      }

      return {
        ...state,
        cart: [...state.cart, { product: action.product, quantity: 1 }],
        checkoutComplete: false,
      };
    }

    case 'UPDATE_CART_ITEM_QUANTITY': {
      const item = state.cart[action.index];
      const newQuantity = item.quantity + action.delta;
      const availableStock = item.product.fields['Current Stock Level'] ?? 0;

      // Helper to update a single cart item immutably
      const updateCartItem = (updates: Partial<CartItem>) => ({
        ...state,
        cart: state.cart.map((cartItem, i) =>
          i === action.index ? { ...cartItem, ...updates } : cartItem
        ),
      });

      // Remove item if quantity reaches zero
      if (newQuantity <= 0) {
        return {
          ...state,
          cart: state.cart.filter((_, i) => i !== action.index),
        };
      }

      // Block increase if exceeds available stock
      if (action.delta > 0 && newQuantity > availableStock) {
        return updateCartItem({
          status: 'failed' as const,
          statusMessage: action.errorMessage || `Cannot add more. Only ${availableStock} unit(s) available in stock.`,
        });
      }

      // Apply quantity change
      return updateCartItem({
        quantity: newQuantity,
        status: 'idle' as const,
        statusMessage: undefined,
      });
    }

    case 'SET_CART':
      return { ...state, cart: action.cart };

    case 'CLEAR_CART':
      return { ...state, cart: [], lastAddedProduct: null };

    case 'SET_LAST_ADDED':
      return { ...state, lastAddedProduct: action.productName };

    case 'START_CHECKOUT':
      return { ...state, isCheckingOut: true, checkoutComplete: false };

    case 'COMPLETE_CHECKOUT':
      return {
        ...state,
        isCheckingOut: false,
        checkoutComplete: true,
        completedItemsCount: action.itemsCount,
        completedTotalQuantity: action.totalQuantity,
        completedReferenceNumber: action.referenceNumber,
        cart: [],
      };

    case 'CANCEL_CHECKOUT':
      return { ...state, isCheckingOut: false };

    // Scanner actions
    case 'SET_SCANNED_CODE':
      return { ...state, scannedCode: action.code, barcodeSource: action.source || null };

    case 'SET_MANUAL_CODE':
      return { ...state, manualCode: action.code };

    // Lookup actions
    case 'REQUEST_LOOKUP':
      return { ...state, lookupRequested: true, lookupError: null };

    case 'LOOKUP_SUCCESS':
      return { ...state, scannedCode: null, lookupRequested: false, lookupError: null, manualCode: '' };

    case 'LOOKUP_ERROR':
      return { ...state, scannedCode: null, lookupRequested: false, lookupError: action.error };

    case 'CLEAR_LOOKUP_ERROR':
      return { ...state, lookupError: null };

    case 'RESET_LOOKUP':
      return { ...state, lookupRequested: false };

    // UI actions
    case 'TOGGLE_CART_EXPANDED':
      return { ...state, isCartExpanded: !state.isCartExpanded };

    case 'SET_CART_EXPANDED':
      return { ...state, isCartExpanded: action.expanded };

    case 'SHOW_REVIEW_MODAL':
      return { ...state, showReviewModal: true };

    case 'HIDE_REVIEW_MODAL':
      return { ...state, showReviewModal: false };

    case 'TOGGLE_SUMMARY_EXPANDED':
      return { ...state, summaryExpanded: !state.summaryExpanded };

    default:
      return state;
  }
}
