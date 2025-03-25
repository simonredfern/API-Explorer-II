import { createServer as createViteServer } from 'vite';
import { afterAll, beforeAll } from 'vitest';
import { ChildProcess, spawn } from 'child_process';
import fetch from 'node-fetch';
import path from 'path';

// Ports for our test servers
const EXPRESS_PORT = 8085; // Match the port in server/app.ts
const VITE_PORT = 8086;    // Different from the default dev port

let viteServer: any;
let expressServer: ChildProcess;

/**
 * Starts the Express and Vue servers for integration testing
 */
export async function setupTestServers() {
  // Start Express server as a separate process
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
  
  // Start Vite dev server in test mode
  viteServer = await createViteServer({
    configFile: path.resolve(__dirname, '../../../vite.config.mts'),
    server: {
      port: VITE_PORT,
    },
    logLevel: 'silent', // Reduce console noise during tests
  });
  
  await viteServer.listen(VITE_PORT);
  console.log(`Vite test server running at http://localhost:${VITE_PORT}`);
  
  // Wait for both servers to be fully ready
  await waitForServer(`http://localhost:${EXPRESS_PORT}/api/status`, 30);
  await waitForServer(`http://localhost:${VITE_PORT}`, 30);
  
  return {
    expressUrl: `http://localhost:${EXPRESS_PORT}`,
    viteUrl: `http://localhost:${VITE_PORT}`,
  };
}

/**
 * Stops all test servers
 */
export async function teardownTestServers() {
  // Close Vite server
  if (viteServer) {
    await viteServer.close();
  }
  
  // Close Express server
  if (expressServer) {
    expressServer.kill('SIGTERM');
  }
}

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

/**
 * Setup and teardown hooks for vitest
 */
export function useIntegrationTestHooks() {
  let servers: { expressUrl: string; viteUrl: string };
  
  beforeAll(async () => {
    servers = await setupTestServers();
    return servers;
  });
  
  afterAll(async () => {
    await teardownTestServers();
  });
  
  return () => servers;
}
