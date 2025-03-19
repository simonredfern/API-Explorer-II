import { OpeyMessage } from "@/models/MessageModel"

export interface Chat {
    messages: OpeyMessage[];
    currentAssistantMessage: OpeyMessage;
    status: 'ready' | 'streaming' | 'error' | 'loading';
    userIsAuthenticated: boolean;
    threadId: string;
}