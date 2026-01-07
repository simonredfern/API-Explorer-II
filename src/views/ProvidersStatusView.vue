<!--
  Open Bank Project -  API Explorer II
  Copyright (C) 2023-2025, TESOBE GmbH

  This program is free software: you can redistribute it and/or modify
  it under the terms of the GNU Affero General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  GNU Affero General Public License for more details.

  You should have received a copy of the GNU Affero General Public License
  along with this program.  If not, see <http://www.gnu.org/licenses/>.

  Email: contact@tesobe.com
  TESOBE GmbH
  Osloerstrasse 16/17
  Berlin 13359, Germany

    This product includes software developed at
    TESOBE (http://www.tesobe.com/)
-->

<template>
  <div class="providers-status-view">
    <h1>OAuth2 Provider Configuration Status</h1>

    <el-alert type="info" :closable="false" style="margin-bottom: 20px">
      <p>This page shows which OAuth2/OIDC identity providers are configured and available for login.</p>
      <p><strong>Note:</strong> Client secrets are masked for security.</p>
      <p>
        <strong>Need more details?</strong> Visit the
        <router-link to="/debug/oidc" style="color: #409eff; text-decoration: underline;">
          OIDC Debug Page
        </router-link>
        for detailed discovery process information.
      </p>
    </el-alert>

    <div v-if="loading" v-loading="loading" class="loading-container">
      <p>Loading provider status...</p>
    </div>

    <div v-else-if="error" class="error-container">
      <el-alert type="error" :closable="false">
        <p><strong>Error loading provider status:</strong></p>
        <p>{{ error }}</p>
      </el-alert>
    </div>

    <div v-else-if="status" class="status-container">
      <!-- Summary Card -->
      <el-card class="summary-card" shadow="hover">
        <template #header>
          <div class="card-header">
            <span>Summary</span>
            <el-button size="small" @click="refreshStatus">
              <el-icon><Refresh /></el-icon>
              Refresh
            </el-button>
          </div>
        </template>
        <div class="summary-content">
          <div class="summary-item">
            <label>Total Configured Providers:</label>
            <span class="value">{{ status.summary.totalConfigured }}</span>
          </div>
          <div class="summary-item">
            <label>Available Providers:</label>
            <span class="value">{{ status.summary.availableProviders.join(', ') || 'None' }}</span>
          </div>
          <div class="summary-item">
            <label>OBP API Host:</label>
            <span class="value">{{ status.summary.obpApiHost }}</span>
          </div>
        </div>
      </el-card>

      <!-- Provider Status Cards -->
      <h2>Active Providers</h2>
      <div v-if="status.providerStatus.length === 0" class="no-providers">
        <el-empty description="No providers configured">
          <el-button type="primary" @click="openDocs">View Setup Guide</el-button>
        </el-empty>
      </div>
      <div v-else class="provider-cards">
        <el-card
          v-for="provider in status.providerStatus"
          :key="provider.name"
          class="provider-card"
          :class="{ 'provider-healthy': provider.available, 'provider-unhealthy': !provider.available }"
          shadow="hover"
        >
          <template #header>
            <div class="provider-header">
              <span class="provider-name">{{ getProviderDisplayName(provider.name) }}</span>
              <el-tag :type="provider.available ? 'success' : 'danger'" size="small">
                {{ provider.status }}
              </el-tag>
            </div>
          </template>
          <div class="provider-content">
            <div class="provider-detail">
              <label>Provider ID:</label>
              <span>{{ provider.name }}</span>
            </div>
            <div class="provider-detail">
              <label>Status:</label>
              <span :class="provider.available ? 'status-ok' : 'status-error'">
                {{ provider.available ? 'Available' : 'Unavailable' }}
              </span>
            </div>
            <div class="provider-detail">
              <label>Last Checked:</label>
              <span>{{ formatDate(provider.lastChecked) }}</span>
            </div>
            <div v-if="provider.error" class="provider-detail error-detail">
              <label>Error:</label>
              <span class="error-message">{{ provider.error }}</span>
            </div>
          </div>
        </el-card>
      </div>

      <!-- Environment Configuration -->
      <h2>Environment Configuration</h2>
      <el-collapse v-model="activeCollapse">
        <el-collapse-item
          v-for="(config, providerKey) in status.environmentConfig"
          :key="providerKey"
          :name="providerKey"
        >
          <template #title>
            <div class="collapse-title">
              <span class="provider-label">{{ getProviderDisplayName(providerKey) }}</span>
              <el-tag v-if="isProviderConfigured(config)" type="success" size="small">
                Configured
              </el-tag>
              <el-tag v-else type="info" size="small">
                Not Configured
              </el-tag>
            </div>
          </template>
          <div class="env-config-content">
            <div v-for="(value, key) in config" :key="key" class="config-item">
              <label>{{ formatConfigKey(key) }}:</label>
              <code>{{ value }}</code>
            </div>
          </div>
        </el-collapse-item>
      </el-collapse>

      <div class="note">
        <el-icon><InfoFilled /></el-icon>
        <span>{{ status.note }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Refresh, InfoFilled } from '@element-plus/icons-vue'

interface ProviderStatus {
  name: string
  available: boolean
  status: string
  lastChecked: Date
  error?: string
}

interface EnvConfig {
  [key: string]: {
    [key: string]: string
  }
}

interface StatusResponse {
  summary: {
    totalConfigured: number
    availableProviders: string[]
    obpApiHost: string
  }
  providerStatus: ProviderStatus[]
  environmentConfig: EnvConfig
  note: string
}

const loading = ref(true)
const error = ref<string | null>(null)
const status = ref<StatusResponse | null>(null)
const activeCollapse = ref<string[]>(['obpOidc', 'keycloak', 'google', 'github', 'custom'])

const fetchStatus = async () => {
  loading.value = true
  error.value = null

  try {
    const response = await fetch('/api/status/providers')
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    status.value = await response.json()
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Unknown error'
    ElMessage.error('Failed to load provider status')
  } finally {
    loading.value = false
  }
}

const refreshStatus = async () => {
  ElMessage.info('Refreshing provider status...')
  await fetchStatus()
  ElMessage.success('Provider status refreshed')
}

const getProviderDisplayName = (key: string): string => {
  const names: { [key: string]: string } = {
    'obp-oidc': 'OBP-OIDC',
    'obpOidc': 'OBP-OIDC',
    'keycloak': 'Keycloak',
    'google': 'Google',
    'github': 'GitHub',
    'custom': 'Custom Provider'
  }
  return names[key] || key.toUpperCase()
}

const formatConfigKey = (key: string): string => {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .trim()
}

const formatDate = (date: Date | string): string => {
  if (!date) return 'Never'
  const d = new Date(date)
  return d.toLocaleString()
}

const isProviderConfigured = (config: { [key: string]: string }): boolean => {
  return Object.values(config).some(
    (value) => value && value !== 'not configured' && value !== '***masked***'
  )
}

const openDocs = () => {
  window.open('https://github.com/OpenBankProject/OBP-API/wiki/OAuth2', '_blank')
}

onMounted(() => {
  fetchStatus()
})
</script>

<style scoped>
.providers-status-view {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

h1 {
  font-size: 28px;
  margin-bottom: 20px;
  color: #303133;
}

h2 {
  font-size: 20px;
  margin: 30px 0 15px 0;
  color: #606266;
}

.loading-container {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 60px;
  font-size: 16px;
  color: #909399;
}

.error-container {
  margin: 20px 0;
}

/* Summary Card */
.summary-card {
  margin-bottom: 30px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 600;
}

.summary-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.summary-item {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid #f0f0f0;
}

.summary-item:last-child {
  border-bottom: none;
}

.summary-item label {
  font-weight: 500;
  color: #606266;
}

.summary-item .value {
  font-family: 'Courier New', monospace;
  color: #303133;
}

/* Provider Cards */
.no-providers {
  padding: 40px;
  text-align: center;
}

.provider-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
}

.provider-card {
  transition: transform 0.2s;
}

.provider-card:hover {
  transform: translateY(-2px);
}

.provider-healthy {
  border-left: 4px solid #67c23a;
}

.provider-unhealthy {
  border-left: 4px solid #f56c6c;
}

.provider-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.provider-name {
  font-size: 16px;
  font-weight: 600;
}

.provider-content {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.provider-detail {
  display: flex;
  justify-content: space-between;
  padding: 6px 0;
  font-size: 14px;
}

.provider-detail label {
  font-weight: 500;
  color: #909399;
  margin-right: 10px;
}

.provider-detail span {
  color: #303133;
}

.status-ok {
  color: #67c23a;
  font-weight: 600;
}

.status-error {
  color: #f56c6c;
  font-weight: 600;
}

.error-detail {
  background: #fef0f0;
  padding: 8px;
  border-radius: 4px;
  flex-direction: column;
  align-items: flex-start;
}

.error-message {
  color: #f56c6c;
  font-family: 'Courier New', monospace;
  font-size: 12px;
  word-break: break-all;
}

/* Environment Config */
.collapse-title {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
}

.provider-label {
  font-weight: 500;
}

.env-config-content {
  padding: 10px 20px;
  background: #fafafa;
  border-radius: 4px;
}

.config-item {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid #e4e7ed;
}

.config-item:last-child {
  border-bottom: none;
}

.config-item label {
  font-weight: 500;
  color: #606266;
  min-width: 150px;
}

.config-item code {
  background: #fff;
  padding: 4px 8px;
  border-radius: 3px;
  font-family: 'Courier New', monospace;
  font-size: 13px;
  color: #303133;
  border: 1px solid #dcdfe6;
}

/* Note */
.note {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 30px;
  padding: 12px;
  background: #f4f4f5;
  border-radius: 4px;
  font-size: 14px;
  color: #606266;
}

.note .el-icon {
  color: #909399;
}
</style>
