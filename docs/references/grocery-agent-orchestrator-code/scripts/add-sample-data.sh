#!/bin/bash

# Script to add sample data to the grocery orchestrator
# This will create stock events and trigger agent proposals

echo "Adding sample products..."

# Add some stock for various products
curl -X POST http://localhost:3001/api/stock-level-changed \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "apple-001",
    "delta": 100,
    "reason": "DELIVERY",
    "threshold": 30
  }'

echo "✓ Added apples"

curl -X POST http://localhost:3001/api/stock-level-changed \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "banana-002",
    "delta": 50,
    "reason": "DELIVERY",
    "threshold": 25
  }'

echo "✓ Added bananas"

curl -X POST http://localhost:3001/api/stock-level-changed \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "orange-003",
    "delta": 15,
    "reason": "DELIVERY",
    "threshold": 20
  }'

echo "✓ Added oranges (low stock - should trigger proposal)"

curl -X POST http://localhost:3001/api/stock-level-changed \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "milk-004",
    "delta": 8,
    "reason": "DELIVERY",
    "threshold": 15
  }'

echo "✓ Added milk (very low stock - should trigger proposal)"

# Simulate some sales
curl -X POST http://localhost:3001/api/stock-level-changed \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "apple-001",
    "delta": -20,
    "reason": "SALE"
  }'

echo "✓ Sold 20 apples"

curl -X POST http://localhost:3001/api/stock-level-changed \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "banana-002",
    "delta": -15,
    "reason": "SALE"
  }'

echo "✓ Sold 15 bananas"

echo ""
echo "Sample data added! Check the UI at http://localhost:3001"
echo "- Dashboard: See all product stock levels"
echo "- Events: View the full event log"
echo "- Pending Actions: Review and approve/reject agent proposals"
