// Purpose: Define the message models for the chat stream
import { ToolCall as LangChainToolCall } from '@langchain/core/messages'


// This is a schema for the raw message that we will get back from the Opey API,
// we adapt it to our own schema in the OpeyMessage interface
export interface RawOpeyMessage {
    /**
     * Role of the message.
     * @example "human", "ai", "tool"
     */
    type: "human" | "ai" | "tool";
    
    /**
     * Content of the message.
     * @example "Hello, world!"
     */
    content: string;
    
    /**
     * Tool calls in the message.
     */
    tool_calls: LangChainToolCall[];
    
    /**
     * Whether this message is an approval request for a tool call.
     */
    tool_approval_request: boolean;
    
    /**
     * Tool call that this message is responding to.
     * @example "call_Jja7J89XsjrOLA5r!MEOW!SL"
     */
    tool_call_id?: string;
    
    /**
     * Run ID of the message.
     * @example "847c6285-8fc9-4560-a83f-4e6285809254"
     */
    run_id?: string;
    
    /**
     * Original LangChain message in serialized form.
     */
    original?: Record<string, any>;
}

export interface OpeyMessage {
    id: string; // i.e. UUID4
    role: "assistant" | "user" | "tool";
    content: string;
    error?: string;
    loading?: boolean;
}

export interface UserMessage extends OpeyMessage {
    isToolCallApproval: boolean; 
}

export interface AssistantMessage extends OpeyMessage {
    toolCalls: OpeyToolCall[];
    // Probably we will need some fields here for tool call/ tool call approval requests
}

export interface OpeyToolCall {
    status: "pending" | "awaiting_approval" | "error" | "success"
    toolCall: LangChainToolCall; // LangChainToolCall is a type from the LangChain library
    output?: string | object // used for when we have a successful tool call and need to link the result to the tool call
}

export interface ChatStreamInput {
    message: UserMessage;
}