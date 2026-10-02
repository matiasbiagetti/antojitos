import { expect, test } from '@playwright/test';
import { joinAs, newPlayer } from './helpers';

test('picking an avatar shows it to the other players', async ({ browser }) => {
  const [host, guest] = await Promise.all([newPlayer(browser), newPlayer(browser)]);
  const hydrationErrors: string[] = [];
  host.on('console', (m) => {
    if (m.type() === 'error' && /hydrat/i.test(m.text())) hydrationErrors.push(m.text());
  });

  await host.goto('/');
  const avatarButton = host.getByRole('button', { name: 'Elegir avatar' });
  await expect(avatarButton.locator('img')).toHaveAttribute('src', /^\/avatars\/[0-9a-f-]+\.png$/);

  // Review Focus 4: cerrar sin elegir no cambia nada
  const before = await avatarButton.locator('img').getAttribute('src');
  await avatarButton.click();
  await expect(host.getByRole('dialog', { name: 'Elegí tu avatar' })).toBeVisible();
  await host.keyboard.press('Escape');
  await expect(host.getByRole('dialog')).toHaveCount(0);
  await expect(avatarButton.locator('img')).toHaveAttribute('src', before!);

  await avatarButton.click();
  await host.getByRole('tab', { name: 'Comida' }).click();
  await host.getByRole('button', { name: '🍕', exact: true }).click();
  await expect(host.getByRole('dialog')).toHaveCount(0);
  await expect(avatarButton.locator('img')).toHaveAttribute('src', '/avatars/1f355.png');

  await host.getByLabel('Tu apodo').fill('Ana');
  await host.getByRole('button', { name: 'Crear sala' }).click();
  await host.waitForURL(/\/j\/[a-z0-9]{8}$/);
  await joinAs(guest, host.url(), 'Beto');
  await expect(guest.getByText('Participantes (2/15)')).toBeVisible();
  expect(hydrationErrors).toEqual([]); // Review Focus 2
});
