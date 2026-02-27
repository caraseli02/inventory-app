import { useState, type FormEvent, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useProductLookup } from './useProductLookup';
import { useToast } from './useToast';
import type { Product } from '../types';
import type { InputMode } from '../components/search/InputModeToggle';

export interface ScanState {
  scannedCode: string | null;
  manualCode: string;
  setManualCode: (code: string) => void;
  inputMode: InputMode;
  setInputMode: (mode: InputMode) => void;
  selectedProduct: Product | null;
  product: Product | null | undefined;
  isLoading: boolean;
  handleScanSuccess: (code: string) => void;
  handleReset: () => void;
  handleTryAgain: () => void;
  handleAddNew: () => void;
  handleProductSelect: (product: Product) => void;
  handleManualSubmit: (e: FormEvent<HTMLFormElement>) => void;
  showNotFoundState: boolean;
  showCreateForm: boolean;
  showDetailFromScan: boolean;
  showDetailFromSearch: boolean;
  showDetail: boolean;
  hasActiveProduct: boolean;
}

export function useScanState(): ScanState {
  const { t } = useTranslation();
  const [scannedCode, setScannedCode] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [showCreateMode, setShowCreateMode] = useState(false);
  const [inputMode, setInputMode] = useState<InputMode>('search');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const { showToast } = useToast();

  const { data: product, isLoading, error } = useProductLookup(scannedCode);

  useEffect(() => {
    if (error && scannedCode) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      showToast('error', t('toast.lookupFailed'), errorMessage || t('toast.lookupFailedMessage'), 5000);
      const timer = setTimeout(() => {
        setScannedCode(null);
        setManualCode('');
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [error, scannedCode, showToast, t]);

  const handleScanSuccess = (code: string) => {
    setScannedCode(code);
    if (navigator.vibrate) navigator.vibrate(200);
  };

  const handleReset = () => {
    setScannedCode(null);
    setManualCode('');
    setShowCreateMode(false);
    setSelectedProduct(null);
  };

  const handleTryAgain = () => {
    setScannedCode(null);
    setManualCode('');
    setShowCreateMode(false);
    setSelectedProduct(null);
  };

  const handleAddNew = () => setShowCreateMode(true);

  const handleProductSelect = (p: Product) => {
    setSelectedProduct(p);
    setScannedCode(null);
    setShowCreateMode(false);
    if (navigator.vibrate) navigator.vibrate(100);
  };

  const handleManualSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const code = manualCode.trim();
    if (code.length >= 4) handleScanSuccess(code);
  };

  const productNotFound = !isLoading && !product && !error && !!scannedCode;
  const showNotFoundState = productNotFound && !showCreateMode;
  const showCreateForm = productNotFound && showCreateMode;
  const showDetailFromScan = !isLoading && !!product && !!scannedCode;
  const showDetailFromSearch = selectedProduct !== null;
  const showDetail = showDetailFromScan || showDetailFromSearch;
  const hasActiveProduct = !!scannedCode || selectedProduct !== null;

  return {
    scannedCode, manualCode, setManualCode,
    inputMode, setInputMode,
    selectedProduct, product, isLoading,
    handleScanSuccess, handleReset, handleTryAgain,
    handleAddNew, handleProductSelect, handleManualSubmit,
    showNotFoundState, showCreateForm,
    showDetailFromScan, showDetailFromSearch, showDetail, hasActiveProduct,
  };
}
