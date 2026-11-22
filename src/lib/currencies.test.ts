import { describe, expect, it } from 'vitest';
import OP from '../core';
import { CURRENCIES, currencyOf } from './currencies';

describe('currencies', () => {
  it('has unique three-letter codes and a symbol and name for each', () => {
    expect(new Set(CURRENCIES.map(c => c.code)).size).toBe(CURRENCIES.length);
    CURRENCIES.forEach(c => { expect(c.code).toMatch(/^[A-Z]{3}$/); expect(c.symbol.length).toBeGreaterThan(0); expect(c.name.length).toBeGreaterThan(2); });
  });

  it('finds a currency by code, ignoring case', () => {
    expect(currencyOf('gbp', 'whatever')?.symbol).toBe('£');
  });

  it('finds a currency by symbol only when one currency uses it', () => {
    expect(currencyOf('', '£')?.code).toBe('GBP');
    expect(currencyOf('', 'Rs.')).toBeUndefined();     // Sri Lanka, Pakistan and Nepal all use it
    expect(currencyOf('', '?')).toBeUndefined();
    expect(currencyOf(undefined, undefined)).toBeUndefined();
  });

  it('is kept in a project only when it is a three-letter code', () => {
    const keep = (v: any) => { const p = OP.model.blank(); (p as any).currencyCode = v; return OP.model.normalize(p).currencyCode; };
    expect([keep('gbp'), keep(' usd '), keep('GB'), keep('GBPX'), keep(7), keep(undefined), keep('12A')]).toEqual(['GBP', 'USD', '', '', '', '', '']);
  });
});

describe('the longer currency list', () => {
  it('includes the currencies people asked for, each with a unique code and a symbol', () => {
    for (const code of ['EGP', 'THB', 'VND', 'IDR', 'PHP', 'TRY', 'PLN', 'CZK', 'HUF', 'ILS', 'NZD', 'KRW', 'SEK', 'NOK', 'DKK', 'HKD']) {
      expect(CURRENCIES.some(c => c.code === code), code).toBe(true);
    }
    expect(CURRENCIES.length).toBeGreaterThanOrEqual(38);
  });
  it('finds a currency by a symbol that only it uses, and does not guess when two share one', () => {
    expect(currencyOf(undefined, '₩')?.code).toBe('KRW');
    expect(currencyOf(undefined, 'Kč')?.code).toBe('CZK');
    expect(currencyOf(undefined, 'Rs.')).toBeUndefined();   // LKR, PKR and NPR all use it
  });
  it('gives every currency a different symbol unless the sharing is intended (the three rupee currencies)', () => {
    const count = new Map<string, string[]>();
    CURRENCIES.forEach(c => count.set(c.symbol, [...(count.get(c.symbol) || []), c.code]));
    const shared = [...count.values()].filter(v => v.length > 1).map(v => v.join('/'));
    expect(shared).toEqual(['LKR/PKR/NPR']);
  });
});
