import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { enterWorkbenchScreen, renderWorkbenchScreen, exitWorkbenchScreen } from '../../src/tui/evobuddy-workbench-terminal-screen.mjs';

describe('evobuddy workbench terminal screen', () => {
  it('writes alternate-screen enter, repaint, and cleanup bytes', () => {
    const writes = [];
    const output = { write(chunk) { writes.push(String(chunk)); } };

    enterWorkbenchScreen(output);
    renderWorkbenchScreen(output, 'hello');
    exitWorkbenchScreen(output);

    assert.equal(writes[0], '\u001b[?1049h\u001b[?25l\u001b[?1000h\u001b[?1006h');
    assert.equal(writes[1], '\u001b[H\u001b[2Jhello');
    assert.equal(writes[2], '\u001b[?1000l\u001b[?1006l\u001b[?25h\u001b[?1049l');
  });

  it('repaints the live Team surface content without mutating workbench text', () => {
    const writes = [];
    const output = { write(chunk) { writes.push(String(chunk)); } };
    const liveSurface = 'TaskRoom: live\nCurrent owner: reviewer\nFork lineage\n- parent -> builder\nPending handoffs\n- builder -> reviewer\n';

    renderWorkbenchScreen(output, liveSurface);

    assert.equal(writes[0], `\u001b[H\u001b[2J${liveSurface}`);
    assert.match(writes[0], /Current owner: reviewer/);
    assert.match(writes[0], /Fork lineage/);
    assert.match(writes[0], /Pending handoffs/);
  });
});
