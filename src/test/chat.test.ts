// Tesing the Pinia chat store in src/stores/chat.ts

import { useChat } from '@/stores/chat'
import { beforeEach, describe, it, expect } from 'vitest'
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
})