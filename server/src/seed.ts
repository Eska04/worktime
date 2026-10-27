import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { DateTime } from 'luxon';
import { openDatabase } from './db/database.js';
import { nowISO, TIME_ZONE } from '../../shared/time.js';
const db = openDatabase(process.env.DATABASE_PATH ?? 'server/data/worktime.sqlite');
if ((db.prepare('SELECT count(*) AS n FROM employees').get() as { n: number }).n) {
  console.log('База не пуста. Seed пропущен, существующие данные сохранены.');
} else {
  db.transaction(() => {
    const people = [
      ['Анна Миронова', 'Продуктовый дизайнер'],
      ['Максим Волков', 'Frontend-разработчик'],
      ['София Каримова', 'Менеджер проектов'],
      ['Даниил Соколов', 'Backend-разработчик'],
    ];
    const tasks = [
      'Дизайн личного кабинета',
      'Разработка компонентов',
      'Планирование спринта',
      'Интеграция API',
    ];
    people.forEach(([name, position], i) => {
      const id = randomUUID(),
        now = nowISO();
      db.prepare('INSERT INTO employees VALUES (?,?,?,?,?,NULL)').run(id, name, position, now, now);
      for (let day = 0; day < 7; day++) {
        if ((i + day) % 4 === 0) continue;
        const start = DateTime.now()
          .setZone(TIME_ZONE)
          .minus({ days: day })
          .set({ hour: 9 + i, minute: 0, second: 0, millisecond: 0 });
        const end = start.plus({ minutes: 90 + ((i * 31 + day * 17) % 180) });
        db.prepare('INSERT INTO time_entries VALUES (?,?,?,?,?,?,?)').run(
          randomUUID(),
          id,
          tasks[i],
          start.toUTC().toISO(),
          end.toUTC().toISO(),
          now,
          now,
        );
      }
    });
  })();
  console.log('Созданы 4 вымышленных сотрудника и завершённые сессии за последние 7 дней.');
}
db.close();
