# API WorkTime v1

Base URL: `http://127.0.0.1:3001/api`.
Для изменений требуется `Content-Type: application/json`, даже для пустого тела `{}`.
Кросс-доменные браузерные изменения блокируются. Авторизации нет.

Ошибка: `{ "error": { "code": "VALIDATION", "message": "…", "details": [] } }`.
`details` есть у ошибок Zod; в остальных случаях может отсутствовать.
400 — схема/параметры, 403 — origin/demo, 404 — нет сущности, 409 — конфликт,
415 — Content-Type, 422 — архивный сотрудник, 413 — тело больше 20 МБ, 500 — внутренняя ошибка.

## Сотрудники

| Метод  | URL                                       | Данные / результат                                        |
| ------ | ----------------------------------------- | --------------------------------------------------------- |
| GET    | `/health`                                 | `status`, `storage`, `timeZone`, `serverTime`, `demoMode` |
| GET    | `/employees?search=&includeArchived=true` | Массив; поиск по имени/должности без учёта регистра       |
| POST   | `/employees`                              | `{fullName, position?}` → 201 Employee                    |
| GET    | `/employees/:id`                          | Employee или 404                                          |
| PATCH  | `/employees/:id`                          | Любое непустое подмножество `{fullName, position}`        |
| DELETE | `/employees/:id`                          | Архивировать, 200 Employee; 409 при работающем таймере    |
| POST   | `/employees/:id/restore`                  | `{}` → 200 Employee                                       |

`fullName`: trim, 2–120; `position`: trim, до 120; одинаковые имена допустимы.
Employee: `{id, fullName, position, createdAt, updatedAt, archivedAt}`. UUID генерирует сервер.
Физическое удаление сотрудников не используется. Архивная история сохраняется.

## Таймеры и записи

| Метод  | URL                             | Данные / результат                                         |
| ------ | ------------------------------- | ---------------------------------------------------------- |
| GET    | `/timer/active?employeeId=UUID` | Массив активных Entry; фильтр необязателен                 |
| POST   | `/timer/start`                  | `{employeeId, description}` → 201 Entry                    |
| POST   | `/timer/:id/stop`               | `{}` → 200 Entry; повторная остановка 409                  |
| GET    | `/entries`                      | Страница `{items, total, page, pageSize}`                  |
| GET    | `/entries/:id`                  | Entry с именем и вычисленной длительностью                 |
| POST   | `/entries`                      | Завершённая запись → 201 Entry                             |
| PATCH  | `/entries/:id`                  | Непустое подмножество полей завершённой записи → 200 Entry |
| DELETE | `/entries/:id`                  | 204; активная запись — 409                                 |

Старт принимает только UUID сотрудника и описание (trim, 1–160). Метки живого таймера
задаются сервером. Один активный таймер на сотрудника гарантирует частичный индекс SQLite.

Ручная запись:

```json
{
  "employeeId": "UUID-СОТРУДНИКА",
  "description": "Разработка интерфейса",
  "startedAt": "2026-10-26T04:00:00.000Z",
  "endedAt": "2026-10-26T05:30:00.000Z"
}
```

Нужны валидные ISO timestamps с timezone, начало строго раньше конца после нормализации
до секунд. Существующий архивный сотрудник допустим при изменении своей старой записи;
для новых записей и переноса к другому сотруднику нужен неархивный сотрудник.

Entry: `{id, employeeId, description, startedAt, endedAt, createdAt, updatedAt}`.
В списках/подробностях добавляются `fullName`, `position`, для завершённых — `durationSeconds`.

Фильтры журнала: `employeeId`, `startDate`, `endDate`,
`status=all|active|completed`, `page` (от 1), `pageSize` (1–100, по умолчанию 10).
Сессии выбираются по пересечению с календарным периодом Asia/Dushanbe.
Новые записи сверху, затем UUID; активные сессии без окончания пересекают открытую
границу конца, если начались до неё. Длительность в журнале полная, а в отчётах — обрезанная периодом.

## Отчёты и CSV

GET `/reports/summary`, `/reports/daily`, `/reports/by-employee` и `/exports/entries.csv`.
Параметры: `startDate=YYYY-MM-DD`, `endDate=YYYY-MM-DD`, `employeeId=UUID` (опционально).
Без дат — последние 7 календарных дней. Даты включительны в Asia/Dushanbe, максимум 366 дней.

Summary: `{startDate, endDate, totalSeconds, sessionCount, employeeCount, activeDays,
averagePerActiveDay, daily, byEmployee}`.
`daily`: `[{date, seconds}]`, включая нулевые дни.
`byEmployee`: `[{employeeId, fullName, seconds, sessionCount}]` по убыванию времени.
Два других маршрута возвращают соответствующие массивы. Активные сессии исключены.
Пустой результат содержит нули и пустой `byEmployee`.

CSV: UTF-8 с BOM, `;`, все поля в кавычках. Колонки:
Сотрудник; Задача; Начало (UTC); Окончание (UTC); Секунды в выбранном периоде.
Экспортируется только текущий период и сотрудник; значения, похожие на Excel-формулы,
экранируются апострофом. Длительность CSV соответствует сумме отчёта.

## Резервные копии и очистка

- GET `/backups/export` → `{schemaVersion:1, exportedAt, employees:[], entries:[]}`.
  Имена полей в camelCase; без путей SQLite и конфигурации сервера.
- POST `/backups/import` → `{confirm:"ЗАМЕНИТЬ", mode:"replace", backup:{…}}`.
  Проверяются версия, UUID, ссылки, интервалы, уникальность активных таймеров и архив.
  Сначала проверка всего документа, затем замена внутри одной транзакции.
  Ответ: `{employees: число, entries: число}`. Merge не поддерживается.
- POST `/settings/reset` → `{confirm:"УДАЛИТЬ"}`. Ответ `{ok:true}`;
  транзакционное удаление рабочих таблиц. Миграции/схема остаются.

`DEMO_MODE=true` запрещает импорт и очистку (403), экспорт остаётся доступен.
Веб-интерфейс дополнительно запрашивает подтверждения. Работа API покрыта Supertest.
