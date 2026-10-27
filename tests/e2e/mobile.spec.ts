import { test, expect } from '@playwright/test';
import type { Page, APIRequestContext } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { defaultPeriod, today } from '../../shared/time';

test.beforeEach(async ({ request }) => {
  await request.post('/api/settings/reset', { data: { confirm: 'УДАЛИТЬ' } });
  mkdirSync('docs/screenshots', { recursive: true });
});
async function snapshot(page: Page, name: string) {
  await page.screenshot({ path: `docs/screenshots/android-${name}.png` });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
}
async function seed(request: APIRequestContext) {
  const people = [
    ['Алина Саидова', 'Дизайнер'],
    ['Фарид Рахимов', 'Разработчик'],
    ['Мехрона Азимова', 'Менеджер'],
    ['Далер Назаров', 'Тестировщик'],
  ];
  const employees = [];
  for (const [fullName, position] of people) {
    const e = await (await request.post('/api/employees', { data: { fullName, position } })).json();
    employees.push(e);
    await request.post('/api/entries', {
      data: {
        employeeId: e.id,
        description: 'Работа над проектом',
        startedAt: `${today()}T04:00:00Z`,
        endedAt: `${today()}T06:15:00Z`,
      },
    });
  }
  return employees;
}
async function setPeriod(page: Page, startDate: string, endDate: string) {
  await page.locator('.mobile-period summary').click();
  await page.getByLabel('С даты', { exact: true }).fill(startDate);
  await page.getByLabel('По дату', { exact: true }).fill(endDate);
  await page.getByRole('button', { name: 'Применить', exact: true }).click();
}

test('Android: десять состояний макета, запуск/остановка/reload и повторный старт', async ({
  page,
  request,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const people = await seed(request);
  await page.goto('/');
  await expect(
    page.locator('.mobile-metric').first().getByText('09:00', { exact: true }),
  ).toBeVisible();
  await snapshot(page, '01-overview');
  await page
    .getByRole('navigation', { name: 'Мобильная навигация' })
    .getByRole('link', { name: 'Таймер', exact: true })
    .click();
  await expect(page.getByRole('heading', { name: 'Таймер не запущен' })).toBeVisible();
  await expect(page.locator('.timer-ring')).toHaveCount(0);
  await snapshot(page, '02-timer-idle');
  await page.getByRole('link', { name: 'Запустить таймер', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Новая сессия' })).toBeVisible();
  await page.getByRole('combobox', { name: 'Сотрудник' }).selectOption(people[0].id);
  await page.getByLabel('Над чем вы работаете?').fill('Разработка главной страницы');
  await snapshot(page, '04-new-session');
  await page.getByRole('button', { name: 'Запустить таймер', exact: true }).click();
  await expect(page.getByText('Сессия активна', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('Разработка главной страницы', { exact: true })).toBeVisible();
  await expect.poll(() => page.locator('.timer-digits').innerText()).not.toBe('00:00:00');
  await snapshot(page, '03-timer-active');
  await page.getByRole('button', { name: 'Завершить сессию' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Отмена', exact: true }).click();
  await expect(page.getByText('Сессия активна', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Завершить сессию' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Завершить', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Таймер не запущен' })).toBeVisible();
  await page.getByRole('link', { name: 'Запустить таймер', exact: true }).click();
  await page.getByLabel('Над чем вы работаете?').fill('Повторная сессия');
  await page.getByRole('button', { name: 'Запустить таймер', exact: true }).click();
  await expect(page.getByText('Повторная сессия', { exact: true })).toBeVisible();
  await page.goto('/employees');
  await expect(page.getByRole('link', { name: 'Алина Саидова', exact: true })).toBeVisible();
  await snapshot(page, '05-team');
  await page.getByRole('link', { name: 'Добавить сотрудника', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Новый сотрудник' })).toBeVisible();
  await snapshot(page, '06-new-employee');
  await page.getByRole('button', { name: 'Отмена', exact: true }).click();
  await page.goto('/entries');
  await expect(page.getByRole('button', { name: 'Открыть запись Повторная сессия' })).toBeVisible();
  await snapshot(page, '07-entries');
  await page.goto('/reports');
  await expect(page.getByRole('heading', { name: 'Рабочие часы по команде' })).toBeVisible();
  await snapshot(page, '08-reports');
  await page.getByRole('button', { name: 'Фильтр по сотруднику' }).click();
  await page.getByRole('combobox', { name: 'Сотрудник', exact: true }).selectOption(people[0].id);
  await page.getByRole('button', { name: 'Фильтр по сотруднику' }).click();
  await expect(page.getByRole('combobox', { name: 'Сотрудник', exact: true })).toHaveValue(
    people[0].id,
  );
  await setPeriod(page, '2020-01-01', '2020-01-02');
  await expect(page.getByRole('heading', { name: 'Нет записей', exact: true })).toBeVisible();
  await expect(page.getByText('00:00:00', { exact: true })).toBeVisible();
  await snapshot(page, '09-empty-report');
  await page.getByRole('button', { name: 'Сбросить фильтры' }).click();
  await expect(page.getByRole('heading', { name: 'Рабочие часы по команде' })).toBeVisible();
  await page.getByRole('link', { name: 'Настройки', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Хранение данных' })).toBeVisible();
  await snapshot(page, '10-settings');
  expect(errors).toEqual([]);
});

test('Android: создание сотрудника, поиск, отмена и ошибка сети без ложного сохранения', async ({
  page,
  request,
}) => {
  await seed(request);
  await page.goto('/employees');
  await page.getByLabel('Поиск сотрудников').fill('АЛИНА');
  await expect(page.getByRole('link', { name: 'Фарид Рахимов', exact: true })).toHaveCount(0);
  await page.getByRole('link', { name: 'Добавить сотрудника', exact: true }).click();
  await page.getByLabel('Полное имя').fill('Анна Тестовая');
  await page.getByLabel('Должность').fill('Дизайнер');
  await page.getByRole('button', { name: 'Добавить сотрудника', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Анна Тестовая', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Добавить сотрудника', exact: true }).click();
  await page.getByLabel('Полное имя').fill('Несохранённый');
  await page.getByRole('button', { name: 'Отмена', exact: true }).click();
  expect(await (await request.get('/api/employees?search=Несохранённый')).json()).toHaveLength(0);
  await page.getByRole('link', { name: 'Добавить сотрудника', exact: true }).click();
  await page.getByLabel('Полное имя').fill('Ошибка Сети');
  await page.route('**/api/employees', (route) => route.abort());
  await page.getByRole('button', { name: 'Добавить сотрудника', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Нет связи с сервером');
  await expect(page).toHaveURL(/employees\/new/);
  await page.unroute('**/api/employees');
  await page.getByRole('button', { name: 'Отмена', exact: true }).click();
  expect(await (await request.get('/api/employees?search=Ошибка')).json()).toHaveLength(0);
});

test('Android: журнал, фильтры, изменение, CSV и резервное восстановление', async ({
  page,
  request,
}) => {
  const [employee] = await seed(request);
  await page.goto('/entries');
  await page.getByRole('button', { name: 'Новая запись', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('combobox', { name: 'Сотрудник', exact: true })
    .selectOption(employee.id);
  await page.getByLabel('Описание задачи').fill('Ручная задача');
  await page.getByLabel('Начало', { exact: true }).fill(`${today()}T12:00`);
  await page.getByLabel('Окончание', { exact: true }).fill(`${today()}T13:30`);
  await page.getByRole('button', { name: 'Сохранить запись' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Открыть запись Ручная задача' }).click();
  await expect(
    page.getByRole('dialog').locator('.details p').filter({ hasText: 'Длительность' }),
  ).toContainText('01:30:00');
  await page.getByRole('button', { name: 'Редактировать запись Ручная задача' }).click();
  await page.getByLabel('Описание задачи').fill('Обновлённая задача');
  await page.getByRole('button', { name: 'Сохранить запись' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('combobox', { name: 'Сотрудник', exact: true }).selectOption(employee.id);
  await expect(
    page.getByRole('button', { name: 'Открыть запись Работа над проектом' }),
  ).toHaveCount(1);
  await page.goto('/reports');
  await setPeriod(page, defaultPeriod().startDate, defaultPeriod().endDate);
  const csv = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Экспорт CSV' }).click();
  expect((await csv).suggestedFilename()).toBe('worktime.csv');
  await page.goto('/settings');
  const backupDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Резервная копия JSON' }).click();
  expect((await backupDownload).suggestedFilename()).toBe('worktime-backup.json');
  const backup = await (await request.get('/api/backups/export')).json();
  await page.getByRole('button', { name: 'Очистить данные' }).click();
  await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
  await page.getByLabel('Для подтверждения введите УДАЛИТЬ').fill('УДАЛИТЬ');
  await page.getByRole('button', { name: 'Удалить всё' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.locator('input[type=file]').setInputFiles({
    name: 'backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(backup)),
  });
  await page.getByLabel('Введите ЗАМЕНИТЬ').fill('ЗАМЕНИТЬ');
  await page.getByRole('button', { name: 'Заменить данные', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.goto('/entries');
  await page.getByRole('button', { name: 'Открыть запись Обновлённая задача' }).click();
  await page.getByRole('button', { name: 'Удалить запись Обновлённая задача' }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Удалить запись', exact: true })
    .click();
  await expect(page.getByRole('button', { name: 'Открыть запись Обновлённая задача' })).toHaveCount(
    0,
  );
});

test('Android: портретный планшет и длинная задача в карточке', async ({ page, request }) => {
  const [employee] = await seed(request);
  const description = 'Длинное описание задачи '.repeat(6).trim();
  await request.post('/api/entries', {
    data: {
      employeeId: employee.id,
      description,
      startedAt: `${today()}T08:00:00Z`,
      endedAt: `${today()}T09:00:00Z`,
    },
  });
  for (const width of [320, 390, 800]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/entries');
    const row = page.getByRole('button', { name: `Открыть запись ${description}`, exact: true });
    await expect(row).toBeVisible();
    const descriptionBox = await row.locator('.mobile-record-copy>span').boundingBox();
    const timeBox = await row.locator('.mobile-record-time').boundingBox();
    expect(descriptionBox!.x + descriptionBox!.width).toBeLessThanOrEqual(timeBox!.x);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await row.click();
    await expect(page.getByRole('dialog')).toContainText(description);
    await page.getByRole('button', { name: 'Закрыть', exact: true }).click();
  }
  await page.goto('/timer');
  await expect(page.locator('.sidebar')).toBeHidden();
  await expect(page.getByRole('heading', { name: 'Таймер не запущен' })).toBeVisible();
  await page.screenshot({ path: 'docs/screenshots/android-tablet-800.png' });
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(page.locator('.sidebar')).toBeVisible();
});
