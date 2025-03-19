import type { OpeyMessage } from "./MessageModel";

export interface Chat {
    messages: OpeyMessage[];
    currentAssistantMessage: OpeyMessage;
    status: 'ready' | 'streaming' | 'error' | 'loading';
    userIsAuthenticated: boolean;
    threadId: string;
}