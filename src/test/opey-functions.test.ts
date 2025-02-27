import * as OpeyModule from '@/obp/opey-functions';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('processOpeyStream', async () => {
    let mockContext: OpeyModule.OpeyStreamContext;

    beforeEach(() => {
        // Reset the mock context before each test
        mockContext = {
            currentAssistantMessage: {
                id: '123',
                role: 'assistant',
                content: '',
            },
            messages: [],
            status: 'loading',
        }
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

        await OpeyModule.processOpeyStream(stream, mockContext)
        console.log(mockContext.currentAssistantMessage.content)
        expect(mockContext.currentAssistantMessage.content).toBe(mockAsisstantMessage)
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

        await expect(OpeyModule.processOpeyStream(brokenStream, mockContext))
            .rejects
            .toThrow('Stream closed by server')
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

        await expect(OpeyModule.processOpeyStream(invalidJsonStream, mockContext))
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

        await OpeyModule.processOpeyStream(stream, mockContext)
        expect(mockContext.status).toBe('ready')
    })
})

describe('sendOpeyMessage', () => {
    let mockContext: OpeyModule.OpeyStreamContext;

    beforeEach(() => {
        mockContext = {
            currentAssistantMessage: {
                id: '123',
                role: 'assistant',
                content: '',
            },
            messages: [],
            status: 'loading',
        }  

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
    })
    afterEach(() => {
        vi.clearAllMocks()
    })
    it('should call fetch', async () => {
        await OpeyModule.sendOpeyMessage('test message', '123', false, mockContext)

        expect(global.fetch).toHaveBeenCalled()
    })
    it("should push the 'ready' status to the context", async () => {

        await OpeyModule.sendOpeyMessage('test message', '123', false, mockContext)

        expect(mockContext.status).toBe('ready')
    })
})