import type { Attachment, FieldSet, Record as AirtableRecord } from 'airtable'
import { getAirtableBase, TABLES } from './airtable'
import type { Product, ProductFields, StockMovement, MarkupPercentage } from '@/types'
import { logger } from './logger'

export class ValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
    Object.setPrototypeOf(this, ValidationError.prototype)
  }
}

export class NetworkError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NetworkError'
    Object.setPrototypeOf(this, NetworkError.prototype)
  }
}

export class AuthorizationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthorizationError'
    Object.setPrototypeOf(this, AuthorizationError.prototype)
  }
}

const productsTable = () => getAirtableBase()<ProductFields>(TABLES.PRODUCTS)

const escapeAirtableString = (value: string): string => value.replace(/'/g, "\\'")

const validateNonEmptyString = (value: unknown, fieldName: string): string => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new ValidationError(`${fieldName} is required and cannot be empty`)
  }
  return value.trim()
}

const getCreatedTime = <TFields extends FieldSet>(record: AirtableRecord<TFields>): string =>
  (record._rawJson as { createdTime?: string } | undefined)?.createdTime ?? ''

export const mapAirtableProduct = (record: AirtableRecord<ProductFields>): Product => {
  if (!record.fields.Name || typeof record.fields.Name !== 'string') {
    logger.error('Invalid product record: missing or invalid Name', {
      recordId: record.id,
      fields: record.fields,
    })
    throw new ValidationError('Invalid product record from Airtable: Name is required and must be a string')
  }

  const normalizedImage =
    record.fields.Image && Array.isArray(record.fields.Image)
      ? (record.fields.Image as Attachment[]).map((att) => ({ url: att.url ?? '' }))
      : undefined

  return {
    id: record.id,
    createdTime: getCreatedTime(record),
    fields: {
      Name: record.fields.Name,
      Barcode: record.fields.Barcode as string | undefined,
      Category: record.fields.Category as string | undefined,
      Price: record.fields.Price as number | undefined,
      'Price 50%': record.fields['Price 50%'] as number | undefined,
      'Price 70%': record.fields['Price 70%'] as number | undefined,
      'Price 100%': record.fields['Price 100%'] as number | undefined,
      Markup: record.fields.Markup as MarkupPercentage | undefined,
      'Expiry Date': record.fields['Expiry Date'] as string | undefined,
      'Current Stock Level': record.fields['Current Stock Level'] as number | undefined,
      'Ideal Stock': record.fields['Ideal Stock'] as number | undefined,
      'Min Stock Level': record.fields['Min Stock Level'] as number | undefined,
      Supplier: record.fields.Supplier as string | undefined,
      Image: normalizedImage,
    },
  }
}

export const getProductByBarcode = async (barcode: string): Promise<Product | null> => {
  logger.debug('Fetching product by barcode', { barcode })

  if (!barcode || typeof barcode !== 'string') {
    throw new ValidationError('Barcode must be a non-empty string')
  }

  const sanitizedBarcode = escapeAirtableString(barcode.trim())

  try {
    const records = await productsTable()
      .select({
        filterByFormula: `({Barcode} = '${sanitizedBarcode}')`,
        maxRecords: 1,
      })
      .firstPage()

    if (!records || records.length === 0) {
      logger.info('No product found with barcode', { barcode })
      return null
    }

    logger.debug('Product found by barcode', { barcode, productId: records[0].id })
    return mapAirtableProduct(records[0])
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorCode =
      (error as { status?: string; error?: string } | undefined)?.status ||
      (error as { error?: string } | undefined)?.error ||
      'UNKNOWN'

    logger.error('Failed to fetch product by barcode', {
      barcode,
      errorMessage,
      errorCode,
      errorStack: error instanceof Error ? error.stack : undefined,
    })
    throw error
  }
}

export const getAllProducts = async (): Promise<Product[]> => {
  try {
    const records = await productsTable()
      .select({
        sort: [{ field: 'Name', direction: 'asc' }],
        maxRecords: 200,
      })
      .all()

    logger.info('Fetched products', { count: records.length })
    return records.map(mapAirtableProduct)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error('Failed to fetch all products', {
      errorMessage,
      errorStack: error instanceof Error ? error.stack : undefined,
    })
    throw error
  }
}

export interface CreateProductDTO {
  name: string
  barcode?: string
  category?: string
  price?: number
  price50?: number
  price70?: number
  price100?: number
  markup?: MarkupPercentage
  expiryDate?: string
  minStockLevel?: number
  idealStock?: number
  supplier?: string
  imageUrl?: string
}

export const createProduct = async (data: CreateProductDTO): Promise<Product> => {
  const name = validateNonEmptyString(data.name, 'Name')
  const fields: ProductFields = {
    Name: name,
    Barcode: data.barcode,
    Category: data.category,
    Price: data.price,
    'Price 50%': data.price50,
    'Price 70%': data.price70,
    'Price 100%': data.price100,
    Markup: data.markup,
    'Expiry Date': data.expiryDate,
    'Min Stock Level': data.minStockLevel,
    'Ideal Stock': data.idealStock,
    Supplier: data.supplier,
  }

  if (data.imageUrl) {
    fields.Image = [{ url: data.imageUrl } as Attachment] as ProductFields['Image']
  }

  logger.info('Creating product', {
    name: fields.Name,
    hasBarcode: Boolean(fields.Barcode),
    category: fields.Category,
    price: fields.Price,
  })

  try {
    const created = await productsTable().create([{ fields }], { typecast: true })
    return mapAirtableProduct(created[0])
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error('Failed to create product', {
      errorMessage,
      payload: fields,
      errorStack: error instanceof Error ? error.stack : undefined,
    })
    throw error
  }
}

const stockMovementsTable = () => getAirtableBase()<StockMovement['fields']>(TABLES.STOCK_MOVEMENTS)

export const addStockMovement = async (productId: string, quantity: number, type: 'IN' | 'OUT'): Promise<StockMovement> => {
  if (!productId || !productId.trim()) {
    throw new ValidationError('Product ID is required and cannot be empty')
  }
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new ValidationError(`Quantity must be a positive number, got: ${quantity}`)
  }
  if (type !== 'IN' && type !== 'OUT') {
    throw new ValidationError(`Type must be 'IN' or 'OUT', got: ${type}`)
  }

  logger.info('Adding stock movement', { productId, quantity, type })

  const finalQuantity = type === 'OUT' ? -Math.abs(quantity) : Math.abs(quantity)
  const dateStr = new Date().toISOString().split('T')[0]

  try {
    const records = await stockMovementsTable().create(
      [
        {
          fields: {
            Product: [productId],
            Quantity: finalQuantity,
            Type: type,
            Date: dateStr,
          },
        },
      ],
      { typecast: true }
    )

    logger.info('Stock movement recorded', { movementId: records[0].id, finalQuantity, type })
    return {
      id: records[0].id,
      fields: records[0].fields as unknown as StockMovement['fields'],
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    const airtableError = error as { response?: { status?: number }; code?: string } | undefined
    const errorCode = airtableError?.response?.status ?? airtableError?.code ?? 'UNKNOWN'

    logger.error('Failed to add stock movement', {
      productId,
      quantity: finalQuantity,
      type,
      dateStr,
      errorMessage,
      errorCode,
      errorStack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    })
    throw error
  }
}

export const getStockMovements = async (productId: string): Promise<StockMovement[]> => {
  logger.debug('Fetching stock movements', { productId })

  try {
    const escapedProductId = escapeAirtableString(productId)

    const allRecords = await stockMovementsTable()
      .select({
        sort: [{ field: 'Date', direction: 'desc' }],
        maxRecords: 100,
      })
      .firstPage()

    const records = allRecords.filter((record) => {
      const productField = record.fields.Product as string[] | undefined
      return Array.isArray(productField) && productField.includes(escapedProductId)
    })

    const limitedRecords = records.slice(0, 50)
    logger.info('Fetched stock movements', { productId, totalRecords: records.length, returnedRecords: limitedRecords.length })

    return limitedRecords.map((record) => ({
      id: record.id,
      fields: record.fields as unknown as StockMovement['fields'],
    }))
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error('Failed to fetch stock movements', {
      productId,
      errorMessage,
      errorStack: error instanceof Error ? error.stack : undefined,
    })
    throw error
  }
}
