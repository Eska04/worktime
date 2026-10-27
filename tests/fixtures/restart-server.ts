import { createApp } from '../../server/src/app.js';
import { openDatabase } from '../../server/src/db/database.js';
const db = openDatabase(process.env.DATABASE_PATH!);
const server = createApp(db).listen(0, '127.0.0.1', () => {
  const addr = server.address();
  if (addr && typeof addr !== 'string') process.send?.(addr.port);
});
process.on('message', (msg) => {
  if (msg === 'stop')
    server.close(() => {
      db.close();
      process.exit(0);
    });
});
