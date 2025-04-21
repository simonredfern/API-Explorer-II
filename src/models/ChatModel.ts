import type { OpeyMessage, AssistantMessage } from "./MessageModel";

export interface Chat {
    messages: OpeyMessage[];
    currentAssistantMessage: AssistantMessage;
    status: 'ready' | 'streaming' | 'error' | 'loading';
    userIsAuthenticated: boolean;
    threadId: string;
}