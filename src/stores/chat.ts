/*
 * Open Bank Project -  API Explorer II
 * Copyright (C) 2023-2024, TESOBE GmbH
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * Email: contact@tesobe.com
 * TESOBE GmbH
 * Osloerstrasse 16/17
 * Berlin 13359, Germany
 *
 *   This product includes software developed at
 *   TESOBE (http://www.tesobe.com/)
 *
 */

import type { OpeyMessage, ChatStreamInput } from '@/models/MessageModel'
import type { Chat } from '@/models/ChatModel'
import { getobpConsent, processOpeyStream } from '@/obp/opey-functions'
import { defineStore } from 'pinia'
import { v4 as uuidv4 } from 'uuid'

/**
 * Represents a Pinia store for managing chat messages and chatbot responses.
 */
export const useChat = defineStore('chat', {

    state: (): Chat => {
        return {
            messages: [] as OpeyMessage[],
            currentAssistantMessage: {
                content: '',
                role: 'assistant',
                id: '',
            } as OpeyMessage,
            status: 'ready' as 'ready' | 'streaming' | 'error' | 'loading',
            userIsAuthenticated: false,
            threadId: '',
        }
    },

    getters: {

        /**
         * Retrieves or creates a thread ID for the chat.
         * 
         * @param store - The store object that holds the thread ID
         * @param threadId - Optional thread ID to set
         * @returns The current or newly created thread ID
         * 
         * If a threadId is provided, it will be set in the store and returned.
         * This is useful if the you want to match the thread ID on the chatbot server side.
         * 
         * If no threadId is provided and none exists in the store, a new UUID will be generated.
         * Otherwise, the existing threadId from the store is returned.
         */
        getThreadId: (store) => {
            return (id?: string): string => {
                if (id) {
                    if (!store.threadId) {
                        store.threadId = id
                        return store.threadId
                    } else {
                        console.warn('Cannot set thread ID on already instantiated store. Create a new store instead.')
                        return store.threadId
                    }
                }

                if (!store.threadId) {
                    store.threadId = uuidv4()
                    return store.threadId
                } else {
                    return store.threadId
                }
            }
        },

        getLastAssistantMessage(store): OpeyMessage | undefined {
            return this.getMessageById(store.currentAssistantMessage.id)
        },

        getMessageById: (store) => {
            return (id: string): OpeyMessage | undefined => {
                return store.messages.find(m => m.id === id)
            }
        }
    },

    actions: {
        /**
         * Adds a message to the chat.
         * 
         * Works in a reducer-like fashion, updating the message if it already exists.
         * 
            * @param message - The message to add to the chat
         */
        async addMessage(message: OpeyMessage): Promise<void> {
            
            const existingMessage = this.messages.find(m => m.id === message.id);
            if (existingMessage) {
                // Update the existing message
                existingMessage.content = message.content;
                
            } else {
                // Add the new message
                this.messages.push(message);
            }
        },

        async removeMessage(messageId: string): Promise<void> {
            this.messages = this.messages.filter(m => m.id !== messageId);
        },

        async applyErrorToMessage(messageId: string, errorMessageString: string): Promise<void> {
            const message = this.getMessageById(messageId);
            if (message) {
                message.error = errorMessageString;
            }
        },

        async handleAuthentication(): Promise<void> {
            // Handle authentication
            // get consent for Opey from user
            const consentResponse = await getobpConsent()

            if (consentResponse) {
                const consentId = consentResponse.consent_id
                if (consentId) {
                    this.userIsAuthenticated = true
                } else {
                    throw new Error('Failed to grant consent. Please try again.')
                }
            } else {
                throw new Error('Failed to grant consent. Please try again.')
            }
        },

        async stream(input: ChatStreamInput): Promise<void> {
            // Add user message to chat
            this.addMessage(input.message)

            // Create a placecholder for the assistant message
            this.currentAssistantMessage = {
                content: '',
                role: 'assistant',
                id: uuidv4(),
            }
            this.addMessage(this.currentAssistantMessage)

            // Handle stream
            try {
                const response = await fetch('/api/opey/stream', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        thread_id: this.threadId,
                        message: input.message.content,
                        is_tool_call_approval: input.message.isToolCallApproval
                    })
                })
            
                const stream = response.body;
                if (!stream) {
                    throw new Error('No stream returned from API')
                }
        
                if (response.status !== 200) {
                    throw new Error(`Error sending Opey message: ${response.statusText}`);
                }
                
    
                let context = {
                    currentAssistantMessage: this.currentAssistantMessage,
                    messages: this.messages,
                    status: this.status
                };
    
                await processOpeyStream(stream, context);
            } catch (error) {
                console.error('Error sending Opey message:', error);

                const errorMessage = "Hmmm, Looks like smething went wrong. Please try again later.";
                // Apply error state to the assistant message
                await this.applyErrorToMessage(this.currentAssistantMessage.id, errorMessage);

                this.status = 'ready';
                
            }
        }
        
    }
})