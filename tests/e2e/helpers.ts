import { devices, expect, type Browser, type Page } from '@playwright/test';
import type { CategoryId, VoteValue } from '@/lib/domain/types';

const BUTTON: Record<VoteValue, string> = { super: 'Súper antojo', yes: 'Me va', no: 'Paso' };

export async function newPlayer(browser: Browser): Promise<Page> {
  const context = await browser.newContext({ ...devices['Pixel 7'], baseURL: 'http://localhost:3000' });
  return context.newPage();
}

export async function createRoomAs(page: Page, nickname: string): Promise<string> {
  await page.goto('/');
  await page.getByLabel('Tu apodo').fill(nickname);
  await page.getByRole('button', { name: 'Crear sala' }).click();
  await page.waitForURL(/\/j\/[a-z0-9]{8}$/);
  await expect(page.getByText(/Participantes/)).toBeVisible();
  return page.url();
}

export async function joinAs(page: Page, url: string, nickname: string): Promise<void> {
  await page.goto(url);
  await page.getByLabel('Tu apodo').fill(nickname);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByText(/Participantes/)).toBeVisible();
}

/** Vota con botones las tarjetas que le tocan, en el orden en que aparecen. */
export async function voteCards(
  page: Page,
  choices: Partial<Record<CategoryId, VoteValue>>,
  count = 14,
): Promise<CategoryId[]> {
  const seen: CategoryId[] = [];
  for (let i = 0; i < count; i++) {
    const card = page.getByTestId('card');
    await expect(card).toBeVisible();
    const id = (await card.getAttribute('data-category-id')) as CategoryId;
    seen.push(id);
    await page.getByRole('button', { name: BUTTON[choices[id] ?? 'no'], exact: true }).click();
    await expect(page.locator(`[data-testid="card"][data-category-id="${id}"]`)).toHaveCount(0);
  }
  return seen;
}
