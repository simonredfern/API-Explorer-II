<!--
  - Open Bank Project -  API Explorer II
  - Copyright (C) 2023-2024, TESOBE GmbH
  -
  - This program is free software: you can redistribute it and/or modify
  - it under the terms of the GNU Affero General Public License as published by
  - the Free Software Foundation, either version 3 of the License, or
  - (at your option) any later version.
  -
  - This program is distributed in the hope that it will be useful,
  - but WITHOUT ANY WARRANTY; without even the implied warranty of
  - MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  - GNU Affero General Public License for more details.
  -
  - You should have received a copy of the GNU Affero General Public License
  - along with this program.  If not, see <http://www.gnu.org/licenses/>.
  -
  - Email: contact@tesobe.com
  - TESOBE GmbH
  - Osloerstrasse 16/17
  - Berlin 13359, Germany
  -
  -   This product includes software developed at
  -   TESOBE (http://www.tesobe.com/)
  -
  -->

<script setup lang="ts">
import { ref, onMounted, onUpdated, nextTick } from 'vue'

// Declare global hljs
declare global {
  interface Window {
    hljs: {
      highlightElement: (element: HTMLElement) => void
    }
  }
}

interface Props {
  code: any
  language?: string
}

const props = withDefaults(defineProps<Props>(), {
  language: 'json'
})

const codeBlockRef = ref<HTMLElement>()

const highlight = async () => {
  await nextTick()
  if (codeBlockRef.value && window.hljs) {
    const codeElements = codeBlockRef.value.querySelectorAll('pre code')
    codeElements.forEach((block) => {
      window.hljs.highlightElement(block as HTMLElement)
    })
  }
}

onMounted(() => {
  highlight()
})

onUpdated(() => {
  highlight()
})

const formattedCode = typeof props.code === 'string' 
  ? props.code 
  : JSON.stringify(props.code, null, 2)
</script>

<template>
  <div ref="codeBlockRef" class="code-block">
    <pre><code :class="language">{{ formattedCode }}</code></pre>
  </div>
</template>

<style scoped>
.code-block {
  margin: 1rem 0;
  border-radius: 8px;
  overflow: hidden;
  background: #1e1e1e;
  border: 1px solid #333;
}

.code-block pre {
  margin: 0;
  padding: 1.5rem;
  background: #1e1e1e;
  color: #ddd;
  font-family: 'Fira Code', 'Courier New', monospace;
  font-size: 14px;
  line-height: 1.5;
  overflow-x: auto;
  white-space: pre-wrap;
  word-wrap: break-word;
}

.code-block code {
  background: transparent;
  padding: 0;
  border-radius: 0;
  font-family: inherit;
  font-size: inherit;
}

/* Custom scrollbar for code blocks */
.code-block pre::-webkit-scrollbar {
  height: 8px;
  width: 8px;
}

.code-block pre::-webkit-scrollbar-track {
  background: #2d2d2d;
}

.code-block pre::-webkit-scrollbar-thumb {
  background: #555;
  border-radius: 4px;
}

.code-block pre::-webkit-scrollbar-thumb:hover {
  background: #777;
}

/* Syntax highlighting enhancements */
.code-block :deep(.hljs-string) {
  color: #98c379;
}

.code-block :deep(.hljs-number) {
  color: #d19a66;
}

.code-block :deep(.hljs-literal) {
  color: #56b6c2;
}

.code-block :deep(.hljs-attr) {
  color: #e06c75;
}

.code-block :deep(.hljs-punctuation) {
  color: #abb2bf;
}
</style>