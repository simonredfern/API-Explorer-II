// Tesing the Pinia chat store in src/stores/chat.ts

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