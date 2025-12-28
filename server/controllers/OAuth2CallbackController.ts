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
import type { UserInfo } from '../types/oauth2.js'

/**
 * OAuth2 Callback Controller (Multi-Provider)
 *
 * Handles the OAuth2/OIDC callback from any configured identity provider.
 * This controller receives the authorization code and state parameter
 * after the user authenticates with the OIDC provider.
 *
 * This controller handles:
 * - State validation (CSRF protection)
 * - Authorization code exchange for tokens
 * - User info retrieval
 * - Session storage
 * - Redirect to original page
 *
 * Supports both multi-provider mode (retrieves provider from session) and
 * legacy single-provider mode (uses existing OAuth2Service).
 *
 * Endpoint: GET /oauth2/callback
 *
 * Query Parameters (from OIDC provider):
 *   - code: Authorization code to exchange for tokens
 *   - state: State parameter for CSRF validation
 *   - error (optional): Error code if authentication failed
 *   - error_description (optional): Human-readable error description
 *
 * Multi-Provider Flow:
 *   OIDC Provider → /oauth2/callback?code=XXX&state=YYY
 *   → Retrieve provider from session → Use correct OAuth2 client
 *   → Exchange code for tokens → Original Page (with authenticated session)
 *
 * Success Flow:
 *   1. Validate state parameter
 *   2. Retrieve provider from session (or use legacy service)
 *   3. Exchange authorization code for tokens (access, refresh, ID)
 *   4. Fetch user information from UserInfo endpoint
 *   5. Store tokens, provider name, and user data in session
 *   6. Redirect to original page or home
 *
 * Error Flow:
 *   1. Parse error from query parameters
 *   2. Log error details
 *   3. Redirect to home with error parameter
 *
 * @example
 * // Successful callback URL from OIDC provider
 * http://localhost:5173/oauth2/callback?code=abc123&state=xyz789
 *
 * // Error callback URL from OIDC provider
 * http://localhost:5173/oauth2/callback?error=access_denied&error_description=User%20cancelled
 */
@Service()
@Controller()
export class OAuth2CallbackController {
  private providerManager: OAuth2ProviderManager
  private legacyOAuth2Service: OAuth2Service

  constructor() {
    this.providerManager = Container.get(OAuth2ProviderManager)
    this.legacyOAuth2Service = Container.get(OAuth2Service)
  }

  /**
   * Handle OAuth2/OIDC callback
   *
   * Processes the callback from any configured OIDC provider.
   * Supports both multi-provider mode and legacy single-provider mode.
   *
   * @param code - Authorization code from OIDC provider
   * @param state - State parameter for CSRF validation
   * @param error - Error code if authentication failed
   * @param errorDescription - Human-readable error description
   * @param request - Express request object
   * @param response - Express response object
   * @returns Response with redirect to original page or error page
   */
  @Get('/oauth2/callback')
  async callback(
    @QueryParam('code') code: string,
    @QueryParam('state') state: string,
    @QueryParam('error') error: string,
    @QueryParam('error_description') errorDescription: string,
    @Req() request: Request,
    @Res() response: Response
  ): Promise<Response> {
    console.log('OAuth2CallbackController: Processing OAuth2 callback')

    const session = request.session as any

    // Handle error from provider
    if (error) {
      console.error(`OAuth2CallbackController: Error from provider: ${error}`)
      console.error(`OAuth2CallbackController: Description: ${errorDescription || 'N/A'}`)
      return response.redirect(`/?oauth2_error=${encodeURIComponent(error)}`)
    }

    // Validate required parameters
    if (!code) {
      console.error('OAuth2CallbackController: Missing authorization code')
      return response.redirect('/?oauth2_error=missing_code')
    }

    if (!state) {
      console.error('OAuth2CallbackController: Missing state parameter')
      return response.redirect('/?oauth2_error=missing_state')
    }

    // Validate state (CSRF protection)
    const storedState = session.oauth2_state
    if (!storedState || storedState !== state) {
      console.error('OAuth2CallbackController: State mismatch (CSRF protection)')
      console.error(`  Expected: ${storedState}`)
      console.error(`  Received: ${state}`)
      return response.redirect('/?oauth2_error=invalid_state')
    }

    // Get code verifier from session (PKCE)
    const codeVerifier = session.oauth2_code_verifier
    if (!codeVerifier) {
      console.error('OAuth2CallbackController: Code verifier not found in session')
      return response.redirect('/?oauth2_error=missing_verifier')
    }

    // Check if multi-provider mode (provider stored in session)
    const provider = session.oauth2_provider

    try {
      if (provider) {
        // Multi-provider mode
        await this.handleMultiProviderCallback(session, code, codeVerifier, provider)
      } else {
        // Legacy single-provider mode
        await this.handleLegacyCallback(session, code, codeVerifier)
      }

      // Clean up temporary session data
      delete session.oauth2_code_verifier
      delete session.oauth2_state

      // Redirect to original page
      const redirectUrl = session.oauth2_redirect_page || '/'
      delete session.oauth2_redirect_page

      console.log(
        `OAuth2CallbackController: Authentication successful, redirecting to: ${redirectUrl}`
      )
      return response.redirect(redirectUrl)
    } catch (error) {
      console.error('OAuth2CallbackController: Token exchange failed:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      return response.redirect(
        `/?oauth2_error=token_exchange_failed&details=${encodeURIComponent(errorMessage)}`
      )
    }
  }

  /**
   * Handle multi-provider callback
   */
  private async handleMultiProviderCallback(
    session: any,
    code: string,
    codeVerifier: string,
    provider: string
  ): Promise<void> {
    console.log(`OAuth2CallbackController: Multi-provider mode - ${provider}`)

    const client = this.providerManager.getProvider(provider)
    if (!client) {
      throw new Error(`Provider not found: ${provider}`)
    }

    // Exchange code for tokens
    console.log(`OAuth2CallbackController: Exchanging authorization code for tokens`)
    const tokens = await client.exchangeAuthorizationCode(code, codeVerifier)

    // Store tokens in session
    session.oauth2_access_token = tokens.accessToken
    session.oauth2_refresh_token = tokens.refreshToken
    session.oauth2_id_token = tokens.idToken
    session.oauth2_provider = provider

    console.log(`OAuth2CallbackController: Tokens received and stored`)

    // Fetch user info
    console.log(`OAuth2CallbackController: Fetching user info`)
    const userInfo = await this.fetchUserInfo(client, tokens.accessToken)

    // Store user in session
    session.user = {
      username: userInfo.preferred_username || userInfo.email || userInfo.sub,
      email: userInfo.email,
      name: userInfo.name,
      provider: provider,
      sub: userInfo.sub
    }

    console.log(
      `OAuth2CallbackController: User authenticated via ${provider}: ${session.user.username}`
    )
  }

  /**
   * Handle legacy single-provider callback
   */
  private async handleLegacyCallback(
    session: any,
    code: string,
    codeVerifier: string
  ): Promise<void> {
    console.log('OAuth2CallbackController: Legacy single-provider mode')

    // Exchange code for tokens using legacy service
    console.log(`OAuth2CallbackController: Exchanging authorization code for tokens`)
    const tokens = await this.legacyOAuth2Service.exchangeCodeForTokens(code, codeVerifier)

    // Store tokens in session
    session.oauth2_access_token = tokens.accessToken
    session.oauth2_refresh_token = tokens.refreshToken
    session.oauth2_id_token = tokens.idToken

    console.log(`OAuth2CallbackController: Tokens received and stored`)

    // Fetch user info
    console.log(`OAuth2CallbackController: Fetching user info`)
    const userInfo = await this.legacyOAuth2Service.getUserInfo(tokens.accessToken)

    // Store user in session
    session.user = {
      username: userInfo.preferred_username || userInfo.email || userInfo.sub,
      email: userInfo.email,
      name: userInfo.name,
      sub: userInfo.sub
    }

    console.log(`OAuth2CallbackController: User authenticated (legacy): ${session.user.username}`)
  }

  /**
   * Fetch user info from UserInfo endpoint
   */
  private async fetchUserInfo(client: any, accessToken: string): Promise<UserInfo> {
    const userInfoEndpoint = client.getUserInfoEndpoint()

    console.log(`OAuth2CallbackController: Calling UserInfo endpoint: ${userInfoEndpoint}`)

    const response = await fetch(userInfoEndpoint, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json'
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(
        `UserInfo request failed: ${response.status} ${response.statusText} - ${errorText}`
      )
    }

    const userInfo = await response.json()
    console.log(`OAuth2CallbackController: UserInfo retrieved: ${userInfo.sub}`)

    return userInfo as UserInfo
  }
}
