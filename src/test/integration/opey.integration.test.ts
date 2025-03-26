import { chromium, Browser, Page, BrowserContext } from 'playwright';
import {test, expect} from '@playwright/test';


test.describe('Opey Integration Tests in API Explorer', () => {

    const openAndSendMessage = async (page: Page, message: string) => {
        // Open the chat widget
        await page.goto('/');
        const chatButton = await page.waitForSelector('.chat-widget-button')
        await chatButton.click();
    
        await page.getByRole('textbox', { name: 'Type your message...' }).click();
        await page.getByRole('textbox', { name: 'Type your message...' }).fill(message);
        await page.locator('button[name="send"]').click();
    }

    test('Send a basic message', async ({ page }) => {

        await openAndSendMessage(page, 'Hi there');

        const assistantMessage = await page.locator('.assistant > .message-container > .content')
        console.log(assistantMessage.textContent())
        await expect(assistantMessage).not.toBeEmpty();
        
    })

    test.fixme('Send a message that would require a tool call to retrieve_endpoints', async ({page}) => {

        await openAndSendMessage(page, 'What endpoints are avaliable to manage users?');
        await page.locator('.assistant > .tool-calls-container').locator('tool-call').waitFor({state:"attached"})
        const toolCallMessages = await page.locator('.assistant > .tool-calls-container').locator('.tool-call').all()
        console.log(toolCallMessages.length)
        await expect(toolCallMessages.length).toBeGreaterThan(0);
        await expect(toolCallMessages[0].locator('.status + .tool-name')).toContainText('retrieve_endpoints');

    })

})