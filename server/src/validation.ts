import { z } from 'zod';
z.config(z.locales.ru());
import { DateTime } from 'luxon';
import { TIME_ZONE } from '../../shared/time.js';
export const idSchema = z.uuid();
export const employeeSchema = z
  .object({
    fullName: z.string().trim().min(2, 'Введите имя: от 2 до 120 символов').max(120),
    position: z.string().trim().max(120).default(''),
  })
  .strict();
export const timerSchema = z
  .object({
    employeeId: idSchema,
    description: z.string().trim().min(1, 'Опишите задачу').max(160),
  })
  .strict();
export const timestamp = z.iso
  .datetime({ offset: true })
  .transform((v) => new Date(Math.floor(Date.parse(v) / 1000) * 1000).toISOString());
export const entrySchema = timerSchema
  .extend({ startedAt: timestamp, endedAt: timestamp })
  .refine((v) => v.startedAt < v.endedAt, {
    message: 'Окончание должно быть позже начала',
    path: ['endedAt'],
  });
export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => DateTime.fromISO(v, { zone: TIME_ZONE }).isValid, 'Некорректная дата');
export const filterSchema = z
  .object({
    employeeId: idSchema.optional(),
    startDate: dateSchema.optional(),
    endDate: dateSchema.optional(),
    status: z.enum(['all', 'active', 'completed']).default('all'),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(10),
  })
  .refine((v) => !v.startDate || !v.endDate || v.startDate <= v.endDate, {
    message: 'Начало периода позже окончания',
    path: ['endDate'],
  });
export const reportSchema = z
  .object({ startDate: dateSchema, endDate: dateSchema, employeeId: idSchema.optional() })
  .refine((v) => v.startDate <= v.endDate, {
    message: 'Начало периода позже окончания',
    path: ['endDate'],
  })
  .refine(
    (v) => DateTime.fromISO(v.endDate).diff(DateTime.fromISO(v.startDate), 'days').days < 366,
    { message: 'Выберите период до 366 дней', path: ['endDate'] },
  );
export const backupSchema = z
  .object({
    schemaVersion: z.literal(1),
    exportedAt: timestamp,
    employees: z
      .array(
        z
          .object({
            id: idSchema,
            fullName: employeeSchema.shape.fullName,
            position: employeeSchema.shape.position,
            createdAt: timestamp,
            updatedAt: timestamp,
            archivedAt: timestamp.nullable(),
          })
          .strict(),
      )
      .max(10000),
    entries: z
      .array(
        z
          .object({
            id: idSchema,
            employeeId: idSchema,
            description: timerSchema.shape.description,
            startedAt: timestamp,
            endedAt: timestamp.nullable(),
            createdAt: timestamp,
            updatedAt: timestamp,
          })
          .strict()
          .refine((v) => !v.endedAt || v.startedAt <= v.endedAt, 'Некорректный интервал'),
      )
      .max(100000),
  })
  .strict()
  .superRefine((v, ctx) => {
    const ids = new Set(v.employees.map((e) => e.id));
    const entryIds = new Set(v.entries.map((e) => e.id));
    const active = new Set<string>();
    if (ids.size !== v.employees.length || entryIds.size !== v.entries.length)
      ctx.addIssue({ code: 'custom', message: 'Повторяющиеся UUID' });
    for (const entry of v.entries) {
      if (!ids.has(entry.employeeId))
        ctx.addIssue({ code: 'custom', message: 'Запись ссылается на отсутствующего сотрудника' });
      if (!entry.endedAt) {
        if (active.has(entry.employeeId))
          ctx.addIssue({ code: 'custom', message: 'Два активных таймера сотрудника' });
        if (v.employees.find((e) => e.id === entry.employeeId)?.archivedAt)
          ctx.addIssue({ code: 'custom', message: 'Активный таймер архивного сотрудника' });
        active.add(entry.employeeId);
      }
    }
  });
