import { chromium, Browser, Page, BrowserContext } from 'playwright';

import { test, expect, } from '@playwright/test';

const EXPRESS_URL = process.env.EXPRESS_SERVER_URL;

test.describe('API Explorer Integration Tests', () => {
  
  
  test('API status endpoint responds with 200', async () => {
    
    const response = await fetch(`${EXPRESS_URL}/api/status`);
    expect(response.status).toBe(200);
    
    const data = await response.json();
    expect(data).toHaveProperty('status');
  });

  // Focus on API tests first since they're less complex
  test('Backend API endpoints are accessible', async ({ page }) => {
    
    // Test a few key endpoints
    const endpoints = [
      '/api/status',
      // Add more endpoints as needed
    ];
    
    for (const endpoint of endpoints) {
      const response = await fetch(`${EXPRESS_URL}${endpoint}`);
      expect(response.status).toBe(200);
    }
  });
  
  test('Vite development server is accessible', async () => {

    const viteUrl = process.env.VITE_OBP_API_EXPLORER_HOST
    if (!viteUrl) {
      throw new Error('VITE_OBP_API_EXPLORER_HOST is not set');
    }

    const response = await fetch(viteUrl);
    expect(response.status).toBe(200);
  });
  
  // Does not detect the title for some reason
  test.fixme('Home page loads correctly', async ({ page }) => {
    console.log(process.env.VITE_OBP_API_EXPLORER_HOST)

    await page.goto('/');
    
    // Wait for the page to load
    await page.waitForSelector('title');
    
    // Check that the title contains expected text
    const title = await page.title();
    expect(title).toContain('API Explorer');
  });
  
  test('Chat widget can be opened', async ({ page }) => {
    await page.goto('/');
    
    // Find and click the chat widget button
    const chatButton = await page.waitForSelector('.chat-widget-button');
    await chatButton.click();
    
    // Check that the chat container appears
    await page.waitForSelector('.chat-container');
    
    const chatContainerExists = await page.isVisible('.chat-container');
    expect(chatContainerExists).toBe(true);
  });
});
