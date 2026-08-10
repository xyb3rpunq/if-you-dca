/**
 * Klien Chrome DevTools Protocol yang sangat tipis, khusus untuk bicara dengan
 * TradingView Desktop (Electron) yang dijalankan dengan --remote-debugging-port.
 *
 * Sengaja tanpa dependency: Node >= 22 sudah punya `WebSocket` global.
 */

const DEFAULT_PORT = 9222;

async function listTargets(port) {
  const res = await fetch(`http://127.0.0.1:${port}/json/list`);
  if (!res.ok) throw new Error(`CDP /json/list HTTP ${res.status}`);
  return res.json();
}

/**
 * @param {{ port?: number, timeoutMs?: number }} [opts]
 * @returns {Promise<{ evaluate: (expr: string) => Promise<unknown>, targetUrl: string, close: () => void }>}
 */
export async function connectToChart(opts = {}) {
  const port = opts.port ?? DEFAULT_PORT;
  const timeoutMs = opts.timeoutMs ?? 30_000;

  let targets;
  try {
    targets = await listTargets(port);
  } catch (err) {
    throw new Error(
      `Tidak bisa menghubungi TradingView Desktop di port ${port}.\n` +
        `Jalankan TradingView dengan remote debugging aktif dulu (lihat README bagian "Menarik data dari TradingView").\n` +
        `Detail: ${err.message}`,
    );
  }

  const target = targets.find((t) => t.type === 'page' && /tradingview\.com\/chart/.test(t.url ?? ''));
  if (!target) {
    throw new Error(
      'TradingView terhubung tapi tidak ada tab chart yang terbuka. Buka satu chart dulu, lalu ulangi.',
    );
  }

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timeout membuka koneksi WebSocket CDP')), timeoutMs);
    ws.addEventListener('open', () => { clearTimeout(timer); resolve(); }, { once: true });
    ws.addEventListener('error', () => { clearTimeout(timer); reject(new Error('Gagal membuka WebSocket CDP')); }, { once: true });
  });

  let nextId = 0;
  const pending = new Map();

  ws.addEventListener('message', (event) => {
    let msg;
    try {
      msg = JSON.parse(event.data);
    } catch {
      return;
    }
    const entry = msg.id != null ? pending.get(msg.id) : undefined;
    if (!entry) return;
    pending.delete(msg.id);
    if (msg.error) entry.reject(new Error(`${msg.error.message} (code ${msg.error.code})`));
    else entry.resolve(msg.result);
  });

  ws.addEventListener('close', () => {
    for (const { reject } of pending.values()) reject(new Error('Koneksi CDP tertutup'));
    pending.clear();
  });

  function send(method, params) {
    const id = ++nextId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (pending.delete(id)) reject(new Error(`Timeout CDP: ${method}`));
      }, timeoutMs);
      const settle = (fn) => (value) => { clearTimeout(timer); fn(value); };
      pending.set(id, { resolve: settle(resolve), reject: settle(reject) });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  await send('Runtime.enable', {});

  /** Evaluasi ekspresi JS di halaman; melempar kalau halaman melempar. */
  async function evaluate(expression) {
    const result = await send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (result.exceptionDetails) {
      const d = result.exceptionDetails;
      throw new Error(d.exception?.description ?? d.text ?? 'Error tidak diketahui di halaman');
    }
    return result.result?.value;
  }

  return { evaluate, targetUrl: target.url, close: () => ws.close() };
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
