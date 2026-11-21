import { describe, expect, it } from 'vitest';
import pkg from '../package.json';
import notices from '../public/third-party-notices.txt?raw';
import licenseText from '../LICENSE?raw';

describe('license notices', () => {
  it('lists every library that is shipped with the app, so the file cannot fall behind', () => {
    for (const name of Object.keys(pkg.dependencies)) expect(notices, name + ' is missing; run: npm run notices').toContain(name + ' ');
  });
  it('includes the font license and the license text of each package', () => {
    expect(notices).toContain('SIL Open Font License');
    expect(notices.match(/Permission is hereby granted, free of charge/g)!.length).toBeGreaterThanOrEqual(6);   // the MIT text, once per package
  });
  it('declares the project license', () => {
    expect(pkg.license).toBe('MIT');
    expect(licenseText).toMatch(/^MIT License/);
  });
});
