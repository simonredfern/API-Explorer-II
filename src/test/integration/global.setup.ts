
import { spawn, ChildProcess } from 'child_process';
import type { FullConfig } from '@playwright/test';

// Ports for our test servers
const EXPRESS_PORT = 8085;

export const servers = {
  expressUrl: `http://localhost:${EXPRESS_PORT}`,
}

let expressServer: ChildProcess;


/**
 * Starts the Express server before running tests
 * waits for the express server to be running before returning
 * 
 */
async function globalSetup(config: FullConfig) {

  // Start the Express backend server
  console.log('Starting Express server...');
  expressServer = spawn('ts-node', ['server/app.ts'], {
    stdio: 'pipe',
    env: { ...process.env, PORT: EXPRESS_PORT.toString() }
  });

  // Log server output for debugging
  expressServer.stdout?.on('data', (data) => {
    console.log(`Express server: ${data}`);
  });
  
  expressServer.stderr?.on('data', (data) => {
    console.error(`Express server error: ${data}`);
  });

  // Wait for the server to be ready
  await waitForServer(`${servers.expressUrl}/api/status`, 30);

  process.env.EXPRESS_SERVER_URL = servers.expressUrl;

  return {
    expressUrl: servers.expressUrl,
  };
}

export default globalSetup;


/**
 * Helper to wait for a server to respond
 */
async function waitForServer(url: string, maxRetries = 30): Promise<boolean> {
  let retries = 0;
  
  while (retries < maxRetries) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return true;
      }
    } catch (error) {
      // Server not ready yet
      console.log(`Waiting for ${url} (attempt ${retries + 1}/${maxRetries})...`);
    }
    
    retries++;
    await new Promise(resolve => setTimeout(resolve, 1000)); // Increase wait time to 1s
  }
  
  throw new Error(`Server at ${url} did not respond in time`);
}
