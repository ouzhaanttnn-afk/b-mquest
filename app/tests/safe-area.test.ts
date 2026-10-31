import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// iPhone notch / Dynamic Island inset must be applied exactly once. It used to be
// on html, body and #root (3×) plus Capacitor's automatic inset, which left a
// huge empty band above the home screen on real devices (browsers report 0 here).
const css = readFileSync(join(__dirname, '../src/App.css'), 'utf8');
const block = (selector: string) => {
  const i = css.indexOf(selector);
  expect(i, selector).toBeGreaterThanOrEqual(0);
  return css.slice(i, css.indexOf('}', i));
};

describe('iOS safe area', () => {
  it('html/body/#root do not pad for the safe area', () => {
    expect(block('html,\nbody,\n#root {')).not.toContain('safe-area-inset');
  });
  it('the app root pads the top inset once', () => {
    expect(block('.bq-app-root {')).toContain('padding-top: env(safe-area-inset-top');
  });
  it('Capacitor does not add its own content inset on top', () => {
    const cfg = JSON.parse(readFileSync(join(__dirname, '../capacitor.config.json'), 'utf8'));
    expect(cfg.ios.contentInset).toBe('never');
  });
});
