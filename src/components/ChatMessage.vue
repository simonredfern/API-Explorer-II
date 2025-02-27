<script>

import MarkdownIt from "markdown-it";

// Imports for syntax highlighting
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
            highlightCode(content, language) {
                if (Prism.languages[language]) {
                    return Prism.highlight(content, Prism.languages[language], language);
                } else {
                    console.log(`could not highlight ${language} code block, add language to dependencies`)
                    // If the language is not recognized, return the content as is
                    return content;
                }
            },
            renderMarkdown(content) {
                const markdown = new MarkdownIt({
                    highlight: (str, lang) => {
                        console.log(`highlighting ${lang} code block`)
                        if (lang && Prism.languages[lang]) {
                            try {
                                return `<pre class="language-${lang}"><code>${this.highlightCode(str, lang)}</code></pre>`;
                            } catch (error) {
                                console.log(`error hilighting ${lang} code block: ${error}`)
                            }
                        } else if (!lang) {
                            console.warn('No language specified for code block')
                        } else if (!Prism.languages[lang]) {
                            console.warn(`Language ${lang} not recognized or not installed`)
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
    <div class="message-container" :class="this.message.role">
        <div class="content" v-html="renderMarkdown(this.message.content)"></div>
    </div>
</template>

<style>
.message-container {
    background-color: antiquewhite;
    color:black;
    font-family: 'Courier New', Courier, monospace;
    padding: 10px;
    margin: 10px 0 10px 0;
    display: flex;
}

.message-container.user {
    justify-content: flex-end;
    margin-left: auto;
    margin-right: 10px;
}
</style>