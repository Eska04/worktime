import { it, expect } from 'vitest';
import { fork } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
it('T09: реальный перезапуск Node.js сохраняет активную сессию и завершённую историю', async () => {
  mkdirSync('.cache', { recursive: true });
  const dir = mkdtempSync(resolve('.cache/process-'));
  let child: ChildProcess | undefined;
  const launch = async () => {
    child = fork(resolve('tests/fixtures/restart-server.ts'), [], {
      execArgv: ['--import', 'tsx'],
      env: { ...process.env, DATABASE_PATH: resolve(dir, 'data.sqlite') },
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    });
    const [port] = await once(child, 'message');
    return `http://127.0.0.1:${port}/api`;
  };
  const stop = async () => {
    const close = once(child!, 'exit');
    child!.send('stop');
    await close;
    child = undefined;
  };
  const post = async (url: string, data: unknown) => {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    expect(res.ok).toBe(true);
    return res.json();
  };
  try {
    let base = await launch();
    const employee = await post(`${base}/employees`, { fullName: 'Проверка Перезапуска' });
    const timer = await post(`${base}/timer/start`, {
      employeeId: employee.id,
      description: 'Сохранить активную сессию',
    });
    await stop();
    base = await launch();
    const active = await (await fetch(`${base}/timer/active`)).json();
    expect(active[0].startedAt).toBe(timer.startedAt);
    expect(active[0].id).toBe(timer.id);
    await post(`${base}/timer/${timer.id}/stop`, {});
    await stop();
    base = await launch();
    const saved = await (await fetch(`${base}/entries/${timer.id}`)).json();
    expect(saved.endedAt).not.toBeNull();
    expect(saved.employeeId).toBe(employee.id);
    expect((await (await fetch(`${base}/employees`)).json()).length).toBe(1);
  } finally {
    if (child) await stop();
    rmSync(dir, { recursive: true, force: true });
  }
}, 20000);
