/* 
  1. Import handleProductDiscontinued from workflow
  2. Get productId from URL params (getRouterParam(event, 'productId'))
  3. Get reason and discontinuedBy from body
  4. Validate inputs
  5. Call handleProductDiscontinued
  6. Return the result
*/
import { readBody } from 'h3';
import { handleProductDiscontinued } from '~~/server/core/workflow';

export default defineEventHandler(async (event) => {
  // Step 2: Get productId from URL params
  const productId = getRouterParam(event, 'productId');

  // Step 3: Get reason and discontinuedBy from body
  const body = await readBody(event);
  const { reason, discontinuedBy } = body;

  // Step 4: Validate inputs
  if (!productId) {
    throw createError({
      statusCode: 400,
      message: 'Product ID is required',
    });
  }
  if (!reason || typeof reason !== 'string') {
    throw createError({
      statusCode: 400,
      message: 'A valid reason for discontinuation is required',
    });
  }
  if (!discontinuedBy || typeof discontinuedBy !== 'string') {
    throw createError({
      statusCode: 400,
      message: 'A valid discontinuedBy value is required',
    });
  }

  // Step 5: Call handleProductDiscontinued
  const result = handleProductDiscontinued({
    productId,
    reason,
    discontinuedBy,
  });

  // Step 6: Return the result
  return result;
}
);
