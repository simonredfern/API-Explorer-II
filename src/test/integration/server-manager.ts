import { ChildProcess } from 'child_process';

// Global state to store server instance
let expressServerProcess: ChildProcess | null = null;

export function setExpressServer(server: ChildProcess): void {
  expressServerProcess = server;
}

export function getExpressServer(): ChildProcess | null {
  return expressServerProcess;
}