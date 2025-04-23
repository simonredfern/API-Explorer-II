import { test as setup, expect } from '@playwright/test';
import path from 'path';
import dotenv from 'dotenv';

// Read from ".env" file.
// dotenv.config({ path: path.resolve(__dirname, '.env') });


const authFile = path.join(__dirname, 'playwright/.auth/user.json');

setup('authenticate', async ({ page }) => {
    // Perform authentication steps. Replace these actions with your own.
    
    const password = process.env.VITE_OBP_DIRECT_LOGIN_PASSWORD;
    const username = process.env.VITE_OBP_DIRECT_LOGIN_USERNAME;
        if (!password || !username) {
            throw new Error('VITE_OBP_PASSWORD or VITE_OBP_USERNAME is not set');
        }

    await page.goto('/');
    await page.getByRole('link', { name: 'Log on' }).click();
    await page.getByRole('textbox', { name: 'Username' }).click();
    await page.getByRole('textbox', { name: 'Username' }).fill(username);
    await page.getByRole('textbox', { name: 'Password' }).click();
    await page.getByRole('textbox', { name: 'Password' }).fill(password);
    await page.getByRole('button', { name: 'Log In' }).click();
    await page.waitForURL('/');
    // Wait until the page receives the cookies.
    //
    // Sometimes login flow sets cookies in the process of several redirects.
    // Wait for the final URL to ensure that the cookies are actually set.
    await expect(page.locator('#nav')).toContainText(username);

    // End of authentication steps.

    await page.context().storageState({ path: authFile });
});