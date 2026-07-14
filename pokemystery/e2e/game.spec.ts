/**
 * End-to-end tests against the real dev server + local D1 (seeded via
 * `npm run data:sync:local` or `npm run data:seed:test`).
 */

import { test, expect, type Page } from '@playwright/test';

test.describe('landing page', () => {
  test('shows title, mode cards, and legal disclaimer', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'PokéMystery' })).toBeVisible();
    await expect(page.getByRole('button', { name: /AI Guesses Your Pokémon/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /You Guess the Pokémon/ })).toBeVisible();
    await expect(page.locator('.site-footer')).toContainText('unofficial fan project');
    await expect(page.getByRole('heading', { name: 'How to play' })).toBeVisible();
  });

  test('theme toggle switches themes', async ({ page }) => {
    await page.goto('/');
    const html = page.locator('html');
    await page.getByRole('button', { name: /Switch theme/ }).click();
    await expect(html).toHaveAttribute('data-theme', 'dark');
    await page.getByRole('button', { name: /Switch theme/ }).click();
    await expect(html).toHaveAttribute('data-theme', 'light');
  });
});

test.describe('settings', () => {
  test('generation toggles persist across reloads', async ({ page }) => {
    await page.goto('/#/settings');
    const gen9 = page.getByRole('group', { name: 'Included generations' }).getByRole('button', { name: '9' });
    await expect(gen9).toHaveAttribute('aria-pressed', 'true');
    await gen9.click();
    await expect(gen9).toHaveAttribute('aria-pressed', 'false');
    await page.reload();
    await expect(
      page.getByRole('group', { name: 'Included generations' }).getByRole('button', { name: '9' }),
    ).toHaveAttribute('aria-pressed', 'false');
    // restore defaults for other tests
    await page.getByRole('button', { name: 'Reset to defaults' }).click();
  });
});

test.describe('mode 1: AI guesses', () => {
  test('asks questions, supports undo, and reacts to answers', async ({ page }) => {
    await page.goto('/#/play/ai');
    const firstQuestion = await currentQuestion(page);
    await page.getByRole('button', { name: 'Yes', exact: true }).click();
    await expect(page.locator('.progress')).toContainText('Question 2');
    const secondQuestion = await currentQuestion(page);
    expect(secondQuestion).not.toBe(firstQuestion);

    await page.getByRole('button', { name: /Undo previous answer/ }).click();
    await expect(page.locator('.progress')).toContainText('Question 1');
    expect(await currentQuestion(page)).toBe(firstQuestion);
  });

  test('reaches a guess or defeat when answering consistently', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto('/#/play/ai');
    // Play as if thinking of Pikachu-ish answers: say no to everything except
    // a few broad questions — the engine must eventually guess or concede.
    for (let turn = 0; turn < 30; turn += 1) {
      const guessVisible = await page
        .getByRole('button', { name: "Yes, that's it!" })
        .isVisible()
        .catch(() => false);
      if (guessVisible) {
        await page.getByRole('button', { name: "Yes, that's it!" }).click();
        await expect(page.getByText('Got it!')).toBeVisible();
        return;
      }
      const defeated = await page
        .getByText(/Which Pokémon was it/)
        .isVisible()
        .catch(() => false);
      if (defeated) {
        await page.getByLabel('Which Pokémon were you thinking of?').fill('pika');
        await page.getByRole('button', { name: 'Pikachu', exact: true }).click();
        await expect(page.getByText('You win!')).toBeVisible();
        return;
      }
      await page.getByRole('button', { name: 'No', exact: true }).click();
      await page.waitForTimeout(100);
    }
    throw new Error('game never resolved to a guess or defeat');
  });
});

test.describe('mode 2: player guesses', () => {
  test('answers questions, hints, wrong guess, and give-up reveal', async ({ page }) => {
    await page.goto('/#/play/guess');
    await expect(page.getByPlaceholder(/Ask a yes\/no question/)).toBeVisible();

    // Deterministic question via example chip.
    await page.getByRole('button', { name: 'Is it legendary?' }).click();
    const entry = page.locator('.chat-entry').first();
    await expect(entry).toContainText('Is it legendary?');
    await expect(entry.locator('.pill')).toHaveText(/Yes|No|Probably|Sometimes|Unknown/);

    // Unparseable input asks for a rephrase.
    await page.getByLabel('Your question').fill('flibber jabber wocky?');
    await page.getByRole('button', { name: 'Send' }).click();
    await expect(page.locator('.chat-entry').nth(1).locator('.pill')).toHaveText('Please rephrase');

    // Hint.
    await page.getByRole('button', { name: /Hint/ }).click();
    await expect(page.locator('.chat-entry').nth(2)).toContainText(/Generation/);

    // A direct guess consumes a guess slot.
    await page.getByLabel('Your question').fill('Is it Mewtwo?');
    await page.getByRole('button', { name: 'Send' }).click();
    await expect(page.locator('.progress')).toContainText(/Guesses left [0-2]/);

    // Give up reveals the secret.
    const stillPlaying = await page.getByRole('button', { name: 'Give up' }).isVisible();
    if (stillPlaying) {
      await page.getByRole('button', { name: 'Give up' }).click();
    }
    await expect(page.locator('.reveal .name')).not.toBeEmpty();
    await expect(page.getByRole('button', { name: 'Play again' })).toBeVisible();
  });
});

async function currentQuestion(page: Page): Promise<string> {
  const text = await page.locator('.question-text').textContent();
  expect(text).not.toBeNull();
  return text ?? '';
}
