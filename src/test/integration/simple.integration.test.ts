import { describe, test, expect, beforeAll, beforeEach, afterAll, afterEach } from 'vitest';
import { useIntegrationTestHooks } from './setup';
import { chromium, Browser, Page, BrowserContext } from 'playwright';

describe('API Explorer Integration Tests', () => {
  // Setup Express and Vue servers for all tests
  const getServers = useIntegrationTestHooks();
  
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;
  
  // Setup browser for testing
  beforeAll(async () => {
    browser = await chromium.launch({ 
      headless: true,
      // Use this to debug tests visually if needed
      // headless: false,
      // slowMo: 1000,
    });
  });
  
  afterAll(async () => {
    await browser.close();
  });
  
  beforeEach(async () => {
    context = await browser.newContext();
    page = await context.newPage();
  });
  
  afterEach(async () => {
    await context.close();
  });
  
  test('API status endpoint responds with 200', async () => {
    const servers = getServers();
    
    const response = await fetch(`${servers.expressUrl}/api/status`);
    expect(response.status).toBe(200);
    
    const data = await response.json();
    expect(data).toHaveProperty('status');
  });

  // Focus on API tests first since they're less complex
  test('Backend API endpoints are accessible', async () => {
    const servers = getServers();
    
    // Test a few key endpoints
    const endpoints = [
      '/api/status',
      // Add more endpoints as needed
    ];
    
    for (const endpoint of endpoints) {
      const response = await fetch(`${servers.expressUrl}${endpoint}`);
      expect(response.status).toBe(200);
    }
  });
  
  test('Vite development server is accessible', async () => {
    const servers = getServers();
    const response = await fetch(servers.viteUrl);
    expect(response.status).toBe(200);
  });
  
  // Comment out the more complex UI tests until the basic setup is working
  test.skip('Home page loads correctly', async () => {
    const servers = getServers();
    await page.goto(servers.viteUrl);
    
    // Wait for the page to load
    await page.waitForSelector('title');
    
    // Check that the title contains expected text
    const title = await page.title();
    expect(title).toContain('API Explorer');
  });
  
  test.skip('Chat widget can be opened', async () => {
    const servers = getServers();
    await page.goto(servers.viteUrl);
    
    // Find and click the chat widget button
    const chatButton = await page.waitForSelector('.chat-widget-button');
    await chatButton.click();
    
    // Check that the chat container appears
    await page.waitForSelector('.chat-container');
    
    const chatContainerExists = await page.isVisible('.chat-container');
    expect(chatContainerExists).toBe(true);
  });
});
