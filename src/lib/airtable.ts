import Airtable from 'airtable';

// Initialize Airtable client
// Note: These env vars must be set in .env for the app to function
const apiKey = import.meta.env.VITE_AIRTABLE_API_KEY;
const baseId = import.meta.env.VITE_AIRTABLE_BASE_ID;

if (!apiKey || !baseId) {
  console.warn('Missing Airtable credentials. Please check .env file.');
}

const base = new Airtable({ apiKey }).base(baseId || '');

// Table Names - utilizing constants to avoid typos
export const TABLES = {
  PRODUCTS: 'Products',
  STOCK_MOVEMENTS: 'Stock Movements',
};

export default base;
