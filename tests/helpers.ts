import { expect, type Page } from '@playwright/test';

export async function enterSetup(page: Page): Promise<void> {
  const teacher = page.getByRole('button', { name: 'Teacher setup', exact: true });
  const setup = page.getByLabel('Crew size');
  await expect(teacher.or(setup)).toBeVisible();
  if (await teacher.isVisible()) await teacher.click();
  await expect(setup).toBeVisible();
}

export async function openSetup(page: Page, url = './'): Promise<void> {
  await page.goto(url);
  await enterSetup(page);
}
