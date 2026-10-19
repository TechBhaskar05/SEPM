import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';
import { describe, expect, it } from 'vitest';

import tailwindConfig from '../../../tailwind.config.js';

const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8');

function ruleBody(source, selector) {
  const selectorIndex = source.indexOf(`${selector} {`);
  if (selectorIndex === -1) throw new Error(`Missing ${selector} rule`);

  const open = source.indexOf('{', selectorIndex);
  let depth = 0;

  for (let index = open; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(open + 1, index);
    }
  }

  throw new Error(`Unclosed ${selector} rule`);
}

function token(body, name) {
  const match = body.match(new RegExp(`${name}:\\s*([^;]+);`));
  return match?.[1].trim();
}

const light = ruleBody(css, ':root');
const dark = ruleBody(css, '.dark');

describe('warning badge theme tokens', () => {
  it('defines distinct light and dark warning badge fills', () => {
    expect(token(light, '--c-warning-subtle')).toBe('#fffbeb');
    expect(token(dark, '--c-warning-subtle')).toBe('#78350f');
  });

  it('defines readable warning text on those fills in both themes', () => {
    expect(token(light, '--c-warning-on-subtle')).toBe('#b45309');
    expect(token(dark, '--c-warning-on-subtle')).toBe('#fcd34d');
  });

  it('wires the badge classes to the per-theme tokens', () => {
    const warning = tailwindConfig.theme.extend.colors.warning;

    expect(warning.subtle).toBe('var(--c-warning-subtle)');
    expect(warning['on-subtle']).toBe('var(--c-warning-on-subtle)');
  });
});
