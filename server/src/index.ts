import 'dotenv/config';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { createApp } from './app.js';
import { openDatabase } from './db/database.js';
const db = openDatabase(process.env.DATABASE_PATH ?? 'server/data/worktime.sqlite');
const staticDir = resolve('dist/client');
const app = createApp(db, {
  demoMode: process.env.DEMO_MODE === 'true',
  staticDir: existsSync(staticDir) ? staticDir : undefined,
});
const port = Number(process.env.PORT ?? 3001),
  host = process.env.HOST ?? '127.0.0.1';
const server = app.listen(port, host, () => console.log(`WorkTime: http://${host}:${port}`));
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.on(signal, () =>
    server.close(() => {
      db.close();
      process.exit(0);
    }),
  );
