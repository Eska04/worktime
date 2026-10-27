import { it, expect, afterEach } from 'vitest';
import request from 'supertest';
import { openDatabase } from '../server/src/db/database.js';
import { createApp } from '../server/src/app.js';
const db = openDatabase(':memory:');
const app = createApp(db);
afterEach(() => {
  db.exec('DELETE FROM time_entries; DELETE FROM employees;');
});
it('профиль, частичное редактирование, архив, восстановление и отчёт по сотрудникам', async () => {
  const e = (await request(app).post('/api/employees').send({ fullName: 'Анна Тестовая' })).body;
  await request(app).patch(`/api/employees/${e.id}`).send({ position: 'Разработчик' }).expect(200);
  expect((await request(app).get(`/api/employees/${e.id}`)).body.position).toBe('Разработчик');
  await request(app).delete(`/api/employees/${e.id}`).send({}).expect(200);
  expect((await request(app).get('/api/employees')).body).toHaveLength(0);
  expect((await request(app).get('/api/employees?includeArchived=true')).body).toHaveLength(1);
  await request(app).post(`/api/employees/${e.id}/restore`).send({}).expect(200);
  await request(app).get('/api/reports/daily').expect(200);
  await request(app).get('/api/reports/by-employee').expect(200);
  expect((await request(app).get('/api/health')).body.storage).toBe('SQLite');
});
it('backup → reset → import, повреждённый импорт не меняет текущие данные', async () => {
  const e = (await request(app).post('/api/employees').send({ fullName: 'Анна Тестовая' })).body;
  await request(app)
    .post('/api/timer/start')
    .send({ employeeId: e.id, description: 'Работа' })
    .expect(201);
  const backup = (await request(app).get('/api/backups/export').expect(200)).body;
  await request(app).post('/api/settings/reset').send({ confirm: 'нет' }).expect(400);
  await request(app).post('/api/settings/reset').send({ confirm: 'УДАЛИТЬ' }).expect(200);
  await request(app)
    .post('/api/backups/import')
    .send({ confirm: 'ЗАМЕНИТЬ', mode: 'replace', backup })
    .expect(200);
  expect((await request(app).get('/api/timer/active')).body[0].id).toBe(backup.entries[0].id);
  for (const broken of [
    { ...backup, schemaVersion: 2 },
    { ...backup, employees: [] },
    { ...backup, entries: [...backup.entries, ...backup.entries] },
  ]) {
    await request(app)
      .post('/api/backups/import')
      .send({ confirm: 'ЗАМЕНИТЬ', mode: 'replace', backup: broken })
      .expect(400);
    expect((await request(app).get('/api/employees')).body[0].id).toBe(e.id);
  }
});
it('демо-режим и cross-origin защита', async () => {
  const demo = createApp(db, { demoMode: true });
  await request(demo).post('/api/settings/reset').send({ confirm: 'УДАЛИТЬ' }).expect(403);
  await request(demo).post('/api/backups/import').send({}).expect(403);
  await request(app)
    .post('/api/employees')
    .set('Origin', 'https://example.com')
    .send({ fullName: 'Тест' })
    .expect(403);
  await request(app).post('/api/employees').type('form').send({ fullName: 'Тест' }).expect(415);
  await request(app)
    .post('/api/employees')
    .set('Content-Type', 'application/json')
    .send('{bad')
    .expect(400);
  await request(app).get('/api/unknown').expect(404);
});
