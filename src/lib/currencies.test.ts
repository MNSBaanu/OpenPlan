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
