import { describe,beforeAll, beforeEach, afterAll, afterEach } from 'vitest';
import { chromium, Browser, Page, BrowserContext } from 'playwright';
import {test, expect} from '@playwright/test';

test.describe('Opey Integration Tests in API Explorer', () => {

    test.beforeAll(async ({ page }) => {
        // Open the chat widget
        await page.goto('/');
        const chatButton = await page.waitForSelector('.chat-widget-button');
        await chatButton.click();

    })

    test('Opey is running', async ({ page }) => {
        await page.goto('/');

        
    })

})