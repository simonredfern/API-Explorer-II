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

<script lang="ts">
  import { onMount } from 'svelte';

  interface ProviderStatus {
    name: string;
    available: boolean;
    status: string;
    lastChecked: Date;
    error?: string;
  }

  interface EnvConfig {
    [key: string]: {
      [key: string]: string;
    };
  }

  interface StatusResponse {
    summary: {
      totalConfigured: number;
      availableProviders: string[];
      obpApiHost: string;
    };
    providerStatus: ProviderStatus[];
    environmentConfig: EnvConfig;
    note: string;
  }

  let loading = true;
  let error: string | null = null;
  let status: StatusResponse | null = null;
  let expandedProviders: Set<string> = new Set();

  async function fetchStatus() {
    loading = true;
    error = null;

    try {
      const response = await fetch('/api/status/providers');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      status = await response.json();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Unknown error';
    } finally {
      loading = false;
    }
  }

  async function refreshStatus() {
    await fetchStatus();
  }

  function toggleProvider(key: string) {
    if (expandedProviders.has(key)) {
      expandedProviders.delete(key);
    } else {
      expandedProviders.add(key);
    }
    expandedProviders = expandedProviders;
  }

  function getProviderDisplayName(key: string): string {
    const names: { [key: string]: string } = {
      'obp-oidc': 'OBP-OIDC',
      'obpOidc': 'OBP-OIDC',
      'keycloak': 'Keycloak',
      'google': 'Google',
      'github': 'GitHub',
      'custom': 'Custom Provider'
    };
    return names[key] || key.toUpperCase();
  }

  function formatConfigKey(key: string): string {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (str) => str.toUpperCase())
      .trim();
  }

  function formatDate(date: Date | string): string {
    if (!date) return 'Never';
    const d = new Date(date);
    return d.toLocaleString();
  }

  function isProviderConfigured(config: { [key: string]: string }): boolean {
    return Object.values(config).some(
      (value) => value && value !== 'not configured' && value !== '***masked***'
    );
  }

  onMount(() => {
    fetchStatus();
  });
</script>

<svelte:head>
  <title>OAuth2 Provider Configuration Status</title>
</svelte:head>

<div class="providers-status-view">
  <h1>OAuth2 Provider Configuration Status</h1>

  <div class="info-alert">
    <p>This page shows which OAuth2/OIDC identity providers are configured and available for login.</p>
    <p><strong>Note:</strong> Client secrets are masked for security.</p>
  </div>

  {#if loading}
    <div class="loading">
      <div class="spinner"></div>
      <span>Loading provider status...</span>
    </div>
  {:else if error}
    <div class="error-alert">
      <p><strong>Error loading provider status:</strong></p>
      <p>{error}</p>
    </div>
  {:else if status}
    <div class="status-container">
      <!-- Summary Card -->
      <div class="card summary-card">
        <div class="card-header">
          <span>Summary</span>
          <button class="btn-refresh" on:click={refreshStatus}>
            <span class="icon">↻</span>
            Refresh
          </button>
        </div>
        <div class="summary-content">
          <div class="summary-item">
            <label>Total Configured Providers:</label>
            <span class="value">{status.summary.totalConfigured}</span>
          </div>
          <div class="summary-item">
            <label>Available Providers:</label>
            <span class="value">{status.summary.availableProviders.join(', ') || 'None'}</span>
          </div>
          <div class="summary-item">
            <label>OBP API Host:</label>
            <span class="value">{status.summary.obpApiHost}</span>
          </div>
        </div>
      </div>

      <!-- Provider Status Cards -->
      <h2>Active Providers</h2>
      {#if status.providerStatus.length === 0}
        <div class="no-providers">
          <p>No providers configured</p>
          <a href="https://github.com/OpenBankProject/OBP-API/wiki/OAuth2" target="_blank" class="btn-primary">
            View Setup Guide
          </a>
        </div>
      {:else}
        <div class="provider-cards">
          {#each status.providerStatus as provider (provider.name)}
            <div class="card provider-card" class:provider-healthy={provider.available} class:provider-unhealthy={!provider.available}>
              <div class="provider-header">
                <span class="provider-name">{getProviderDisplayName(provider.name)}</span>
                <span class="tag" class:tag-success={provider.available} class:tag-danger={!provider.available}>
                  {provider.status}
                </span>
              </div>
              <div class="provider-content">
                <div class="provider-detail">
                  <label>Provider ID:</label>
                  <span>{provider.name}</span>
                </div>
                <div class="provider-detail">
                  <label>Status:</label>
                  <span class:status-ok={provider.available} class:status-error={!provider.available}>
                    {provider.available ? 'Available' : 'Unavailable'}
                  </span>
                </div>
                <div class="provider-detail">
                  <label>Last Checked:</label>
                  <span>{formatDate(provider.lastChecked)}</span>
                </div>
                {#if provider.error}
                  <div class="provider-detail error-detail">
                    <label>Error:</label>
                    <span class="error-message">{provider.error}</span>
                  </div>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      {/if}

      <!-- Environment Configuration -->
      <h2>Environment Configuration</h2>
      <div class="env-config">
        {#each Object.entries(status.environmentConfig) as [providerKey, config]}
          <div class="collapse-item">
            <button class="collapse-header" on:click={() => toggleProvider(providerKey)}>
              <span class="collapse-title">
                <span class="provider-label">{getProviderDisplayName(providerKey)}</span>
                <span class="tag" class:tag-success={isProviderConfigured(config)} class:tag-info={!isProviderConfigured(config)}>
                  {isProviderConfigured(config) ? 'Configured' : 'Not Configured'}
                </span>
              </span>
              <span class="collapse-icon">{expandedProviders.has(providerKey) ? '▼' : '▶'}</span>
            </button>
            {#if expandedProviders.has(providerKey)}
              <div class="collapse-content">
                {#each Object.entries(config) as [key, value]}
                  <div class="config-item">
                    <label>{formatConfigKey(key)}:</label>
                    <code>{value}</code>
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        {/each}
      </div>

      <div class="note">
        <span class="icon">ℹ️</span>
        <span>{status.note}</span>
      </div>
    </div>
  {/if}
</div>

<style>
  .providers-status-view {
    max-width: 1200px;
    margin: 0 auto;
    padding: 20px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
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

  /* Alerts */
  .info-alert {
    padding: 12px 16px;
    background: #f4f4f5;
    border-left: 4px solid #409eff;
    border-radius: 4px;
    margin-bottom: 20px;
    color: #606266;
  }

  .info-alert p {
    margin: 6px 0;
  }

  .error-alert {
    padding: 12px 16px;
    background: #fef0f0;
    border-left: 4px solid #f56c6c;
    border-radius: 4px;
    margin: 20px 0;
    color: #f56c6c;
  }

  .error-alert p {
    margin: 6px 0;
  }

  /* Loading */
  .loading {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 60px;
    font-size: 16px;
    color: #909399;
  }

  .spinner {
    width: 24px;
    height: 24px;
    border: 3px solid #f3f3f3;
    border-top: 3px solid #409eff;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-right: 10px;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  /* Card */
  .card {
    background: white;
    border: 1px solid #ebeef5;
    border-radius: 4px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    transition: box-shadow 0.3s;
  }

  .card:hover {
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
  }

  /* Summary Card */
  .summary-card {
    margin-bottom: 30px;
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px;
    border-bottom: 1px solid #ebeef5;
    font-weight: 600;
    font-size: 16px;
  }

  .btn-refresh {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    background: #409eff;
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 14px;
    cursor: pointer;
    transition: background 0.3s;
  }

  .btn-refresh:hover {
    background: #66b1ff;
  }

  .btn-refresh .icon {
    font-size: 18px;
  }

  .summary-content {
    padding: 16px;
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
    background: white;
    border: 1px solid #ebeef5;
    border-radius: 4px;
  }

  .btn-primary {
    display: inline-block;
    margin-top: 16px;
    padding: 10px 20px;
    background: #409eff;
    color: white;
    text-decoration: none;
    border-radius: 4px;
    transition: background 0.3s;
  }

  .btn-primary:hover {
    background: #66b1ff;
  }

  .provider-cards {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
    gap: 20px;
    margin-bottom: 30px;
  }

  .provider-card {
    padding: 16px;
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
    margin-bottom: 12px;
  }

  .provider-name {
    font-size: 16px;
    font-weight: 600;
  }

  .tag {
    padding: 4px 12px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 500;
  }

  .tag-success {
    background: #f0f9ff;
    color: #67c23a;
    border: 1px solid #b3e19d;
  }

  .tag-danger {
    background: #fef0f0;
    color: #f56c6c;
    border: 1px solid #fbc4c4;
  }

  .tag-info {
    background: #f4f4f5;
    color: #909399;
    border: 1px solid #d3d4d6;
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
  .env-config {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .collapse-item {
    background: white;
    border: 1px solid #ebeef5;
    border-radius: 4px;
    overflow: hidden;
  }

  .collapse-header {
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    background: #fafafa;
    border: none;
    cursor: pointer;
    transition: background 0.3s;
  }

  .collapse-header:hover {
    background: #f0f0f0;
  }

  .collapse-title {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .provider-label {
    font-weight: 500;
  }

  .collapse-icon {
    font-size: 12px;
    color: #909399;
  }

  .collapse-content {
    padding: 16px;
    background: #fafafa;
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
    background: white;
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
</style>
