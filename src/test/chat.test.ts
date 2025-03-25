// Tesing the Pinia chat store in src/stores/chat.ts
import type { OpeyMessage, ToolMessage } from '@/models/MessageModel'
import { ToolCall } from '@langchain/core/messages'
import { useChat } from '@/stores/chat'
import { beforeEach, describe, it, expect, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

describe('Chat Store', () => {
    beforeEach(() => {

        // Set the active Pinia store
        setActivePinia(createPinia())
    })

    it('should be able to create its own thread ID', () => {
        const chatStore = useChat()
        const threadId = chatStore.getThreadId()
        expect(threadId).toBeDefined()
        expect(threadId).not.toBe('')
    })

    it('should accept a set thread ID and not change it later', () => {
        const chatStore = useChat()
        const threadId = chatStore.getThreadId('1234')
        expect(chatStore.threadId).toBe('1234')
        const newThreadId = chatStore.getThreadId()
        expect(newThreadId).toBe('1234')
    })

    it('should not change the thread ID if it is already set', () => {
        const chatStore = useChat()
        const threadId = chatStore.getThreadId('1234')
        expect(chatStore.threadId).toBe('1234')
        const newThreadId = chatStore.getThreadId('5678')
        expect(newThreadId).toBe('1234')
    })

    it('should set its own thread ID if stream is called without a thread ID set already', async () => {
        const chatStore = useChat()
        await chatStore.stream({message: {
            content: 'Hello Opey',
            role: 'user',
            id: '123',
            isToolCallApproval: false
        }})
        expect(chatStore.threadId).toBeDefined()
        expect(chatStore.threadId).not.toBe('')
    })

    it('should apply an error state to the assistant message on error', async () => {
        // mock the fetch function with a rejected promise
        global.fetch = vi.fn(() =>
            Promise.reject(new Error('Test error'))
        );
        const chatStore = useChat()

        await chatStore.stream({message: {
            content: 'Hello Opey',
            role: 'user',
            id: '123',
            isToolCallApproval: false
        }})
        console.log("Messages: ", chatStore.messages)
        const assistantMessage = chatStore.getLastAssistantMessage
        expect(assistantMessage).toBeDefined()
        expect(assistantMessage?.error).toBeDefined()
    })

    it('should stream messages correctly', async () => {
        // create a mock stream
        const mockStream = new ReadableStream<Uint8Array>({
            start(controller) {
                controller.enqueue(new TextEncoder().encode(`data: {"type":"token","content":"test"}\n`));
                controller.close();
            },
        });
        // mock the fetch function
        global.fetch = vi.fn(() =>
            Promise.resolve(new Response(mockStream, {
                headers: { 'content-type': 'text/event-stream' },
                status: 200,
            }))
        );

        const chatStore = useChat()

        await chatStore.stream({message: {
            content: 'Hello Opey',
            role: 'user',
            id: '123',
            isToolCallApproval: false
        }})

        const assistantMessage = chatStore.getLastAssistantMessage
        expect(assistantMessage).toBeDefined()
        expect(assistantMessage?.content).toBe('test')
    })

    it('should be able to handle tool messages', async () => {
        const mockStream = new ReadableStream<Uint8Array>({
            start(controller) {
                controller.enqueue(new TextEncoder().encode(`data: {"type":"tool","content":"test"}\n`));
                controller.close();
            },
        });
    })
})

describe('Chat Store _proccessOpeyStream', () => {
    let mockStream: ReadableStream<Uint8Array>

    let chatStore: ReturnType<typeof useChat>

    beforeEach(() => {
        // Set the active Pinia store
        setActivePinia(createPinia())
        chatStore = useChat()
        // create a mock stream
        mockStream = new ReadableStream<Uint8Array>({
            start(controller) {
                controller.enqueue(new TextEncoder().encode(`data: {"type":"token","content":"Hello"}\n`));
                controller.enqueue(new TextEncoder().encode(`data: {"type":"token","content":" world!"}\n`));
                controller.close();
            }
        })
    })

    it('should update context with streamed content', async () => {

        
        // Mock a ReadableStream
        const mockAsisstantMessage = "Hi I'm Opey, your personal banking assistant. I'll certainly not take over the world, no, not at all!"

        // Split the message into chunks, but reappend the whitespace (this is to simulate llm tokens)
        const mockMessageChunks = mockAsisstantMessage.split(" ")
        for (let i = 0; i < mockMessageChunks.length; i++) {
            // Don't add whitespace to the last chunk
            if (i === mockMessageChunks.length - 1 ) {
                mockMessageChunks[i] = `${mockMessageChunks[i]}`
                break
            }
            mockMessageChunks[i] = `${mockMessageChunks[i]} `
        }

        // Fake the token stream
        const stream = new ReadableStream<Uint8Array>({
            start(controller) {
                for (let i = 0; i < mockMessageChunks.length; i++) {
                    controller.enqueue(new TextEncoder().encode(`data: {"type":"token","content":"${mockMessageChunks[i]}"}\n`));
                }
                controller.close();
            },
        });

        await chatStore._processOpeyStream(stream)
        console.log(chatStore.currentAssistantMessage.content)
        expect(chatStore.currentAssistantMessage.content).toBe(mockAsisstantMessage)
    })

    it('should throw an error when the stream is closed by the server', async () => {
        const brokenStream = new ReadableStream<Uint8Array>({
            start(controller) {
                for (let i = 0; i < 10; i++) {
                    if (i === 5) {
                        controller.error(new Error('Stream closed by server'))
                        break;
                    }
                    controller.enqueue(new TextEncoder().encode(`data: {"type":"token","content":"test"}\n`));
                }
                
            },
        });

        await expect(chatStore._processOpeyStream(brokenStream))
            .rejects
            .toThrow('Stream closed by server')
    })

    it('should be able a chunk with type: message and a tool call in the body', async () => {
        // create a mock stream
        const mockStream = new ReadableStream<Uint8Array>({
            start(controller) {
                controller.enqueue(new TextEncoder().encode(`data: {"type": "message", "content": {"type": "ai", "content": "", "tool_calls": [{"name": "retrieve_glossary", "args": {"question": "hre"}, "id": "call_XsmUpPIeS81l9MYpieBZtr4w", "type": "tool_call"}], "tool_approval_request": false, "tool_call_id": null, "run_id": "d0c2bcbe-62f7-464b-8564-bf9263939fe1", "original": {"type": "ai", "data": {"content": "", "additional_kwargs": {"tool_calls": [{"index": 0, "id": "call_XsmUpPIeS81l9MYpieBZtr4w", "function": {"arguments": "{\\"question\\":\\"hre\\"}", "name": "retrieve_glossary"}, "type": "function"}]}, "response_metadata": {"finish_reason": "tool_calls", "model_name": "gpt-4o-2024-08-06", "system_fingerprint": "fp_eb9dce56a8"}, "type": "ai", "name": null, "id": "run-5bb065b9-440d-4678-bbdb-cd6de94a78d3", "example": false, "tool_calls": [{"name": "retrieve_glossary", "args": {"question": "hre"}, "id": "call_XsmUpPIeS81l9MYpieBZtr4w", "type": "tool_call"}], "invalid_tool_calls": [], "usage_metadata": null}}}}\n`));
                controller.close();
            },
        });

        // mock the fetch function
        global.fetch = vi.fn(() =>
            Promise.resolve(new Response(mockStream, {
                headers: { 'content-type': 'text/event-stream' },
                status: 200,
            }))
        );

        await chatStore._processOpeyStream(mockStream)

        expect(chatStore.messages).toHaveLength(1)

        const toolMessage: ToolMessage = chatStore.messages[0] as ToolMessage

        expect(toolMessage.awaitingApproval).toBe(false)
        expect(toolMessage.toolCall).toBeTypeOf('object')
        expect(toolMessage.pending).toBe(true)
        // Instead of checking instance directly, verify the object has the expected properties
        expect(toolMessage.toolCall).toEqual(expect.objectContaining({
            name: 'retrieve_glossary',
            args: expect.objectContaining({
            question: 'hre'
            }),
            id: 'call_XsmUpPIeS81l9MYpieBZtr4w',
            type: 'tool_call'
        }))
        expect(toolMessage.content).toBe('')
    })

    it('should associate tool call with current assistant message', async () => {
        // create a mock stream
        const mockStream = new ReadableStream<Uint8Array>({
            start(controller) {
                controller.enqueue(new TextEncoder().encode(`data: {"type": "message", "content": {"type": "ai", "content": "", "tool_calls": [{"name": "retrieve_glossary", "args": {"question": "hre"}, "id": "call_XsmUpPIeS81l9MYpieBZtr4w", "type": "tool_call"}], "tool_approval_request": false, "tool_call_id": null, "run_id": "d0c2bcbe-62f7-464b-8564-bf9263939fe1", "original": {"type": "ai", "data": {"content": "", "additional_kwargs": {"tool_calls": [{"index": 0, "id": "call_XsmUpPIeS81l9MYpieBZtr4w", "function": {"arguments": "{\\"question\\":\\"hre\\"}", "name": "retrieve_glossary"}, "type": "function"}]}, "response_metadata": {"finish_reason": "tool_calls", "model_name": "gpt-4o-2024-08-06", "system_fingerprint": "fp_eb9dce56a8"}, "type": "ai", "name": null, "id": "run-5bb065b9-440d-4678-bbdb-cd6de94a78d3", "example": false, "tool_calls": [{"name": "retrieve_glossary", "args": {"question": "hre"}, "id": "call_XsmUpPIeS81l9MYpieBZtr4w", "type": "tool_call"}], "invalid_tool_calls": [], "usage_metadata": null}}}}\n`));
                controller.close();
            },
        });

        // mock the fetch function
        global.fetch = vi.fn(() =>
            Promise.resolve(new Response(mockStream, {
                headers: { 'content-type': 'text/event-stream' },
                status: 200,
            }))
        );

        chatStore.currentAssistantMessage = {
            id: '123',
            role: 'assistant',
            content: '',
         }

        await chatStore._processOpeyStream(mockStream)

        expect(chatStore.messages).toHaveLength(1)

        const toolMessage: ToolMessage = chatStore.messages[0] as ToolMessage

        expect(chatStore.currentAssistantMessage.toolCalls).toBeDefined()
        expect(chatStore.currentAssistantMessage.toolCalls).toContain(toolMessage.toolCall)
    })

     it('should throw an error when the chunk is not valid json', async () => {
        const invalidJsonStream = new ReadableStream<Uint8Array>({
            start(controller) {
                for (let i=0; i<10; i++) {
                    controller.enqueue(new TextEncoder().encode(`data: {"type":"token","content":"test"}\n`));
                    if (i === 5) {
                        controller.enqueue(new TextEncoder().encode('data: "type":"token","content":"test"}\n'));
                    }
                }
                controller.close();

            }
        })

        await expect(chatStore._processOpeyStream(invalidJsonStream))
            .rejects
            .toThrowError()
    })

    it("should set status to 'ready' when completed", async () => {
        const stream = new ReadableStream<Uint8Array>({
            start(controller) {
                controller.enqueue(new TextEncoder().encode(`data: {"type":"token","content":"test"}\n`));
                controller.close();
            }
        })

        await chatStore._processOpeyStream(stream)
        expect(chatStore.status).toBe('ready')
    })

    it("should clear the placeholder assistant message, and update last assistant message when recieving the [DONE] signal", async () => {
        // Mock a ReadableStream
        const mockAsisstantMessage = "Hi I'm Opey, your personal banking assistant. I'll certainly not take over the world, no, not at all!"
        // Split the message into chunks, but reappend the whitespace (this is to simulate llm tokens)
        const mockMessageChunks = mockAsisstantMessage.split(" ")
        for (let i = 0; i < mockMessageChunks.length; i++) {
            // Don't add whitespace to the last chunk
            if (i === mockMessageChunks.length - 1 ) {
                mockMessageChunks[i] = `${mockMessageChunks[i]}`
                break
            }
            mockMessageChunks[i] = `${mockMessageChunks[i]} `
        }

        // Fake the token stream
        const stream = new ReadableStream<Uint8Array>({
            start(controller) {
                for (let i = 0; i < mockMessageChunks.length; i++) {
                    controller.enqueue(new TextEncoder().encode(`data: {"type":"token","content":"${mockMessageChunks[i]}"}\n`));
                }
                controller.enqueue(new TextEncoder().encode(`data: [DONE]\n`));
                controller.close();
            },
        });

        // Replace current assistant message with a more unique one for our test
        chatStore.currentAssistantMessage = {
            id: '456',
            role: 'assistant',
            content: '',
         }
       
        // Push assistant message to the messages list as this is what we do in the ChatWidget to visualise token streaming
        chatStore.addMessage(chatStore.currentAssistantMessage)

        await chatStore._processOpeyStream(stream)
        // assert that the current assistant 'placeholder' message was reset
        expect(chatStore.currentAssistantMessage.content).toBe('')
        // assert that the assistant message was added to the messages list
        console.log(chatStore.messages)
        expect(chatStore.messages).toContainEqual({
            id: '456',
            role: 'assistant',
            content: mockAsisstantMessage,
        })
        

    })
    it("should have a unique set of messages", async () => {
        // mock the stream as above
        // Mock a ReadableStream
        const mockAsisstantMessage = "Hi I'm Opey, your personal banking assistant. I'll certainly not take over the world, no, not at all!"
        // Split the message into chunks, but reappend the whitespace (this is to simulate llm tokens)
        const mockMessageChunks = mockAsisstantMessage.split(" ")
        for (let i = 0; i < mockMessageChunks.length; i++) {
            // Don't add whitespace to the last chunk
            if (i === mockMessageChunks.length - 1 ) {
                mockMessageChunks[i] = `${mockMessageChunks[i]}`
                break
            }
            mockMessageChunks[i] = `${mockMessageChunks[i]} `
        }

        // Fake the token stream
        const stream = new ReadableStream<Uint8Array>({
            start(controller) {
                for (let i = 0; i < mockMessageChunks.length; i++) {
                    controller.enqueue(new TextEncoder().encode(`data: {"type":"token","content":"${mockMessageChunks[i]}"}\n`));
                }
                controller.enqueue(new TextEncoder().encode(`data: [DONE]\n`));
                controller.close();
            },
        });

        // Replace current assistant message with a more unique one for our test
        chatStore.currentAssistantMessage = {
            id: '456',
            role: 'assistant',
            content: '',
         }
       
        // Push assistant message to the messages list as this is what we do in the ChatWidget to visualise token streaming
        chatStore.addMessage(chatStore.currentAssistantMessage)

        await chatStore._processOpeyStream(stream)

        function hasUniqueValues(arr: OpeyMessage[]): boolean {
            return arr.filter((value, index, self) => self.indexOf(value) === index).length === arr.length;
        }
        expect(hasUniqueValues(chatStore.messages)).toBe(true)
    })
})