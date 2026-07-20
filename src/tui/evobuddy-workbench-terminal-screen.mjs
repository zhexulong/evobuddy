export function enterWorkbenchScreen(output) {
  output.write('\u001b[?1049h\u001b[?25l\u001b[?1000h\u001b[?1006h');
}

export function renderWorkbenchScreen(output, text) {
  output.write(`\u001b[H\u001b[2J${text}`);
}

export function exitWorkbenchScreen(output) {
  output.write('\u001b[?1000l\u001b[?1006l\u001b[?25h\u001b[?1049l');
}
