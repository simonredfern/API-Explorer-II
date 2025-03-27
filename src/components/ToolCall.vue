<script lang="ts">
import { ArrowDown, ArrowUp, RefreshRight, Check } from '@element-plus/icons-vue'

export default {
    props: {
        name: {
            type: String,
            required: true
        },
        status: {
            type: String,
            required: true
        },
        result: {
            type: Object,
            required: false
        },
        toolCallId: {
            type: String,
            required: true
        },
    },
    data() {
        return {
            expanded: false,
        }
    },
    methods: {
        toggleExpanded() {
            this.expanded = !this.expanded;
        },
    },
}

</script>


<template>
    <div class="tool-message-container" @click="toggleExpanded">
        <div class="status" v-bind:class="status">
            <div v-if="status === 'pending'">
                <el-icon class="is-loading" color="#20cbeb"><RefreshRight /></el-icon>
            </div>
            <div v-else-if="status === 'success'">
                <el-icon color="#00ff18"><Check /></el-icon>
            </div>
        </div>
        <div class="tool-name">{{ name }}</div>
        <div class="expand-icon">
            <el-icon><ArrowDown v-if="!expanded" /><ArrowUp v-else /></el-icon>
        </div>
    </div>
    <el-card v-if="expanded" class="tool-details">
        <template #header>
            <div class="tool-id">ID: {{ toolCallId }}</div>
        </template>
        <div v-if="result" class="tool-result">
            <h4>Result:</h4>
            <pre>{{ JSON.stringify(result, null, 2) }}</pre>
        </div>
        <template #body>
            
        </template>
        
        <!-- Add other information here -->
    </el-card>
</template>

<style scoped>

.tool-message-container {
    background-color: #253047;
    color:#fff;
    font-size: small;
    padding: 10px;
    border-radius: 10px;
    margin: 0 10px 0 0;
    display: flex;
    flex-direction: row;
    width: auto;
}

</style>