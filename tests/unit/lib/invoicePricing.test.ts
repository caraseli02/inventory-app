/**
 * Unit Tests: Invoice Pricing Utilities
 *
 * Tests for weight/unit parsing from product names.
 * NOTE: This function requires weight at the START of the string.
 */

import { describe, it, expect } from 'vitest';
import { parseWeightKgFromProductName } from '@/lib/invoicePricing';

describe('parseWeightKgFromProductName', () => {
  describe('kilogram parsing', () => {
    it('parses integer kg values', () => {
      expect(parseWeightKgFromProductName('2 kg Product')).toBe(2);
    });

    it('parses decimal kg values with dot', () => {
      expect(parseWeightKgFromProductName('1.5 kg Product')).toBe(1.5);
    });

    it('parses decimal kg values with comma', () => {
      expect(parseWeightKgFromProductName('1,5 kg Product')).toBe(1.5);
    });

    it('handles uppercase KG', () => {
      expect(parseWeightKgFromProductName('2 KG Product')).toBe(2);
    });

    it('handles mixed case', () => {
      expect(parseWeightKgFromProductName('2 Kg Product')).toBe(2);
    });

    it('handles no space between number and unit', () => {
      expect(parseWeightKgFromProductName('2kg Product')).toBe(2);
    });
  });

  describe('gram parsing', () => {
    it('parses gram values and converts to kg', () => {
      expect(parseWeightKgFromProductName('500 g Product')).toBe(0.5);
    });

    it('parses milliliter values and converts to kg', () => {
      expect(parseWeightKgFromProductName('750 ml Product')).toBe(0.75);
    });

    it('handles uppercase G', () => {
      expect(parseWeightKgFromProductName('1000 G Product')).toBe(1);
    });

    it('handles uppercase ML', () => {
      expect(parseWeightKgFromProductName('250 ML Product')).toBe(0.25);
    });
  });

  describe('liter parsing', () => {
    it('parses liter values', () => {
      expect(parseWeightKgFromProductName('1.5 l Product')).toBe(1.5);
    });

    it('handles uppercase L', () => {
      expect(parseWeightKgFromProductName('2 L Product')).toBe(2);
    });
  });

  describe('edge cases and invalid input', () => {
    it('returns undefined for empty string', () => {
      expect(parseWeightKgFromProductName('')).toBeUndefined();
    });

    it('returns undefined for whitespace only', () => {
      expect(parseWeightKgFromProductName('   ')).toBeUndefined();
    });

    it('returns undefined for name without unit at start', () => {
      expect(parseWeightKgFromProductName('Product 123')).toBeUndefined();
    });

    it('returns undefined for weight not at start', () => {
      expect(parseWeightKgFromProductName('Product 2 kg')).toBeUndefined();
    });

    it('returns undefined for zero or negative values', () => {
      expect(parseWeightKgFromProductName('0 kg Product')).toBeUndefined();
      expect(parseWeightKgFromProductName('-1 kg Product')).toBeUndefined();
    });

    it('returns undefined for non-numeric values', () => {
      expect(parseWeightKgFromProductName('abc kg Product')).toBeUndefined();
    });

    it('returns undefined for unknown units', () => {
      expect(parseWeightKgFromProductName('2 lb Product')).toBeUndefined();
    });

    it('returns undefined for Infinity', () => {
      expect(parseWeightKgFromProductName('Infinity kg Product')).toBeUndefined();
    });
  });

  describe('real-world OCR-style output (weight-first)', () => {
    it('parses milk product', () => {
      expect(parseWeightKgFromProductName('1 l Organic Milk')).toBe(1);
    });

    it('parses snack with grams', () => {
      expect(parseWeightKgFromProductName('150 g Potato Chips')).toBe(0.15);
    });

    it('parses beverage with ml', () => {
      expect(parseWeightKgFromProductName('1000 ml Orange Juice')).toBe(1);
    });

    it('parses cheese with kg and comma decimal', () => {
      expect(parseWeightKgFromProductName('0,750 kg Gouda Cheese')).toBe(0.75);
    });
  });
});
