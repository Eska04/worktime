import express from 'express';
import type { ErrorRequestHandler } from 'express';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { z } from 'zod';
import type { DB } from './db/database.js';
import { EMPLOYEE_COLUMNS, ENTRY_COLUMNS } from './db/database.js';
import {
  employeeSchema,
  timerSchema,
  entrySchema,
  filterSchema,
  reportSchema,
  backupSchema,
  idSchema,
} from './validation.js';
import type { Employee, Entry } from '../../shared/types.js';
import { dayBounds, defaultPeriod, nowISO } from '../../shared/time.js';
import { aggregate } from './modules/reports.js';

class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export function createApp(db: DB, options: { demoMode?: boolean; staticDir?: string } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    next();
  });
  // A localhost application: reject cross-origin writes, including browser form requests.
  app.use('/api', (req, _res, next) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      const origin = req.get('origin');
      if (
        origin &&
        ![
          'http://127.0.0.1:3001',
          'http://localhost:3001',
          'http://127.0.0.1:5173',
          'http://localhost:5173',
          `http://${req.get('host')}`,
        ].includes(origin)
      )
        throw new HttpError(403, 'ORIGIN', 'Запрос с другого сайта запрещён');
      if (!req.is('application/json'))
        throw new HttpError(415, 'CONTENT_TYPE', 'Требуется application/json');
    }
    next();
  });
  app.use(express.json({ limit: '20mb' }));
  const employee = (id: string): Employee => {
    idSchema.parse(id);
    const e = db.prepare(`SELECT ${EMPLOYEE_COLUMNS} FROM employees WHERE id = ?`).get(id) as
      Employee | undefined;
    if (!e) throw new HttpError(404, 'NOT_FOUND', 'Сотрудник не найден');
    return e;
  };
  const activeEmployee = (id: string) => {
    const e = employee(id);
    if (e.archivedAt) throw new HttpError(422, 'ARCHIVED', 'Сотрудник находится в архиве');
    return e;
  };
  const entry = (id: string): Entry => {
    idSchema.parse(id);
    const e = db
      .prepare(
        `SELECT ${ENTRY_COLUMNS}, e.full_name AS fullName, e.position FROM time_entries t JOIN employees e ON e.id=t.employee_id WHERE t.id=?`,
      )
      .get(id) as Entry | undefined;
    if (!e) throw new HttpError(404, 'NOT_FOUND', 'Запись не найдена');
    return {
      ...e,
      durationSeconds: e.endedAt
        ? (Date.parse(e.endedAt) - Date.parse(e.startedAt)) / 1000
        : undefined,
    };
  };
  const completed = (id: string) => {
    const e = entry(id);
    if (!e.endedAt) throw new HttpError(409, 'ACTIVE_ENTRY', 'Сначала завершите активный таймер');
    return e;
  };
  const insertEntry = db.prepare(
    'INSERT INTO time_entries (id, employee_id, description, started_at, ended_at, created_at, updated_at) VALUES (@id,@employeeId,@description,@startedAt,@endedAt,@createdAt,@updatedAt)',
  );
  const insertEmployee = db.prepare(
    'INSERT INTO employees (id,full_name,position,created_at,updated_at,archived_at) VALUES (@id,@fullName,@position,@createdAt,@updatedAt,@archivedAt)',
  );
  app.get('/api/health', (_req, res) => {
    db.prepare('SELECT 1').get();
    res.json({
      status: 'ok',
      storage: 'SQLite',
      timeZone: 'Asia/Dushanbe',
      demoMode: !!options.demoMode,
      serverTime: nowISO(),
    });
  });
  app.get('/api/employees', (req, res) => {
    const { search, includeArchived } = z
      .object({
        search: z.string().max(200).default(''),
        includeArchived: z.enum(['true', 'false']).default('false'),
      })
      .parse(req.query);
    const list = db
      .prepare(
        `SELECT ${EMPLOYEE_COLUMNS} FROM employees ${includeArchived === 'true' ? '' : 'WHERE archived_at IS NULL'} ORDER BY created_at, id`,
      )
      .all() as Employee[];
    const q = search.toLocaleLowerCase('ru').trim();
    res.json(list.filter((e) => `${e.fullName} ${e.position}`.toLocaleLowerCase('ru').includes(q)));
  });
  app.post('/api/employees', (req, res) => {
    const data = employeeSchema.parse(req.body),
      now = nowISO();
    const e = { ...data, id: randomUUID(), createdAt: now, updatedAt: now, archivedAt: null };
    insertEmployee.run(e);
    res.status(201).json(e);
  });
  app.get('/api/employees/:id', (req, res) => res.json(employee(req.params.id)));
  app.patch('/api/employees/:id', (req, res) => {
    employee(req.params.id);
    const patch = employeeSchema
      .partial()
      .refine((v) => Object.keys(v).length > 0, 'Нет полей для изменения')
      .parse(req.body);
    const e = { ...employee(req.params.id), ...patch, updatedAt: nowISO() };
    db.prepare(
      'UPDATE employees SET full_name=@fullName,position=@position,updated_at=@updatedAt WHERE id=@id',
    ).run(e);
    res.json(employee(e.id));
  });
  app.delete('/api/employees/:id', (req, res) => {
    employee(req.params.id);
    if (
      db
        .prepare('SELECT 1 FROM time_entries WHERE employee_id=? AND ended_at IS NULL')
        .get(req.params.id)
    )
      throw new HttpError(409, 'ACTIVE_TIMER', 'Завершите таймер перед архивированием');
    const now = nowISO();
    db.prepare('UPDATE employees SET archived_at=?,updated_at=? WHERE id=?').run(
      now,
      now,
      req.params.id,
    );
    res.json(employee(req.params.id));
  });
  app.post('/api/employees/:id/restore', (req, res) => {
    employee(req.params.id);
    db.prepare('UPDATE employees SET archived_at=NULL,updated_at=? WHERE id=?').run(
      nowISO(),
      req.params.id,
    );
    res.json(employee(req.params.id));
  });
  app.get('/api/timer/active', (req, res) => {
    const { employeeId } = z.object({ employeeId: idSchema.optional() }).parse(req.query);
    res.json(
      db
        .prepare(
          `SELECT ${ENTRY_COLUMNS}, e.full_name AS fullName, e.position FROM time_entries t JOIN employees e ON e.id=t.employee_id WHERE t.ended_at IS NULL ${employeeId ? 'AND t.employee_id=?' : ''} ORDER BY t.started_at`,
        )
        .all(...(employeeId ? [employeeId] : [])),
    );
  });
  app.post('/api/timer/start', (req, res) => {
    const data = timerSchema.parse(req.body);
    const result = db
      .transaction(() => {
        activeEmployee(data.employeeId);
        if (
          db
            .prepare('SELECT 1 FROM time_entries WHERE employee_id=? AND ended_at IS NULL')
            .get(data.employeeId)
        )
          throw new HttpError(409, 'TIMER_RUNNING', 'У сотрудника уже запущен таймер');
        const now = nowISO(),
          id = randomUUID();
        insertEntry.run({
          ...data,
          id,
          startedAt: now,
          endedAt: null,
          createdAt: now,
          updatedAt: now,
        });
        return entry(id);
      })
      .immediate();
    res.status(201).json(result);
  });
  app.post('/api/timer/:id/stop', (req, res) => {
    const current = entry(req.params.id),
      now = nowISO();
    if (current.startedAt > now)
      throw new HttpError(409, 'CLOCK', 'Время сервера раньше начала таймера. Проверьте часы');
    const result = db
      .prepare('UPDATE time_entries SET ended_at=?,updated_at=? WHERE id=? AND ended_at IS NULL')
      .run(now, now, req.params.id);
    if (!result.changes) throw new HttpError(409, 'TIMER_STOPPED', 'Таймер уже завершён');
    res.json(entry(req.params.id));
  });
  app.get('/api/entries', (req, res) => {
    const f = filterSchema.parse(req.query),
      where: string[] = [],
      values: (string | number)[] = [];
    if (f.employeeId) {
      where.push('t.employee_id=?');
      values.push(f.employeeId);
    }
    if (f.status !== 'all') where.push(`t.ended_at IS ${f.status === 'active' ? '' : 'NOT'} NULL`);
    if (f.startDate) {
      where.push(
        '(t.ended_at IS NULL OR t.ended_at>? OR (t.started_at=t.ended_at AND t.started_at>=?))',
      );
      values.push(
        new Date(dayBounds(f.startDate).start).toISOString(),
        new Date(dayBounds(f.startDate).start).toISOString(),
      );
    }
    if (f.endDate) {
      where.push('t.started_at<?');
      values.push(new Date(dayBounds(f.endDate).end).toISOString());
    }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const total = (
      db.prepare(`SELECT count(*) AS count FROM time_entries t ${clause}`).get(...values) as {
        count: number;
      }
    ).count;
    const items = db
      .prepare(
        `SELECT ${ENTRY_COLUMNS},e.full_name AS fullName,e.position FROM time_entries t JOIN employees e ON e.id=t.employee_id ${clause} ORDER BY t.started_at DESC,t.id LIMIT ? OFFSET ?`,
      )
      .all(...values, f.pageSize, (f.page - 1) * f.pageSize) as Entry[];
    res.json({
      items: items.map((e) => ({
        ...e,
        durationSeconds: e.endedAt
          ? (Date.parse(e.endedAt) - Date.parse(e.startedAt)) / 1000
          : undefined,
      })),
      total,
      page: f.page,
      pageSize: f.pageSize,
    });
  });
  app.get('/api/entries/:id', (req, res) => res.json(entry(req.params.id)));
  app.post('/api/entries', (req, res) => {
    const data = entrySchema.parse(req.body);
    activeEmployee(data.employeeId);
    const id = randomUUID(),
      now = nowISO();
    insertEntry.run({ ...data, id, createdAt: now, updatedAt: now });
    res.status(201).json(entry(id));
  });
  app.patch('/api/entries/:id', (req, res) => {
    const old = completed(req.params.id);
    const patch = z
      .object({
        employeeId: timerSchema.shape.employeeId.optional(),
        description: timerSchema.shape.description.optional(),
        startedAt: entrySchema.shape.startedAt.optional(),
        endedAt: entrySchema.shape.endedAt.optional(),
      })
      .strict()
      .refine((v) => Object.keys(v).length > 0)
      .parse(req.body);
    const data = entrySchema.parse({
      employeeId: old.employeeId,
      description: old.description,
      startedAt: old.startedAt,
      endedAt: old.endedAt,
      ...patch,
    });
    if (data.employeeId !== old.employeeId) activeEmployee(data.employeeId);
    db.prepare(
      'UPDATE time_entries SET employee_id=@employeeId,description=@description,started_at=@startedAt,ended_at=@endedAt,updated_at=@updatedAt WHERE id=@id',
    ).run({ ...data, id: old.id, updatedAt: nowISO() });
    res.json(entry(old.id));
  });
  app.delete('/api/entries/:id', (req, res) => {
    completed(req.params.id);
    db.prepare('DELETE FROM time_entries WHERE id=?').run(req.params.id);
    res.status(204).end();
  });
  const report = (query: unknown) => {
    const filters = reportSchema.parse(query);
    if (filters.employeeId) employee(filters.employeeId);
    const entries = db
      .prepare(
        `SELECT ${ENTRY_COLUMNS},e.full_name AS fullName FROM time_entries t JOIN employees e ON e.id=t.employee_id WHERE t.ended_at IS NOT NULL AND t.started_at<? AND (t.ended_at>? OR (t.started_at=t.ended_at AND t.started_at>=?)) ${filters.employeeId ? 'AND t.employee_id=?' : ''}`,
      )
      .all(
        new Date(dayBounds(filters.endDate).end).toISOString(),
        new Date(dayBounds(filters.startDate).start).toISOString(),
        new Date(dayBounds(filters.startDate).start).toISOString(),
        ...(filters.employeeId ? [filters.employeeId] : []),
      ) as Entry[];
    return { filters, entries, result: aggregate(entries, filters.startDate, filters.endDate) };
  };
  for (const kind of ['summary', 'daily', 'by-employee'])
    app.get(`/api/reports/${kind}`, (req, res) => {
      const { result } = report({ ...defaultPeriod(), ...req.query });
      res.json(kind === 'summary' ? result : kind === 'daily' ? result.daily : result.byEmployee);
    });
  app.get('/api/exports/entries.csv', (req, res) => {
    const { entries, filters } = report({ ...defaultPeriod(), ...req.query });
    const safeCell = (v: string | number) =>
      `"${String(v)
        .replace(/^[=+@\-\t\r]/, "'$&")
        .replaceAll('"', '""')}"`;
    const start = dayBounds(filters.startDate).start,
      end = dayBounds(filters.endDate).end;
    const rows = [
      ['Сотрудник', 'Задача', 'Начало (UTC)', 'Окончание (UTC)', 'Секунды в выбранном периоде'],
      ...entries.map((e) => [
        e.fullName!,
        e.description,
        e.startedAt,
        e.endedAt!,
        Math.max(
          0,
          (Math.min(Date.parse(e.endedAt!), end) - Math.max(Date.parse(e.startedAt), start)) / 1000,
        ),
      ]),
    ];
    res.setHeader('Content-Disposition', 'attachment; filename="worktime.csv"');
    res
      .type('text/csv; charset=utf-8')
      .send('\uFEFF' + rows.map((r) => r.map(safeCell).join(';')).join('\r\n'));
  });
  app.get('/api/backups/export', (_req, res) =>
    res.json({
      schemaVersion: 1,
      exportedAt: nowISO(),
      employees: db.prepare(`SELECT ${EMPLOYEE_COLUMNS} FROM employees`).all(),
      entries: db.prepare(`SELECT ${ENTRY_COLUMNS} FROM time_entries t`).all(),
    }),
  );
  const allowDestructive = () => {
    if (options.demoMode)
      throw new HttpError(403, 'DEMO_MODE', 'Импорт и очистка отключены в демо-режиме');
  };
  app.post('/api/backups/import', (req, res) => {
    allowDestructive();
    const { backup } = z
      .object({ confirm: z.literal('ЗАМЕНИТЬ'), mode: z.literal('replace'), backup: backupSchema })
      .strict()
      .parse(req.body);
    db.transaction(() => {
      db.exec('DELETE FROM time_entries; DELETE FROM employees;');
      backup.employees.forEach((e) => insertEmployee.run(e));
      backup.entries.forEach((e) => insertEntry.run(e));
    }).immediate();
    res.json({ employees: backup.employees.length, entries: backup.entries.length });
  });
  app.post('/api/settings/reset', (req, res) => {
    allowDestructive();
    z.object({ confirm: z.literal('УДАЛИТЬ') })
      .strict()
      .parse(req.body);
    db.transaction(() => db.exec('DELETE FROM time_entries; DELETE FROM employees;')).immediate();
    res.json({ ok: true });
  });
  app.use('/api', (_req, _res, next) =>
    next(new HttpError(404, 'NOT_FOUND', 'Метод API не найден')),
  );
  if (options.staticDir) {
    app.use(express.static(options.staticDir));
    app.get('/{*path}', (_req, res) => res.sendFile(resolve(options.staticDir!, 'index.html')));
  }
  const onError: ErrorRequestHandler = (err, _req, res, _next) => {
    void _next; // Express recognises error middleware by its four-argument signature.
    if (err?.type === 'entity.too.large') {
      res
        .status(413)
        .json({ error: { code: 'TOO_LARGE', message: 'Слишком большой файл (максимум 20 МБ)' } });
      return;
    }
    if (err instanceof z.ZodError) {
      res.status(400).json({
        error: {
          code: 'VALIDATION',
          message: err.issues[0]?.message ?? 'Проверьте поля',
          details: err.issues,
        },
      });
      return;
    }
    if (err instanceof HttpError) {
      res.status(err.status).json({ error: { code: err.code, message: err.message } });
      return;
    }
    if (err instanceof SyntaxError && 'body' in err) {
      res.status(400).json({ error: { code: 'INVALID_JSON', message: 'Повреждённый JSON' } });
      return;
    }
    if (err?.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      res.status(409).json({
        error: { code: 'CONFLICT', message: 'Данные конфликтуют с существующей записью' },
      });
      return;
    }
    console.error(err);
    res.status(500).json({
      error: { code: 'INTERNAL', message: 'Не удалось выполнить операцию. Попробуйте ещё раз' },
    });
  };
  app.use(onError);
  return app;
}
