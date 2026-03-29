export interface ImportResult {
  successCount: number;
  skipCount: number;
  errorCount: number;
  invoiceDuplicateSkipCount: number;
  xlsxDuplicateSkipCount: number;
  failedProducts: Array<{ name: string; error: string }>;
  partialProducts: Array<{ name: string; message: string }>;
  fatalError?: string;
}
