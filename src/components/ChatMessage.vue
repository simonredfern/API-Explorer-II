<script lang="ts">

import MarkdownIt from "markdown-it";

// Imports for syntax highlighting
// Languages that we want syntax highlighting for need to be imported here
import Prism from 'prismjs';
import 'prismjs/themes/prism.css'
import 'prismjs/components/prism-bash'
import 'prismjs/components/prism-javascript'
import 'prismjs/components/prism-python'
import 'prismjs/components/prism-go'
import 'prismjs/components/prism-json'
import 'prismjs/components/prism-liquid'
import 'prismjs/components/prism-markdown'
import 'prismjs/components/prism-markup-templating'
import 'prismjs/components/prism-php'
import 'prismjs/components/prism-scss'
import 'prismjs/components/prism-yaml'
import 'prismjs/components/prism-markup';
import 'prismjs/components/prism-http';
import 'prismjs/themes/prism-okaidia.css';

import { Warning } from '@element-plus/icons-vue'
import type { ToolMessage } from "@/models/MessageModel";

export default {
    props: {
        message: {
            type: Object,
            required: true
        }
    },
    data() {
        return {
            type: '',
            content: ''
        }
    },
    methods: {
        highlightCode(content: string, language: string) {
            if (Prism.languages[language]) {
                return Prism.highlight(content, Prism.languages[language], language);
            } else {
                console.log(`could not highlight ${language} code block, add language to dependencies`)
                // If the language is not recognized, return the content as is
                return content;
            }
        },
        renderMarkdown(content: string) {
            const markdown = new MarkdownIt({
                highlight: (str, lang): string => {
                    if (lang && Prism.languages[lang]) {
                        try {
                            return `<pre class="language-${lang}"><code>${this.highlightCode(str, lang)}</code></pre>`;
                        } catch (error) {
                            console.log(`error hilighting ${lang} code block: ${error}`)
                        }
                    } else if (!lang) {
                        console.warn('No language specified for code block')
                    } else if (!Prism.languages[lang]) {
                        console.warn(`Language ${lang} not recognized or not installed, see imports for this component`)
                    }

                    // If the language is not specified or not recognized, use a default language
                    return `<pre class="language-"><code>${markdown.utils.escapeHtml(str)}</code></pre>`;
                }
            });

            return markdown.render(content);
        },
    }
}
</script>

<template>
    <div v-if="message.role !== 'tool'" :class="message.role">
        <div class="message-container">
            <div class="content" v-html="renderMarkdown(message.content)"></div>
        </div>
        <div v-if="message.error" class="error"><el-icon><Warning /></el-icon> {{ message.error }}</div>
    </div>
    <div v-else-if="message.role === 'tool'">
        <div class="tool-message-container">
            <el-collapse>
                <el-collapse-item title="Tool Message">
                    {{ message.args }}
                </el-collapse-item>
            </el-collapse>
        </div>
    </div>
    
</template>

<style>
.message-container {
    background-color: antiquewhite;
    color:black;
    padding: 10px;
    margin: 10px 0 10px 0;
    display: flex;
    flex-direction: column;
    width: fit-content;
    max-width: min(600px, calc(100% - 60px));
}

.tool-message-container {
    background-color: antiquewhite;
    color:black;
    padding: 10px;
    margin: 10px 0 10px 0;
    display: flex;
    flex-direction: column;
    width: fit-content;
    max-width: min(600px, calc(100% - 60px));
}

.user, .assistant {
    display: flex;
    flex-direction: column;
    font-family: 'Courier New', Courier, monospace;
}

.user .error {
    color: red;
    font-weight: bold;
    align-self: flex-end;
    font-size: smaller;
}

.user .message-container {
    margin-left: auto;
    margin-right: 0px;
    border-radius: 10px 10px 0 10px;
    align-items: flex-end;
    flex-basis: content;
    justify-content: flex-end;
    color: white;
    background-color: #2b303b;
}

.assistant .message-container {
    border-radius: 10px 10px 10px 0px;
    margin-left: 0px;
    margin-right: auto;
    align-items: flex-start;
    color: white;
    background-color: #3e4e70;
}

.content {
    margin-top: -10px;
    margin-bottom: -10px;
}
</style>