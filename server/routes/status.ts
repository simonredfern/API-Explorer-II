/*
 * Open Bank Project -  API Explorer II
 * Copyright (C) 2023-2025, TESOBE GmbH
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

import { Router } from 'express'
import type { Request, Response } from 'express'
import { Container } from 'typedi'
import OBPClientService from '../services/OBPClientService.js'
import { OAuth2Service } from '../services/OAuth2Service.js'
import { OAuth2ProviderManager } from '../services/OAuth2ProviderManager.js'
import { commitId } from '../app.js'
import {
  RESOURCE_DOCS_API_VERSION,
  MESSAGE_DOCS_API_VERSION,
  API_VERSIONS_LIST_API_VERSION
} from '../../src/shared-constants.js'

const router = Router()

// Get services from container
const obpClientService = Container.get(OBPClientService)
const oauth2Service = Container.get(OAuth2Service)
const providerManager = Container.get(OAuth2ProviderManager)

const connectors = [
  'akka_vDec2018',
  'rest_vMar2019',
  'stored_procedure_vDec2019',
  'rabbitmq_vOct2024'
]

/**
 * Helper function to check if response contains an error
 */
function isCodeError(response: any, path: string): boolean {
  console.log(`Validating ${path} response...`)
  if (!response || Object.keys(response).length === 0) return true
  if (Object.keys(response).includes('code')) {
    const code = response['code']
    if (code >= 400) {
      console.log(response) // Log error response
      return true
    }
  }
  return false
}

/**
 * Check if resource docs are accessible
 */
async function checkResourceDocs(oauthConfig: any, version: string): Promise<boolean> {
  try {
    const path = `/obp/${RESOURCE_DOCS_API_VERSION}/resource-docs/${version}/obp`
    const resourceDocs = await obpClientService.get(path, oauthConfig)
    return !isCodeError(resourceDocs, path)
  } catch (error) {
    return false
  }
}

/**
 * Check if message docs are accessible
 */
async function checkMessageDocs(oauthConfig: any, version: string): Promise<boolean> {
  try {
    const messageDocsCodeResult = await Promise.all(
      connectors.map(async (connector) => {
        const path = `/obp/${MESSAGE_DOCS_API_VERSION}/message-docs/${connector}`
        return !isCodeError(await obpClientService.get(path, oauthConfig), path)
      })
    )
    return messageDocsCodeResult.every((isCodeError: boolean) => isCodeError)
  } catch (error) {
    return false
  }
}

/**
 * Check if API versions are accessible
 */
async function checkApiVersions(oauthConfig: any, version: string): Promise<boolean> {
  try {
    const path = `/obp/${API_VERSIONS_LIST_API_VERSION}/api/versions`
    const versions = await obpClientService.get(path, oauthConfig)
    return !isCodeError(versions, path)
  } catch (error) {
    return false
  }
}

/**
 * GET /status
 * Get application status and health checks
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const session = req.session as any
    const oauthConfig = session.clientConfig
    const version = obpClientService.getOBPVersion()

    // Check if user is authenticated
    const isAuthenticated = oauthConfig && oauthConfig.oauth2?.accessToken

    let currentUser = null
    let apiVersions = false
    let messageDocs = false
    let resourceDocs = false

    if (isAuthenticated) {
      try {
        currentUser = await obpClientService.get(`/obp/${version}/users/current`, oauthConfig)
        apiVersions = await checkApiVersions(oauthConfig, version)
        messageDocs = await checkMessageDocs(oauthConfig, version)
        resourceDocs = await checkResourceDocs(oauthConfig, version)
      } catch (error) {
        console.error('Status: Error fetching authenticated data:', error)
      }
    }

    res.json({
      status: apiVersions && messageDocs && resourceDocs,
      apiVersions,
      messageDocs,
      resourceDocs,
      currentUser,
      isAuthenticated,
      commitId
    })
  } catch (error) {
    console.error('Status: Error getting status:', error)
    res.status(500).json({
      status: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

/**
 * GET /status/oauth2
 * Get OAuth2/OIDC status
 */
router.get('/status/oauth2', (req: Request, res: Response) => {
  try {
    const isInitialized = oauth2Service.isInitialized()
    const oidcConfig = oauth2Service.getOIDCConfiguration()
    const healthCheckActive = oauth2Service.isHealthCheckActive()
    const healthCheckAttempts = oauth2Service.getHealthCheckAttempts()

    res.json({
      available: isInitialized,
      message: isInitialized
        ? 'OAuth2/OIDC is ready for authentication'
        : 'OAuth2/OIDC is not available',
      issuer: oidcConfig?.issuer || null,
      authorizationEndpoint: oidcConfig?.authorization_endpoint || null,
      wellKnownUrl: process.env.VITE_OBP_OAUTH2_WELL_KNOWN_URL || null,
      healthCheck: {
        active: healthCheckActive,
        attempts: healthCheckAttempts
      }
    })
  } catch (error) {
    res.status(500).json({
      available: false,
      message: 'Error checking OAuth2 status',
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

/**
 * GET /status/oauth2/reconnect
 * Attempt to reconnect OAuth2/OIDC
 */
router.get('/status/oauth2/reconnect', async (req: Request, res: Response) => {
  try {
    if (oauth2Service.isInitialized()) {
      return res.json({
        success: true,
        message: 'OAuth2 is already connected',
        alreadyConnected: true
      })
    }

    const wellKnownUrl = process.env.VITE_OBP_OAUTH2_WELL_KNOWN_URL
    if (!wellKnownUrl) {
      return res.status(400).json({
        success: false,
        message: 'VITE_OBP_OAUTH2_WELL_KNOWN_URL not configured'
      })
    }

    console.log('Manual OAuth2 reconnection attempt triggered...')
    await oauth2Service.initializeFromWellKnown(wellKnownUrl)

    console.log('Manual OAuth2 reconnection successful!')
    res.json({
      success: true,
      message: 'OAuth2 reconnection successful',
      issuer: oauth2Service.getOIDCConfiguration()?.issuer || null
    })
  } catch (error) {
    console.error('Manual OAuth2 reconnection failed:', error)
    res.status(500).json({
      success: false,
      message: 'OAuth2 reconnection failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

/**
 * GET /status/providers
 * Get configured OAuth2 providers (for debugging)
 * Shows provider configuration with masked credentials
 */
router.get('/status/providers', (req: Request, res: Response) => {
  try {
    // Helper function to mask sensitive data (show first 2 and last 2 chars)
    const maskCredential = (value: string | undefined): string => {
      if (!value || value.length < 6) {
        return value ? '***masked***' : 'not configured'
      }
      return `${value.substring(0, 2)}...${value.substring(value.length - 2)}`
    }

    // Get providers from manager
    const availableProviders = providerManager.getAvailableProviders()
    const allProviderStatus = providerManager.getAllProviderStatus()

    // Get env configuration (masked)
    const envConfig = {
      obpOidc: {
        consumerId: process.env.VITE_OBP_CONSUMER_KEY || 'not configured',
        clientId: maskCredential(process.env.VITE_OBP_OAUTH2_CLIENT_ID),
        wellKnownUrl: process.env.VITE_OBP_OAUTH2_WELL_KNOWN_URL || 'not configured',
        redirectUrl: process.env.VITE_OBP_OAUTH2_REDIRECT_URL || 'not configured'
      },
      keycloak: {
        clientId: maskCredential(process.env.VITE_KEYCLOAK_CLIENT_ID),
        redirectUrl: process.env.VITE_KEYCLOAK_REDIRECT_URL || 'not configured'
      },
      google: {
        clientId: maskCredential(process.env.VITE_GOOGLE_CLIENT_ID),
        redirectUrl: process.env.VITE_GOOGLE_REDIRECT_URL || 'not configured'
      },
      github: {
        clientId: maskCredential(process.env.VITE_GITHUB_CLIENT_ID),
        redirectUrl: process.env.VITE_GITHUB_REDIRECT_URL || 'not configured'
      },
      custom: {
        providerName: process.env.VITE_CUSTOM_OIDC_PROVIDER_NAME || 'not configured',
        clientId: maskCredential(process.env.VITE_CUSTOM_OIDC_CLIENT_ID),
        redirectUrl: process.env.VITE_CUSTOM_OIDC_REDIRECT_URL || 'not configured'
      }
    }

    res.json({
      summary: {
        totalConfigured: availableProviders.length,
        availableProviders: availableProviders,
        obpApiHost: process.env.VITE_OBP_API_HOST || 'not configured'
      },
      providerStatus: allProviderStatus,
      environmentConfig: envConfig,
      note: 'Credentials are masked for security. Format: first2...last2'
    })
  } catch (error) {
    console.error('Status: Error getting provider status:', error)
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

export default router
