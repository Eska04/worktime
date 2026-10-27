import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { openDatabase } from '../server/src/db/database.js';
import { createApp } from '../server/src/app.js';
import { aggregate } from '../server/src/modules/reports.js';
import { randomUUID } from 'node:crypto';

let dir: string, db: ReturnType<typeof openDatabase>, app: ReturnType<typeof createApp>;
beforeEach(() => {
  mkdirSync('.cache', { recursive: true });
  dir = mkdtempSync(join(process.cwd(), '.cache/test-'));
  db = openDatabase(join(dir, 'test.sqlite'));
  app = createApp(db);
});
afterEach(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
});
const employee = async (fullName = 'Анна Тестовая') =>
  (await request(app).post('/api/employees').send({ fullName, position: 'Дизайнер' }).expect(201))
    .body;
const start = (employeeId: string) =>
  request(app).post('/api/timer/start').send({ employeeId, description: 'Работа над проектом' });
const manual = (
  employeeId: string,
  startedAt = '2026-10-26T18:50:00Z',
  endedAt = '2026-10-26T19:20:00Z',
) =>
  request(app).post('/api/entries').send({ employeeId, description: 'Задача', startedAt, endedAt });

describe('P0: сотрудники и долговечный таймер', () => {
  it('T01–T04: пустая база, создание, одинаковые имена, серверная валидация', async () => {
    expect((await request(app).get('/api/employees').expect(200)).body).toEqual([]);
    const a = await employee(),
      b = await employee();
    expect(a.id).not.toBe(b.id);
    await request(app).post('/api/employees').send({ fullName: ' ' }).expect(400);
    expect((await request(app).get('/api/employees?search=АННА').expect(200)).body).toHaveLength(2);
  });
  it('T05–T12: старт, конкурентные дубли, другой сотрудник, restart, stop и повторный старт', async () => {
    const a = await employee(),
      b = await employee('Борис Тестовый');
    const results = await Promise.all([start(a.id), start(a.id), start(a.id)]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409, 409]);
    const first = results.find((r) => r.status === 201)!.body;
    await start(b.id).expect(201);
    db.close();
    db = openDatabase(join(dir, 'test.sqlite'));
    app = createApp(db);
    const running = (await request(app).get('/api/timer/active').expect(200)).body;
    expect(running).toHaveLength(2);
    expect(running.find((e: { id: string }) => e.id === first.id).startedAt).toBe(first.startedAt);
    const stopped = (await request(app).post(`/api/timer/${first.id}/stop`).send({}).expect(200))
      .body;
    expect(stopped.durationSeconds).toBeGreaterThanOrEqual(0);
    await request(app).post(`/api/timer/${first.id}/stop`).send({}).expect(409);
    const next = (await start(a.id).expect(201)).body;
    expect(next.id).not.toBe(first.id);
    expect((await request(app).get(`/api/entries?employeeId=${a.id}`).expect(200)).body.total).toBe(
      2,
    );
  });
  it('T17: сохранённые сотрудники и завершённые записи переживают повторное открытие БД', async () => {
    const e = await employee();
    const t = (await manual(e.id).expect(201)).body;
    db.close();
    db = openDatabase(join(dir, 'test.sqlite'));
    app = createApp(db);
    expect((await request(app).get(`/api/entries/${t.id}`).expect(200)).body.employeeId).toBe(e.id);
    expect((await request(app).get('/api/employees')).body).toHaveLength(1);
  });
  it('не принимает пустые/длинные задачи, неизвестного и архивного сотрудника', async () => {
    const e = await employee();
    await request(app)
      .post('/api/timer/start')
      .send({ employeeId: e.id, description: ' ' })
      .expect(400);
    await request(app)
      .post('/api/timer/start')
      .send({ employeeId: e.id, description: 'x'.repeat(161) })
      .expect(400);
    await start(randomUUID()).expect(404);
    await request(app).delete(`/api/employees/${e.id}`).send({}).expect(200);
    await start(e.id).expect(422);
  });
});
describe('Отчёты, интервалы и записи', () => {
  it('нулевая сессия на локальной полуночи учитывается ровно в одном дне без NaN', async () => {
    const e = await employee(),
      id = randomUUID(),
      instant = '2026-10-25T19:00:00.000Z';
    db.prepare('INSERT INTO time_entries VALUES (?,?,?,?,?,?,?)').run(
      id,
      e.id,
      'Короткая сессия',
      instant,
      instant,
      instant,
      instant,
    );
    const r = (
      await request(app)
        .get('/api/reports/summary?startDate=2026-10-26&endDate=2026-10-26')
        .expect(200)
    ).body;
    expect(r.totalSeconds).toBe(0);
    expect(r.sessionCount).toBe(1);
    expect(r.activeDays).toBe(1);
    expect(r.averagePerActiveDay).toBe(0);
    expect(r.byEmployee[0].seconds).toBe(0);
    expect(
      (await request(app).get('/api/entries?startDate=2026-10-26&endDate=2026-10-26')).body.total,
    ).toBe(1);
    expect(
      (await request(app).get('/api/reports/summary?startDate=2026-10-25&endDate=2026-10-25')).body
        .sessionCount,
    ).toBe(0);
  });
  it('T13–T16: локальная полночь 23:50–00:20, пересечение периода, фильтр и пустой отчёт', async () => {
    const e = await employee(),
      other = await employee('Другой Сотрудник');
    await manual(e.id).expect(201);
    await manual(other.id).expect(201);
    const url = `/api/reports/summary?employeeId=${e.id}&startDate=2026-10-26&endDate=2026-10-27`;
    const r = (await request(app).get(url).expect(200)).body;
    expect(r.totalSeconds).toBe(1800);
    expect(r.daily.map((d: { seconds: number }) => d.seconds)).toEqual([600, 1200]);
    expect(r.sessionCount).toBe(1);
    expect(
      (
        await request(app).get(
          `/api/reports/summary?employeeId=${e.id}&startDate=2026-10-27&endDate=2026-10-27`,
        )
      ).body.totalSeconds,
    ).toBe(1200);
    const empty = (
      await request(app)
        .get('/api/reports/summary?startDate=2026-01-01&endDate=2026-01-02')
        .expect(200)
    ).body;
    expect(empty.totalSeconds).toBe(0);
    expect(empty.averagePerActiveDay).toBe(0);
    expect(empty.byEmployee).toEqual([]);
  });
  it('исключает активные сессии, отвергает неверные даты и диапазоны', async () => {
    const e = await employee();
    await start(e.id).expect(201);
    expect((await request(app).get('/api/reports/summary')).body.totalSeconds).toBe(0);
    for (const q of [
      'startDate=2026-02-30&endDate=2026-03-01',
      'startDate=2026-11-01&endDate=2026-10-01',
      'startDate=2020-01-01&endDate=2026-01-01',
    ])
      await request(app).get(`/api/reports/summary?${q}`).expect(400);
    await request(app).get('/api/entries?page=-1').expect(400);
  });
  it('T18: ручное создание, обновление, подробности, пагинация, фильтры и удаление', async () => {
    const e = await employee();
    const t = (await manual(e.id).expect(201)).body;
    await manual(e.id, '2026-10-26T20:00:00Z', '2026-10-26T19:00:00Z').expect(400);
    await request(app)
      .patch(`/api/entries/${t.id}`)
      .send({ description: 'Исправлено', endedAt: '2026-10-26T19:50:00Z' })
      .expect(200);
    const one = (await request(app).get(`/api/entries/${t.id}`)).body;
    expect(one.durationSeconds).toBe(3600);
    const page = (
      await request(app)
        .get(
          `/api/entries?status=completed&employeeId=${e.id}&startDate=2026-10-26&endDate=2026-10-27&pageSize=1&page=2`,
        )
        .expect(200)
    ).body;
    expect(page.total).toBe(1);
    expect(page.items).toEqual([]);
    await request(app).delete(`/api/entries/${t.id}`).send({}).expect(204);
    await request(app).get(`/api/entries/${t.id}`).expect(404);
  });
  it('запрещает редактировать/удалять активную запись и архивировать работающего сотрудника', async () => {
    const e = await employee(),
      t = (await start(e.id)).body;
    await request(app).patch(`/api/entries/${t.id}`).send({ description: 'Изменение' }).expect(409);
    await request(app).delete(`/api/entries/${t.id}`).send({}).expect(409);
    await request(app).delete(`/api/employees/${e.id}`).send({}).expect(409);
  });
  it('T19: CSV BOM, кириллица, выбранный период, экранирование формул', async () => {
    const e = await employee('=Анна Тестовая');
    await manual(e.id).expect(201);
    const csv = await request(app)
      .get(`/api/exports/entries.csv?employeeId=${e.id}&startDate=2026-10-27&endDate=2026-10-27`)
      .expect(200);
    expect(csv.text.charCodeAt(0)).toBe(0xfeff);
    expect(csv.text).toContain("'=Анна");
    expect(csv.text).toContain('1200');
  });
  it('дневные суммы равны итогу для секундной точности и многодневной сессии', () => {
    const r = aggregate(
      [
        {
          id: '1',
          employeeId: '1',
          description: '',
          createdAt: '',
          updatedAt: '',
          startedAt: '2026-10-25T18:59:59.000Z',
          endedAt: '2026-10-27T19:00:01.000Z',
        },
      ],
      '2026-10-26',
      '2026-10-27',
    );
    expect(r.totalSeconds).toBe(172800);
    expect(r.daily.reduce((s, d) => s + d.seconds, 0)).toBe(r.totalSeconds);
  });
});
