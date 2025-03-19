export interface OpeyMessage {
    id: string; // i.e. UUID4
    role: string;
    content: string;
    error?: string;
}

export interface UserMessage extends OpeyMessage {
    isToolCallApproval: boolean; 
}

export interface AssistantMessage extends OpeyMessage {
    // Probably we will need some fields here for tool call/ tool call approval requests
}

export interface ChatStreamInput {
    message: UserMessage;
}