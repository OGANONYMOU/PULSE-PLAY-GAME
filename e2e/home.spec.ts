import { test, expect } from '@playwright/test';

test('has title and renders hero section', async ({ page }) => {
  await page.goto('/');
  
  // Expect a title "to contain" a substring.
  await expect(page).toHaveTitle(/PulsePlay/i);

  // Expect the hero heading to be visible
  await expect(page.locator('text=Compete at')).toBeVisible();
});

test('can navigate to games page', async ({ page }) => {
  await page.goto('/');
  
  // Click the "Games" link in the navigation
  await page.click('nav a[href="/games"]');
  
  // Wait for navigation and verify the URL
  await expect(page).toHaveURL(/.*\/games/);
  
  // Verify the page title/header
  await expect(page.locator('h1')).toContainText(/Trending Mobile Games/i);
});
