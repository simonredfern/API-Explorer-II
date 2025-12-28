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

import { Controller, Req, Res, Get, QueryParam } from 'routing-controllers'
import type { Request, Response } from 'express'
import { Service, Container } from 'typedi'
import { OAuth2Service } from '../services/OAuth2Service.js'
import { OAuth2ProviderManager } from '../services/OAuth2ProviderManager.js'
import { PKCEUtils } from '../utils/pkce.js'

/**
 * OAuth2 Connect Controller (Multi-Provider)
 *
 * Handles the OAuth2/OIDC login initiation endpoint with support for multiple providers.
 * This controller generates PKCE parameters and redirects to the selected OIDC provider.
 *
 * Endpoint: GET /oauth2/connect
 *
 * Query Parameters:
 *   - provider (optional): Provider name (e.g., "obp-oidc", "keycloak")
 *   - redirect (optional): URL to redirect to after successful authentication
 *
 * Multi-Provider Flow:
 *   User selects provider → /oauth2/connect?provider=obp-oidc&redirect=/resource-docs
 *   → Generate PKCE → Store in session → Redirect to OIDC provider
 *
 * Legacy Flow (backward compatible):
 *   User clicks login → /oauth2/connect → Uses existing OAuth2Service (single provider)
 *
 * @example
 * // Multi-provider login
 * <a href="/oauth2/connect?provider=obp-oidc&redirect=/messages">Login with OBP-OIDC</a>
 *
 * // Legacy single-provider login (backward compatible)
 * <a href="/oauth2/connect?redirect=/messages">Login</a>
 */
@Service()
@Controller()
export class OAuth2ConnectController {
  private providerManager: OAuth2ProviderManager
  private legacyOAuth2Service: OAuth2Service

  constructor() {
    this.providerManager = Container.get(OAuth2ProviderManager)
    this.legacyOAuth2Service = Container.get(OAuth2Service)
  }

  /**
   * Initiate OAuth2/OIDC authentication flow
   *
   * Supports both multi-provider mode (with provider parameter) and legacy single-provider mode.
   *
   * @param provider - Provider name (e.g., "obp-oidc", "keycloak") - optional for backward compatibility
   * @param redirect - URL to redirect after authentication - optional
   * @param request - Express request object
   * @param response - Express response object
   * @returns Response with redirect to OIDC provider
   */
  @Get('/oauth2/connect')
  connect(
    @QueryParam('provider') provider: string,
    @QueryParam('redirect') redirect: string,
    @Req() request: Request,
    @Res() response: Response
  ): Response {
    console.log('OAuth2ConnectController: Starting authentication flow')
    console.log(`  Provider: ${provider || '(legacy mode)'}`)
    console.log(`  Redirect: ${redirect || '/'}`)

    const session = request.session as any

    // Store redirect URL in session
    session.oauth2_redirect_page = redirect || '/'

    // Multi-provider mode: Use provider from query param
    if (provider) {
      return this.handleMultiProviderLogin(provider, session, response)
    }

    // Legacy single-provider mode: Use existing OAuth2Service
    return this.handleLegacyLogin(session, response)
  }

  /**
   * Handle multi-provider login
   */
  private handleMultiProviderLogin(provider: string, session: any, response: Response): Response {
    console.log(`OAuth2ConnectController: Multi-provider mode - ${provider}`)

    const client = this.providerManager.getProvider(provider)

    if (!client) {
      console.error(`OAuth2ConnectController: Provider not found: ${provider}`)
      const availableProviders = this.providerManager.getAvailableProviders()
      console.error(
        `OAuth2ConnectController: Available providers: ${availableProviders.join(', ') || 'none'}`
      )
      return response.status(400).json({
        error: 'invalid_provider',
        message: `Provider "${provider}" is not available`,
        availableProviders: availableProviders
      })
    }

    // Store provider name in session for callback
    session.oauth2_provider = provider

    // Generate PKCE parameters
    const codeVerifier = PKCEUtils.generateCodeVerifier()
    const codeChallenge = PKCEUtils.generateCodeChallenge(codeVerifier)
    const state = PKCEUtils.generateState()

    // Store in session
    session.oauth2_code_verifier = codeVerifier
    session.oauth2_state = state

    // Build authorization URL
    const authUrl = this.buildAuthorizationUrl(client, state, codeChallenge)

    console.log(`OAuth2ConnectController: Redirecting to ${provider} authorization endpoint`)
    return response.redirect(authUrl)
  }

  /**
   * Handle legacy single-provider login
   */
  private handleLegacyLogin(session: any, response: Response): Response {
    console.log('OAuth2ConnectController: Legacy single-provider mode')

    if (!this.legacyOAuth2Service.isInitialized()) {
      console.error('OAuth2ConnectController: OAuth2 service not initialized')
      return response.status(503).json({
        error: 'oauth2_unavailable',
        message: 'OAuth2 authentication is not available'
      })
    }

    // Generate PKCE parameters
    const codeVerifier = PKCEUtils.generateCodeVerifier()
    const codeChallenge = PKCEUtils.generateCodeChallenge(codeVerifier)
    const state = PKCEUtils.generateState()

    // Store in session
    session.oauth2_code_verifier = codeVerifier
    session.oauth2_state = state

    // Use legacy service to create authorization URL
    const authUrl = this.legacyOAuth2Service.createAuthorizationURL(state, [
      'openid',
      'profile',
      'email'
    ])

    console.log('OAuth2ConnectController: Redirecting to legacy OIDC provider')
    return response.redirect(authUrl.toString())
  }

  /**
   * Build authorization URL for multi-provider
   */
  private buildAuthorizationUrl(client: any, state: string, codeChallenge: string): string {
    const authEndpoint = client.getAuthorizationEndpoint()
    const params = new URLSearchParams({
      client_id: client.clientId,
      redirect_uri: client.getRedirectUri(),
      response_type: 'code',
      scope: 'openid profile email',
      state: state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256'
    })

    return `${authEndpoint}?${params.toString()}`
  }
}
