import Airtable from 'airtable'

const env = typeof import.meta !== 'undefined' ? (import.meta.env as Record<string, string | undefined>) : {}

const apiKey = process.env.NUXT_PUBLIC_AIRTABLE_API_KEY || env.NUXT_PUBLIC_AIRTABLE_API_KEY
const baseId = process.env.NUXT_PUBLIC_AIRTABLE_BASE_ID || env.NUXT_PUBLIC_AIRTABLE_BASE_ID

if (!apiKey || !baseId) {
  console.warn('Missing Airtable credentials. Please check your environment variables.')
}

const base = new Airtable({ apiKey }).base(baseId || '')

export const TABLES = {
  PRODUCTS: 'Products',
  STOCK_MOVEMENTS: 'Stock Movements',
}

export default base
