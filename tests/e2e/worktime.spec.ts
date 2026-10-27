import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { defaultPeriod } from '../../shared/time';
test.beforeEach(async ({ request }) => {
  await request.post('/api/settings/reset', { data: { confirm: 'УДАЛИТЬ' } });
});
test('сотрудник → таймер → reload → stop → новая сессия → пустой отчёт', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Добро пожаловать в WorkTime' })).toBeVisible();
  await page.goto('/employees');
  await page.getByRole('button', { name: 'Добавить сотрудника' }).first().click();
  await page.getByLabel('Имя и фамилия').fill('Анна Тестовая');
  await page.getByLabel('Должность').fill('Дизайнер');
  await page.getByRole('dialog').getByRole('button', { name: 'Добавить сотрудника' }).click();
  await expect(page.getByRole('link', { name: 'Анна Тестовая' })).toBeVisible();
  await page.goto('/timer');
  await page.getByLabel('Над чем вы работаете?').fill('Проектирование интерфейса');
  await page.getByRole('button', { name: 'Запустить таймер' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Запустить', exact: true }).click();
  await expect(page.getByText('Таймер работает')).toBeVisible();
  await page.reload();
  await expect(page.getByText('Проектирование интерфейса', { exact: true })).toBeVisible();
  await expect.poll(async () => page.locator('.timer-digits').innerText()).not.toBe('00:00:00');
  mkdirSync('docs/screenshots', { recursive: true });
  await page.screenshot({
    path: `docs/screenshots/timer-${info.project.name}.png`,
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Завершить сессию' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Отмена' }).click();
  await expect(page.getByText('Таймер работает')).toBeVisible();
  await page.getByRole('button', { name: 'Завершить сессию' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Завершить', exact: true }).click();
  await expect(page.getByText('Готов к работе')).toBeVisible();
  await page.getByLabel('Над чем вы работаете?').fill('Новая задача');
  await page.getByRole('button', { name: 'Запустить таймер' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Запустить', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.task-box').getByText('Новая задача', { exact: true })).toBeVisible();
  await page.goto('/entries');
  await expect(page.getByText('Проектирование интерфейса', { exact: true })).toBeVisible();
  await expect(page.getByText('Новая задача', { exact: true })).toBeVisible();
  await page.goto('/reports');
  await page.getByLabel('С даты', { exact: true }).fill('2020-01-01');
  await page.getByLabel('По дату', { exact: true }).fill('2020-01-02');
  await page.getByRole('button', { name: 'Применить' }).click();
  await expect(
    page.getByRole('heading', { name: 'Нет записей за выбранный период' }).first(),
  ).toBeVisible();
  await expect(page.locator('.stat').first().getByText('00:00:00')).toBeVisible();
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
test('ручная запись, изменение, CSV, резервная копия и восстановление', async ({
  page,
  request,
}, info) => {
  const e = await (
    await request.post('/api/employees', {
      data: { fullName: 'Максим Тестовый', position: 'Разработчик' },
    })
  ).json();
  await page.goto('/entries');
  await page.getByRole('button', { name: 'Новая запись', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('combobox', { name: 'Сотрудник', exact: true })
    .selectOption(e.id);
  await page.getByLabel('Описание задачи').fill('Ручная задача');
  await page.getByLabel('Начало', { exact: true }).fill('2026-10-26T09:00');
  await page.getByLabel('Окончание', { exact: true }).fill('2026-10-26T10:30');
  await page.getByRole('button', { name: 'Сохранить запись' }).click();
  await expect(page.getByText('01:30:00', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Редактировать запись Ручная задача' }).click();
  await page.getByLabel('Описание задачи').fill('Обновлённая задача');
  await page.getByRole('button', { name: 'Сохранить запись' }).click();
  await expect(page.getByText('Обновлённая задача', { exact: true })).toBeVisible();
  await page.goto('/reports');
  await page.getByLabel('С даты', { exact: true }).fill('2026-10-26');
  await page.getByLabel('По дату', { exact: true }).fill('2026-10-26');
  await page.getByRole('button', { name: 'Применить' }).click();
  await expect(page.locator('.stat').first().getByText('01:30:00')).toBeVisible();
  const csv = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Экспорт CSV' }).click();
  expect((await csv).suggestedFilename()).toBe('worktime.csv');
  await page.screenshot({
    path: `docs/screenshots/reports-${info.project.name}.png`,
    fullPage: true,
  });
  await page.goto('/settings');
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
  await expect(page.getByText('Обновлённая задача', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Удалить запись Обновлённая задача' }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Удалить запись', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Нет записей за выбранный период' }),
  ).toBeVisible();
});
test('навигация, Esc, поиск и ошибки сети; снимки обзора и команды', async ({
  page,
  request,
}, info) => {
  const people = [
    ['Анна Миронова', 'Дизайнер'],
    ['Максим Волков', 'Разработчик'],
    ['София Каримова', 'Менеджер'],
  ];
  for (const [fullName, position] of people) {
    const e = await (await request.post('/api/employees', { data: { fullName, position } })).json();
    await request.post('/api/entries', {
      data: {
        employeeId: e.id,
        description: 'Работа над проектом',
        startedAt: `${defaultPeriod().endDate}T04:00:00Z`,
        endedAt: `${defaultPeriod().endDate}T06:30:00Z`,
      },
    });
  }
  await page.goto('/');
  await expect(page.locator('.stat').first().getByText('07:30:00')).toBeVisible();
  await page.screenshot({
    path: `docs/screenshots/dashboard-${info.project.name}.png`,
    fullPage: true,
  });
  if (info.project.name === 'mobile') {
    await page
      .getByRole('navigation', { name: 'Мобильная навигация' })
      .getByRole('link', { name: 'Команда' })
      .click();
  } else {
    await page
      .getByRole('navigation', { name: 'Основная навигация' })
      .getByRole('link', { name: 'Сотрудники' })
      .click();
  }
  await expect(page.getByRole('link', { name: 'Анна Миронова' })).toBeVisible();
  await page.screenshot({
    path: `docs/screenshots/employees-${info.project.name}.png`,
    fullPage: true,
  });
  await page.getByLabel('Поиск сотрудников').fill('МИРОНОВА');
  await expect(page.getByRole('link', { name: 'Максим Волков' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Добавить сотрудника' }).click();
  await page.getByLabel('Имя и фамилия').fill('Несохранённый');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Добавить сотрудника' }).click();
  await page.getByLabel('Имя и фамилия').fill('Ошибка Сети');
  await page.route('**/api/employees', (route) => route.abort());
  await page.getByRole('dialog').getByRole('button', { name: 'Добавить сотрудника' }).click();
  await expect(page.getByRole('alert')).toContainText('Нет связи с сервером');
  await expect(page.getByRole('dialog')).toBeVisible();
});
