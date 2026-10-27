import { test, expect } from '@playwright/test';
test('профиль, редактирование, архив и восстановление; ширина 320/768', async ({
  page,
  request,
}) => {
  await request.post('/api/settings/reset', { data: { confirm: 'УДАЛИТЬ' } });
  const e = await (
    await request.post('/api/employees', {
      data: { fullName: 'Анна Тестовая', position: 'Дизайнер' },
    })
  ).json();
  await page.goto(`/employees/${e.id}`);
  await page.getByRole('button', { name: 'Редактировать', exact: true }).click();
  await page.getByLabel('Должность').fill('Ведущий дизайнер');
  await page.getByRole('button', { name: 'Сохранить изменения' }).click();
  await expect(page.getByText('Ведущий дизайнер', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Архивировать', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Подтвердить' }).click();
  await expect(page.getByRole('button', { name: 'Восстановить', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Восстановить', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Подтвердить' }).click();
  await expect(page.getByRole('button', { name: 'Архивировать', exact: true })).toBeVisible();
  for (const width of [320, 768]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of [
      '/',
      '/timer',
      '/employees',
      `/employees/${e.id}`,
      '/entries',
      '/reports',
      '/settings',
    ]) {
      await page.goto(route);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
        `${route} at ${width}px`,
      ).toBe(true);
    }
  }
});
