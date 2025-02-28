export interface OpeyMessage {
    id: string;
    role: string;
    content: string;
}

export interface OpeyStreamContext {
    currentAssistantMessage: OpeyMessage;
    messages: OpeyMessage[];
    status: string;
}

/**
 * Process a stream from Opey API and update the message content
 * @param stream The ReadableStream from the fetch response
 * @param context The context object containing the message to update and status
 * @returns A promise that resolves when the stream is complete
 */
export async function processOpeyStream(
    stream: ReadableStream<Uint8Array>,
    context: OpeyStreamContext
): Promise<void> {
    const reader = stream.getReader();
    let decoder = new TextDecoder();
    
    try {
        while (true) {
            const { done, value } = await reader.read();
            
            if (done) {
                console.log('Stream complete');
                context.status = 'ready';
                break;
            }
            
            const decodedValue = decoder.decode(value);
            console.debug('Received:', decodedValue); //DEBUG
            
            // Parse the SSE data format
            const lines = decodedValue.split('\n');
            for (const line of lines) {
                if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                    try {
                        const jsonStr = line.substring(6); // Remove 'data: '
                        const data = JSON.parse(jsonStr);
                        
                        if (data.type === 'token' && data.content) {
                            // Append content to the current assistant message
                            context.currentAssistantMessage.content += data.content;
                            // Force Vue to detect the change
                            context.messages = [...context.messages];
                        }
                    } catch (e) {
                        throw new Error(`Error parsing JSON: ${e}`);
                    }
                }
            }
        }
    } catch (error) {
        console.error('Stream error:', error);
        context.status = 'ready';
        throw error
    }

}

export async function sendOpeyMessage(
    message: string,
    threadId: string,
    isToolCallApproval: boolean,
    context: OpeyStreamContext
): Promise<void> {
    try {
        const response = await fetch('/api/opey/stream', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                thread_id: threadId,
                message: message,
                is_tool_call_approval: isToolCallApproval
            })
        })
    
        const stream = response.body;
        if (!stream) {
            throw new Error('No stream returned from API')
        }

        if (response.status !== 200) {
            throw new Error(`Error sending Opey message: ${response.statusText}`);
        }
    
        await processOpeyStream(stream, context);
    } catch (error) {
        console.error('Error sending Opey message:', error);
        context.status = 'ready';
        throw new Error(`Error sending Opey message: ${error}`);
    }

}