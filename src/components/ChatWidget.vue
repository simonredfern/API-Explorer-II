<!--
placeholder for Opey II Chat widget
--> 
<script lang="ts">

import { ref, reactive } from 'vue'
import { Close } from '@element-plus/icons-vue'
import ChatMessage from './ChatMessage.vue';
import { v4 as uuidv4 } from 'uuid';
import { OpeyStreamContext, OpeyMessage, sendOpeyMessage } from '@/obp/opey-functions';

export default {
    setup () {
        return { 
            Close,
        }
    },
    data() {
        return {
            chatOpen: false,
            thread_id: uuidv4(),
            input: '',
            opeyContext: reactive({
                currentAssistantMessage: {
                    id: '',
                    role: 'assistant',
                    content: ''
                },
                messages: new Array<OpeyMessage>(),
                status: 'ready'
            } as OpeyStreamContext),
        }
    },
    components: {
        ChatMessage,
    },
    methods: {
        toggleChat() {
            this.chatOpen = !this.chatOpen
        },
        async onSubmit() {
            // Add user message to the messages array
            const userMessage: OpeyMessage = {
                id: uuidv4(),
                role: 'user',
                content: this.input
            };
            this.opeyContext.messages.push(userMessage);
            
            // Create a placeholder for the assistant's response
            this.opeyContext.currentAssistantMessage = {
                id: uuidv4(),
                role: 'assistant',
                content: ''
            };
            this.opeyContext.messages.push(this.opeyContext.currentAssistantMessage);
            
            // Set status to loading
            this.opeyContext.status = 'loading';
            
            // Clear input field after sending
            this.input = '';
            
            


                
            try {
                await sendOpeyMessage(
                    userMessage.content,
                    this.thread_id,
                    false,
                    this.opeyContext
                )
                console.log('Opey Status: ', this.opeyContext.status)
            } catch (error) {
                console.error('Error in chat:', error);
                this.opeyContext.status = 'ready';
            }
        },
    },
}

</script>

<template>
    <div v-if="!chatOpen" class="chat-widget-button-container">
        <el-tooltip content="Chat with our AI, Opey" placement="left" effect="light">
            <el-button class="chat-widget-button" type="primary" size="large" @click="toggleChat" circle >
                <img alt="AI Help" src="@/assets/opey-icon-white.png" />
            </el-button>
        </el-tooltip>
    </div>

    <div v-if="chatOpen" class="chat-container">
        <div class="chat-container-inner">
            <el-container direction="vertical">
                <el-header>
                    <img alt="Opey Logo" src="@/assets/opey-logo-inv.png"> 
                    Chat with Opey
                    <el-button type="danger" :icon="Close" @click="toggleChat" size="small" circle></el-button>
                </el-header>
                <el-main>
                    <div class="messages-container">
                        <ChatMessage v-for="message in opeyContext.messages" :key="message.id" :message="message" />
                    </div>
                </el-main>
                <el-footer>
                    <el-form :inline="true" @submit.prevent>
                        <el-form-item label="Message">
                            <el-input v-model="input" placeholder="Type your message..." :disabled="opeyContext.status !== 'ready'" @keypress.enter="onSubmit" clearable />
                        </el-form-item>
                        <el-form-item>
                            <el-button type="primary" @click="onSubmit">Send</el-button>
                        </el-form-item>
                    </el-form>
                </el-footer>
            </el-container>
        </div>
    </div>
</template>

<style>


.chat-widget-button-container {
    position: fixed;
    bottom: 20px;
    right: 50px;
    width: 60px;
    height: 60px;
}

.chat-widget-button {
    width: 70px !important;
    height: 70px !important;
}

.chat-widget-button img {
    width: 100%;
    height: 100%;
}

.chat-container {
    position: fixed;
    bottom: 20px;
    right: 20px;
    width: 390px;
    height: 470px;
    min-width: 390px;
    min-height: 470px;
    max-height: 80vh;
    max-width: 80vw;
    background-color: tomato;
    resize: both;
    overflow: auto;
    transform: rotate(180deg);
    border-radius: 10px;
    box-shadow: 0 10px 20px 0 rgba(0, 0, 0, 0.2);
}

.chat-container .el-header, .chat-container .el-footer, .chat-container .el-main {
    display: flex;
    justify-content: center;
    align-items: center;
}

.chat-container .el-container {
    height: 100%;
}

.chat-container .el-header {
    justify-content: space-between;
}

.chat-container .el-header img {
    height: 50px;
}

.chat-container .el-header, .chat-container .el-footer {
    color: #fff;
    background-color: #253047;
}

.chat-container .el-main {
    background-color:#151d30;
    color: #fff;
}

.chat-container-inner {
    height: 100%;
    transform: rotate(180deg);
}

.messages-container {
    padding-left: 10px;
    padding-right: 10px;
}
</style>