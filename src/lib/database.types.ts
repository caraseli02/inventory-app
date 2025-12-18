/**
 * Supabase Database Types
 *
 * These types define the database schema for the inventory app.
 * They mirror the existing Airtable schema for easy migration.
 *
 * SQL Schema (run in Supabase SQL Editor):
 *
 * CREATE TABLE products (
 *   id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
 *   created_at TIMESTAMPTZ DEFAULT NOW(),
 *   name TEXT NOT NULL,
 *   barcode TEXT UNIQUE,
 *   category TEXT,
 *   price DECIMAL(10,2),
 *   price_50 DECIMAL(10,2),
 *   price_70 DECIMAL(10,2),
 *   price_100 DECIMAL(10,2),
 *   markup INTEGER CHECK (markup IN (50, 70, 100)),
 *   expiry_date DATE,
 *   min_stock_level INTEGER DEFAULT 0,
 *   ideal_stock INTEGER,
 *   supplier TEXT,
 *   image_url TEXT
 * );
 *
 * CREATE TABLE stock_movements (
 *   id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
 *   created_at TIMESTAMPTZ DEFAULT NOW(),
 *   product_id UUID REFERENCES products(id) ON DELETE CASCADE,
 *   quantity INTEGER NOT NULL,
 *   type TEXT NOT NULL CHECK (type IN ('IN', 'OUT')),
 *   date DATE DEFAULT CURRENT_DATE,
 *   note TEXT
 * );
 *
 * -- Create index for barcode lookups
 * CREATE INDEX idx_products_barcode ON products(barcode);
 *
 * -- Create index for product stock movements
 * CREATE INDEX idx_stock_movements_product_id ON stock_movements(product_id);
 *
 * -- Create a view for current stock levels
 * CREATE VIEW product_stock AS
 * SELECT
 *   p.*,
 *   COALESCE(SUM(sm.quantity), 0) as current_stock_level
 * FROM products p
 * LEFT JOIN stock_movements sm ON p.id = sm.product_id
 * GROUP BY p.id;
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      products: {
        Row: {
          id: string;
          created_at: string;
          name: string;
          barcode: string | null;
          category: string | null;
          price: number | null;
          price_50: number | null;
          price_70: number | null;
          price_100: number | null;
          markup: number | null;
          expiry_date: string | null;
          min_stock_level: number | null;
          ideal_stock: number | null;
          supplier: string | null;
          image_url: string | null;
        };
        Insert: {
          id?: string;
          created_at?: string;
          name: string;
          barcode?: string | null;
          category?: string | null;
          price?: number | null;
          price_50?: number | null;
          price_70?: number | null;
          price_100?: number | null;
          markup?: number | null;
          expiry_date?: string | null;
          min_stock_level?: number | null;
          ideal_stock?: number | null;
          supplier?: string | null;
          image_url?: string | null;
        };
        Update: {
          id?: string;
          created_at?: string;
          name?: string;
          barcode?: string | null;
          category?: string | null;
          price?: number | null;
          price_50?: number | null;
          price_70?: number | null;
          price_100?: number | null;
          markup?: number | null;
          expiry_date?: string | null;
          min_stock_level?: number | null;
          ideal_stock?: number | null;
          supplier?: string | null;
          image_url?: string | null;
        };
        Relationships: [];
      };
      stock_movements: {
        Row: {
          id: string;
          created_at: string;
          product_id: string;
          quantity: number;
          type: 'IN' | 'OUT';
          date: string;
          note: string | null;
        };
        Insert: {
          id?: string;
          created_at?: string;
          product_id: string;
          quantity: number;
          type: 'IN' | 'OUT';
          date?: string;
          note?: string | null;
        };
        Update: {
          id?: string;
          created_at?: string;
          product_id?: string;
          quantity?: number;
          type?: 'IN' | 'OUT';
          date?: string;
          note?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'stock_movements_product_id_fkey';
            columns: ['product_id'];
            isOneToOne: false;
            referencedRelation: 'products';
            referencedColumns: ['id'];
          }
        ];
      };
    };
    Views: {
      product_stock: {
        Row: {
          id: string;
          created_at: string;
          name: string;
          barcode: string | null;
          category: string | null;
          price: number | null;
          price_50: number | null;
          price_70: number | null;
          price_100: number | null;
          markup: number | null;
          expiry_date: string | null;
          min_stock_level: number | null;
          ideal_stock: number | null;
          supplier: string | null;
          image_url: string | null;
          current_stock_level: number;
        };
        Relationships: [];
      };
    };
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

// Helper types for easier usage
export type ProductRow = Database['public']['Tables']['products']['Row'];
export type ProductInsert = Database['public']['Tables']['products']['Insert'];
export type ProductUpdate = Database['public']['Tables']['products']['Update'];
export type StockMovementRow = Database['public']['Tables']['stock_movements']['Row'];
export type StockMovementInsert = Database['public']['Tables']['stock_movements']['Insert'];
export type ProductWithStock = Database['public']['Views']['product_stock']['Row'];
