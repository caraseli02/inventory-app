import Airtable from 'airtable'
import { useRuntimeConfig } from '#imports'

let cachedBase: Airtable.Base | null = null

const resolveCredentials = () => {
  const runtimeConfig = useRuntimeConfig() as {
    public: { airtableApiKey?: string; airtableBaseId?: string }
  }
  const apiKey = runtimeConfig.public.airtableApiKey || process.env.NUXT_PUBLIC_AIRTABLE_API_KEY
  const baseId = runtimeConfig.public.airtableBaseId || process.env.NUXT_PUBLIC_AIRTABLE_BASE_ID

  if (!apiKey || !baseId) {
    console.warn('Missing Airtable credentials. Please set NUXT_PUBLIC_AIRTABLE_API_KEY and NUXT_PUBLIC_AIRTABLE_BASE_ID.')
  }

  return { apiKey, baseId }
}

export const getAirtableBase = () => {
  if (cachedBase) return cachedBase

  const { apiKey, baseId } = resolveCredentials()
  cachedBase = new Airtable({ apiKey }).base(baseId || '')
  return cachedBase
}

export const TABLES = {
  PRODUCTS: 'Products',
  STOCK_MOVEMENTS: 'Stock Movements',
}
