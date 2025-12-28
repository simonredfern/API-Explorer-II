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
import { ref, inject, watchEffect, onMounted, onUnmounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { OBP_API_DEFAULT_RESOURCE_DOC_VERSION, getCurrentUser } from '../obp'
import { getOBPAPIVersions } from '../obp/api-version'
import {
  LOGO_URL as logoSource,
  HEADER_LINKS_COLOR,
  HEADER_LINKS_HOVER_COLOR as headerLinksHoverColorSetting,
  HEADER_LINKS_BACKGROUND_COLOR as headerLinksBackgroundColorSetting
} from '../obp/style-setting'
import { obpApiActiveVersionsKey, obpGroupedMessageDocsKey, obpMyCollectionsEndpointKey } from '@/obp/keys'
import SvelteDropdown from './SvelteDropdown.vue'

const route = useRoute()
const router = useRouter()
const obpApiHost = ref(import.meta.env.VITE_OBP_API_HOST)
const obpApiPortalHost = ref(import.meta.env.VITE_OBP_API_PORTAL_HOST)
const obpApiHybridPost = computed(() => obpApiPortalHost.value ? obpApiPortalHost.value : obpApiHost.value)
const obpApiManagerHost = ref(import.meta.env.VITE_OBP_API_MANAGER_HOST)
const hasObpApiManagerHost = computed(() => obpApiManagerHost.value ? true : false)
const showObpApiManagerButton = computed(() => import.meta.env.VITE_SHOW_API_MANAGER_BUTTON === 'true')
const loginUsername = ref('')
const logoffurl = ref('')
const obpApiVersions = ref(inject(obpApiActiveVersionsKey) || [])
const obpMessageDocs = ref(Object.keys(inject(obpGroupedMessageDocsKey) || {}))

// Split versions into main and other
const mainVersions = ['BGv1.3', 'OBPv5.1.0', 'OBPv6.0.0', 'UKv3.1', 'dynamic-endpoints', 'dynamic-entities', 'OBPdynamic-endpoint', 'OBPdynamic-entity']
const sortedVersions = computed(() => {
  const all = obpApiVersions.value || []
  console.log('All available versions:', all)
  const main = mainVersions.filter(v => all.includes(v))
  console.log('Main versions found:', main)
  const others = all.filter(v => !mainVersions.includes(v)).sort()
  console.log('Other versions:', others)

  // Only add divider if we have both main and other versions
  if (main.length > 0 && others.length > 0) {
    return [...main, '---', ...others]
  } else if (main.length > 0) {
    return main
  } else {
    return others
  }
})

const isShowLoginButton = ref(true)
const isShowLogOffButton = ref(false)
const oauth2Available = ref(true) // Assume available initially
const oauth2StatusMessage = ref('')
const logo = ref(logoSource)
const headerLinksHoverColor = ref(headerLinksHoverColorSetting)
const headerLinksBackgroundColor = ref(headerLinksBackgroundColorSetting)

// Multi-provider support
const availableProviders = ref<Array<{ name: string; available: boolean; lastChecked?: Date; error?: string }>>([])
const showProviderSelector = ref(false)
const isLoadingProviders = ref(false)

// Check OAuth2 availability
let oauth2CheckInterval: number | null = null

async function checkOAuth2Availability() {
  try {
    const response = await fetch('/api/status/oauth2')
    const data = await response.json()
    const wasAvailable = oauth2Available.value
    oauth2Available.value = data.available
    oauth2StatusMessage.value = data.message || ''

    // Log state changes
    if (!wasAvailable && data.available) {
      console.log('OAuth2 is now available')
    } else if (wasAvailable && !data.available) {
      console.warn('OAuth2 is no longer available!')
    }
  } catch (error) {
    oauth2Available.value = false
    oauth2StatusMessage.value = 'Failed to check OAuth2 status'
    console.error('Error checking OAuth2 status:', error)
  }
}

// Fetch available OIDC providers
async function fetchAvailableProviders() {
  isLoadingProviders.value = true
  try {
    const response = await fetch('/api/oauth2/providers')
    const data = await response.json()

    if (data.providers && Array.isArray(data.providers)) {
      availableProviders.value = data.providers
      console.log('Available OAuth2 providers:', availableProviders.value)
      console.log(`Total: ${data.count}, Available: ${data.availableCount}`)
    } else {
      console.warn('No providers returned from /api/oauth2/providers')
      availableProviders.value = []
    }
  } catch (error) {
    console.error('Failed to fetch OAuth2 providers:', error)
    availableProviders.value = []
  } finally {
    isLoadingProviders.value = false
  }
}

// Handle login button click
function handleLoginClick() {
  const available = availableProviders.value.filter(p => p.available)

  if (available.length > 1) {
    // Show provider selection dialog
    showProviderSelector.value = true
  } else if (available.length === 1) {
    // Direct login with single provider
    loginWithProvider(available[0].name)
  } else {
    // Fallback to legacy login (no provider parameter)
    window.location.href = '/api/oauth2/connect?redirect=' + encodeURIComponent(getCurrentPath())
  }
}

// Login with selected provider
function loginWithProvider(provider: string) {
  const redirectUrl = '/api/oauth2/connect?provider=' +
    encodeURIComponent(provider) +
    '&redirect=' +
    encodeURIComponent(getCurrentPath())
  console.log(`Logging in with provider: ${provider}`)
  window.location.href = redirectUrl
}

// Format provider name for display
function formatProviderName(name: string): string {
  // Convert "obp-oidc" to "OBP OIDC", "keycloak" to "Keycloak", etc.
  return name.split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

// Get provider icon
function getProviderIcon(name: string): string {
  const icons: Record<string, string> = {
    'obp-oidc': '🏦',
    'keycloak': '🔐',
    'google': '🔵',
    'github': '🐙'
  }
  return icons[name] || '🔑'
}

const clearActiveTab = () => {
  const activeLinks = document.querySelectorAll<HTMLElement>('.router-link')
  for (const active of activeLinks) {
    // Skip login and logoff buttons
    if (active.id && active.id !== 'login' && active.id !== 'logoff') {
      active.style.backgroundColor = 'transparent'
      active.style.color = '#39455f'
    }
  }
}

const setActive = (target: HTMLElement | null) => {
  if (target) {
    clearActiveTab()
    target.style.backgroundColor = headerLinksBackgroundColor.value
    target.style.color = HEADER_LINKS_COLOR
  }
}

const handleMore = (command: string) => {
  console.log('handleMore called with command:', command)

  // Ignore divider
  if (command === '---') {
    return
  }

  let element = document.getElementById("selected-api-version")
  if (element !== null) {
    element.textContent = command;
  }
  if (command === '/message-docs') {
    // Navigate to message docs list
    console.log('Navigating to message docs list')
    router.push({ name: 'message-docs-list' })
  } else if (command.includes('_')) {
    console.log('Navigating to message docs:', command)
    router.push({ name: 'message-docs', params: { id: command } })
  } else {
    console.log('Navigating to resource docs:', `/resource-docs/${command}`)
    console.log('Current route:', route.path)
    // Clear operationid query param when changing versions to avoid showing non-existent operation
    router.push(`/resource-docs/${command}`)
  }
}

onMounted(async () => {
  // Initial OAuth2 availability check
  await checkOAuth2Availability()

  // Fetch available providers
  await fetchAvailableProviders()

  // Start continuous polling every 4 minutes to detect OIDC outages
  console.log('OAuth2: Starting continuous monitoring (every 4 minutes)...')
  oauth2CheckInterval = window.setInterval(checkOAuth2Availability, 240000) // 4 minutes

  const currentUser = await getCurrentUser()
  const currentResponseKeys = Object.keys(currentUser)
  if (currentResponseKeys.includes('username')) {
    loginUsername.value = currentUser.username
    isShowLoginButton.value = false
    isShowLogOffButton.value = !isShowLoginButton.value
  } else {
    isShowLoginButton.value = true
    isShowLogOffButton.value = !isShowLoginButton.value
  }
})

onUnmounted(() => {
  // Clean up polling interval
  if (oauth2CheckInterval) {
    clearInterval(oauth2CheckInterval)
    oauth2CheckInterval = null
  }
})

watchEffect(() => {
  const routeName = typeof route.name === 'string' ? route.name : null
  if (routeName && route.params && !route.params.id) {
    setActive(document.getElementById(`header-nav-${routeName}`))
  } else {
    if (routeName === 'message-docs') {
      clearActiveTab()
    } else {
      setActive(document.getElementById('header-nav-tags'))
    }
  }
})

const getCurrentPath = () => {
  const currentPath = route.path
  const queryString = new URLSearchParams(route.query as Record<string, string>).toString()
  return queryString ? `${currentPath}?${queryString}` : currentPath
}

</script>

<template>
  <img alt="OBP logo" class="logo" v-show="logo" :src="logo" />
  <img alt="OBP logo" class="logo" v-show="!logo" src="@/assets/logo2x-1.png" />
  <nav id="nav">
    <RouterView name="header">
      <a v-bind:href="obpApiHybridPost" class="router-link" id="header-nav-home">
        {{ $t('header.portal_home') }}
      </a>
      <RouterLink class="router-link" id="header-nav-tags" :to="'/resource-docs/' + OBP_API_DEFAULT_RESOURCE_DOC_VERSION">{{
        $t('header.api_explorer') }}</RouterLink>
      <RouterLink class="router-link" id="header-nav-glossary" to="/glossary">{{
        $t('header.glossary')
      }}</RouterLink>
      <RouterLink class="router-link" id="header-nav-help" to="/help">{{
        $t('header.help')
      }}</RouterLink>
      <a v-if="showObpApiManagerButton && hasObpApiManagerHost" v-bind:href="obpApiManagerHost" class="router-link" id="header-nav-api-manager">
        {{ $t('header.api_manager') }}
      </a>
      <SvelteDropdown
        class="menu-right"
        id="header-nav-versions"
        label="Versions"
        :items="sortedVersions"
        :hover-color="headerLinksHoverColor"
        :background-color="headerLinksBackgroundColor"
        @select="handleMore"
      />
      <SvelteDropdown
        class="menu-right"
        id="header-nav-message-docs"
        label="Message Docs"
        :items="obpMessageDocs"
        :hover-color="headerLinksHoverColor"
        :background-color="headerLinksBackgroundColor"
        @select="handleMore"
      />
      <!--<span class="el-dropdown-link">
        <RouterLink class="router-link" id="header-nav-spaces" to="/spaces">{{
          $t('header.spaces')
        }}</RouterLink>
        <el-icon class="el-icon--right">
          <arrow-down />
        </el-icon>
      </span>-->
      <el-tooltip v-if="isShowLoginButton && !oauth2Available" :content="oauth2StatusMessage || 'OAuth2 server not available'" placement="bottom">
        <button disabled class="login-button-disabled router-link" id="login">
          {{ $t('header.login') }}
        </button>
      </el-tooltip>
      <button
        v-else-if="isShowLoginButton && oauth2Available"
        @click="handleLoginClick"
        class="login-button router-link"
        id="login"
      >
        {{ $t('header.login') }}
        <span v-if="availableProviders.filter(p => p.available).length > 1" style="margin-left: 4px;">▼</span>
      </button>
      <span v-show="isShowLogOffButton" class="login-user">{{ loginUsername }}</span>
      <a v-bind:href="'/api/user/logoff?redirect=' + encodeURIComponent(getCurrentPath())" v-show="isShowLogOffButton" class="logoff-button router-link" id="logoff">
        {{ $t('header.logoff') }}
      </a>
    </RouterView>
  </nav>

  <!-- Provider Selection Dialog -->
  <el-dialog
    v-model="showProviderSelector"
    title="Select Identity Provider"
    width="450px"
    :close-on-click-modal="true"
  >
    <div class="provider-list">
      <div
        v-for="provider in availableProviders.filter(p => p.available)"
        :key="provider.name"
        class="provider-item"
        @click="loginWithProvider(provider.name); showProviderSelector = false"
      >
        <div class="provider-icon">{{ getProviderIcon(provider.name) }}</div>
        <div class="provider-info">
          <h4>{{ formatProviderName(provider.name) }}</h4>
          <span class="provider-status">Available</span>
        </div>
        <div class="provider-arrow">→</div>
      </div>

      <div v-if="availableProviders.filter(p => p.available).length === 0" class="no-providers">
        <p>No identity providers available</p>
        <p class="error-hint">Please contact your administrator</p>
      </div>
    </div>
  </el-dialog>
</template>

<style>
nav {
  text-align: right;
  display: table-cell;
  vertical-align: middle;
}

.logo {
  display: table-cell;
  vertical-align: middle;
  transform: translateY(-50%);
  top: 50%;
}

.header {
  position: relative;
  display: table;
}

.header::after {
  content: '';
  position: absolute;
  left: 0;
  bottom: 0;
  width: 100%;
  height: 1px;
  background-color: var(--el-border-color-light);
  z-index: var(--el-index-normal);
}

.login-user {
  font-family: 'Roboto';
  padding: 9px;
  color: #39455f;
  font-size: 14px;
  border-radius: 8px;
}

.router-link {
  padding: 9px;
  margin: 3px;
  color: #39455f;
  font-family: 'Roboto';
  font-size: 14px;
  text-decoration: none;
  border-radius: 8px;
}

.router-link:hover {
  background-color: v-bind(headerLinksBackgroundColor) !important;
  color: v-bind(headerLinksHoverColor) !important;
}

.logo {
  height: 40px;
  position: absolute;
  cursor: pointer;
}

a.login-button,
a.logoff-button,
button.login-button {
  margin: 5px;
  color: #ffffff;
  background-color: #32b9ce;
  cursor: pointer;
  border: none;
}

button.login-button-disabled {
  margin: 5px;
  padding: 9px;
  color: #999999;
  background-color: #e0e0e0;
  border: 1px solid #cccccc;
  border-radius: 8px;
  cursor: not-allowed;
  font-family: 'Roboto';
  font-size: 14px;
  opacity: 0.6;
}

.login-button:hover,
.logoff-button:hover {
  color: #39455f;
}

/* Custom dropdown containers */
#header-nav-versions,
#header-nav-message-docs {
  display: inline-block;
  vertical-align: middle;
}

/* Provider Selection Dialog */
.provider-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.provider-item {
  display: flex;
  align-items: center;
  padding: 16px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  background-color: #ffffff;
}

.provider-item:hover {
  border-color: #32b9ce;
  background-color: #f0f9fa;
  transform: translateX(4px);
}

.provider-icon {
  font-size: 32px;
  margin-right: 16px;
  min-width: 40px;
  text-align: center;
}

.provider-info {
  flex: 1;
}

.provider-info h4 {
  margin: 0 0 4px 0;
  font-size: 16px;
  color: #39455f;
  font-weight: 500;
}

.provider-status {
  font-size: 12px;
  color: #10b981;
  font-weight: 500;
}

.provider-arrow {
  font-size: 20px;
  color: #32b9ce;
  margin-left: 12px;
}

.no-providers {
  text-align: center;
  padding: 32px;
  color: #999;
}

.no-providers p {
  margin: 8px 0;
}

.error-hint {
  font-size: 12px;
  color: #999;
}
</style>
