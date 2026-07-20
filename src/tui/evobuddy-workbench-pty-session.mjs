import { spawn } from 'node:child_process';

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function shellQuoteCommand(parts) {
  return parts.map(shellQuote).join(' ');
}

export async function runWorkbenchPtySession({ command, args, cwd, env, inputChunks, timeoutMs = 8000, columns = 120, rows = 40 }) {
  if (process.platform === 'win32') {
    return { status: 'blocked', blockedReasons: ['PTY capability unavailable: script(1) is not supported on win32.'] };
  }

  const stdout = [];
  const stderr = [];

  return await new Promise((resolve) => {
    let settled = false;
    const sizedCommand = `stty cols ${Number(columns)} rows ${Number(rows)}; exec ${shellQuoteCommand([command, ...args])}`;
    const child = spawn('script', ['-qfec', sizedCommand, '/dev/null'], {
      cwd,
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const settle = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ ...result, stdout: stdout.join(''), stderr: stderr.join('') });
    };

    child.stdout.on('data', (chunk) => stdout.push(String(chunk)));
    child.stderr.on('data', (chunk) => stderr.push(String(chunk)));

    for (const { afterMs, data } of inputChunks) {
      setTimeout(() => {
        if (!settled) child.stdin.write(data);
      }, afterMs);
    }

    const finalInputAt = inputChunks.reduce((max, chunk) => Math.max(max, chunk.afterMs), 0);
    setTimeout(() => {
      if (!settled) child.stdin.end();
    }, finalInputAt + 200);

    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      settle({ status: 'blocked', blockedReasons: ['PTY capability timeout while waiting for interactive output.'] });
    }, timeoutMs);

    child.on('close', (code) => {
      settle({ status: 'observed', exitCode: code ?? 0 });
    });

    child.on('error', (error) => {
      settle({ status: 'blocked', blockedReasons: [`PTY capability unavailable: ${error.message}`] });
    });
  });
}
