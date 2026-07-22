import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');
const CONTRACT_PATH = resolve(ROOT, 'docs/contracts/evobuddy-tui-visual-contract.md');
const THEME_PATH = resolve(ROOT, 'crates/evobuddy-tui/src/theme.rs');

describe('EvoBuddy TUI visual contract', () => {
  it('exists and locks token names plus visual rules', () => {
    assert.equal(existsSync(CONTRACT_PATH), true, 'visual contract file must exist');
    const contract = readFileSync(CONTRACT_PATH, 'utf8');
    for (const text of [
      'ThemeTokens',
      'bg',
      'surface',
      'surface_alt',
      'border',
      'border_focus',
      'text',
      'text_muted',
      'text_inverse',
      'accent',
      'danger',
      'warning',
      'success',
      'info',
      'action_bar_bg',
      'action_bar_fg',
      'pane_block',
      'action_bar_block',
      'field_style',
      'outer chrome',
      'inner panes',
      'selected row',
      'action bar',
      'status colors',
      'padding',
      'no raw unstyled status line',
    ]) {
      assert.match(contract, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }
  });

  it('documents non-goals for beauty work', () => {
    const contract = readFileSync(CONTRACT_PATH, 'utf8');
    assert.match(contract, /no chat composer/i);
    assert.match(contract, /no embedded agent transcript/i);
    assert.match(contract, /no rainbow decoration/i);
  });

  it('requires theme.rs token API surface', () => {
    const themeSrc = readFileSync(THEME_PATH, 'utf8');
    for (const needle of [
      'pub struct ThemeTokens',
      'pub fn theme()',
      'pub fn pane_block',
      'pub fn action_bar_block',
      'pub fn field_style',
    ]) {
      assert.match(themeSrc, new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }
  });
});
