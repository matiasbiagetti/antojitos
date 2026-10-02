import { expect, test } from '@playwright/test';
import { createRoomAs, joinAs, newPlayer, voteCards } from './helpers';

test('three players reach a direct win', async ({ browser }) => {
  const [host, guest1, guest2] = await Promise.all([newPlayer(browser), newPlayer(browser), newPlayer(browser)]);
  const url = await createRoomAs(host, 'Ana');
  await joinAs(guest1, url, 'Beto');
  await joinAs(guest2, url, 'Caro');
  await expect(host.getByText('Participantes (3/15)')).toBeVisible();

  await host.getByRole('button', { name: 'Empezar' }).click();
  await Promise.all([
    voteCards(host, { pizza: 'super' }),
    voteCards(guest1, { pizza: 'super' }),
    voteCards(guest2, { pizza: 'yes', sushi: 'super' }),
  ]);

  for (const page of [host, guest1, guest2]) {
    await expect(page.getByText('¡Se come Pizza!')).toBeVisible();
  }
  await expect(guest1.getByText('Quién votó qué')).toHaveCount(0);
});

test('a tie with overlapping support goes to runoff', async ({ browser }) => {
  const [host, guest1, guest2] = await Promise.all([newPlayer(browser), newPlayer(browser), newPlayer(browser)]);
  const url = await createRoomAs(host, 'Ana');
  await joinAs(guest1, url, 'Beto');
  await joinAs(guest2, url, 'Caro');
  await host.getByRole('button', { name: 'Empezar' }).click();

  // pizza 2, sushi 2; Caro apoya a ambas -> ballotage
  await Promise.all([
    voteCards(host, { pizza: 'yes' }),
    voteCards(guest1, { sushi: 'yes' }),
    voteCards(guest2, { pizza: 'yes', sushi: 'yes' }),
  ]);

  for (const page of [host, guest1, guest2]) {
    await expect(page.getByText('¡Hay empate!')).toBeVisible();
    await page.getByRole('button', { name: 'Pizza' }).click();
  }
  for (const page of [host, guest1, guest2]) {
    await expect(page.getByText('¡Se come Pizza!')).toBeVisible();
  }
});

test('a clean split skips the runoff and spins the roulette', async ({ browser }) => {
  const [host, guest] = await Promise.all([newPlayer(browser), newPlayer(browser)]);
  const url = await createRoomAs(host, 'Ana');
  await joinAs(guest, url, 'Beto');
  await host.getByRole('button', { name: 'Empezar' }).click();

  await Promise.all([voteCards(host, { pizza: 'yes' }), voteCards(guest, { sushi: 'yes' })]);

  await expect(host.getByText('¡A la ruleta!')).toBeVisible();
  await expect(host.getByText(/¡Se come (Pizza|Sushi)!/)).toBeVisible({ timeout: 20_000 });
  const hostWinner = await host.getByText(/¡Se come (Pizza|Sushi)!/).textContent();
  await expect(guest.getByText(hostWinner!)).toBeVisible();

  await host.getByRole('button', { name: 'Jugar otra ronda' }).click();
  await expect(guest.getByText(/Participantes/)).toBeVisible();
});

test('reloading mid-round resumes on an unvoted card', async ({ browser }) => {
  const [host, guest] = await Promise.all([newPlayer(browser), newPlayer(browser)]);
  const url = await createRoomAs(host, 'Ana');
  await joinAs(guest, url, 'Beto');
  await host.getByRole('button', { name: 'Empezar' }).click();

  const voted = await voteCards(host, {}, 3);
  await host.waitForLoadState('networkidle'); // que terminen de llegar los votos en vuelo
  await host.reload();
  const card = host.getByTestId('card');
  await expect(card).toBeVisible();
  expect(voted).not.toContain(await card.getAttribute('data-category-id'));
  await expect(host.getByText('4 de 14')).toBeVisible();
});

test('the "who voted what" warning shows before and during voting', async ({ browser }) => {
  const [host, guest] = await Promise.all([newPlayer(browser), newPlayer(browser)]);
  const url = await createRoomAs(host, 'Ana');
  const warning = 'Ojo: al final todos van a ver quién votó qué.';
  await host.getByLabel('Quién votó qué').click();
  await expect(host.getByText(warning)).toBeVisible();

  await guest.goto(url);
  await expect(guest.getByLabel('Tu apodo')).toBeVisible();
  await expect(guest.getByText(warning)).toBeVisible();
  await guest.getByLabel('Tu apodo').fill('Beto');
  await guest.getByRole('button', { name: 'Entrar' }).click();
  await expect(guest.getByText(/Participantes/)).toBeVisible();

  await host.getByRole('button', { name: 'Empezar' }).click();
  await expect(guest.getByTestId('card')).toBeVisible();
  await expect(guest.getByText(warning)).toBeVisible();
  await expect(host.getByText(warning)).toBeVisible();
});
