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

import { OAuth2Client } from 'arctic'
import { Service } from 'typedi'
import jwt from 'jsonwebtoken'

/**
 * OpenID Connect Discovery Configuration
 * As defined in OpenID Connect Discovery 1.0
 * @see https://openid.net/specs/openid-connect-discovery-1_0.html
 */
export interface OIDCConfiguration {
  issuer: string
  authorization_endpoint: string
  token_endpoint: string
  userinfo_endpoint: string
  jwks_uri: string
  registration_endpoint?: string
  scopes_supported?: string[]
  response_types_supported?: string[]
  response_modes_supported?: string[]
  grant_types_supported?: string[]
  subject_types_supported?: string[]
  id_token_signing_alg_values_supported?: string[]
  token_endpoint_auth_methods_supported?: string[]
  claims_supported?: string[]
  code_challenge_methods_supported?: string[]
}

/**
 * Token response from OAuth2 token endpoint
 */
export interface TokenResponse {
  accessToken: string
  refreshToken?: string
  idToken?: string
  tokenType: string
  expiresIn?: number
  scope?: string
}

/**
 * User information from OIDC UserInfo endpoint
 */
export interface UserInfo {
  sub: string
  name?: string
  given_name?: string
  family_name?: string
  middle_name?: string
  nickname?: string
  preferred_username?: string
  profile?: string
  picture?: string
  website?: string
  email?: string
  email_verified?: boolean
  gender?: string
  birthdate?: string
  zoneinfo?: string
  locale?: string
  phone_number?: string
  phone_number_verified?: boolean
  address?: {
    formatted?: string
    street_address?: string
    locality?: string
    region?: string
    postal_code?: string
    country?: string
  }
  updated_at?: number
  [key: string]: any
}

/**
 * OAuth2/OIDC Service
 *
 * Handles OAuth2 Authorization Code Flow with PKCE and OpenID Connect integration.
 * This service manages the complete OAuth2/OIDC authentication flow including:
 * - OIDC Discovery (fetching .well-known/openid-configuration)
 * - Authorization URL generation with PKCE
 * - Token exchange (authorization code for tokens)
 * - Token refresh
 * - UserInfo endpoint access
 *
 * @example
 * const oauth2Service = Container.get(OAuth2Service)
 * await oauth2Service.initializeFromWellKnown('http://localhost:9000/obp-oidc/.well-known/openid-configuration')
 * const authUrl = oauth2Service.createAuthorizationURL(state, ['openid', 'profile', 'email'])
 */
@Service()
export class OAuth2Service {
  private client: OAuth2Client
  private oidcConfig: OIDCConfiguration | null = null
  private readonly clientId: string
  private readonly clientSecret: string
  private readonly redirectUri: string
  private initialized: boolean = false
  private wellKnownUrl: string = ''
  private healthCheckInterval: NodeJS.Timeout | null = null
  private healthCheckAttempts: number = 0
  private healthCheckActive: boolean = false

  constructor() {
    // Load OAuth2 configuration from environment
    this.clientId = process.env.VITE_OBP_OAUTH2_CLIENT_ID || ''
    this.clientSecret = process.env.VITE_OBP_OAUTH2_CLIENT_SECRET || ''
    this.redirectUri = process.env.VITE_OBP_OAUTH2_REDIRECT_URL || ''

    // Validate configuration
    if (!this.clientId) {
      console.warn('OAuth2Service: VITE_OBP_OAUTH2_CLIENT_ID not set')
    }
    if (!this.clientSecret) {
      console.warn('OAuth2Service: VITE_OBP_OAUTH2_CLIENT_SECRET not set')
    }
    if (!this.redirectUri) {
      console.warn('OAuth2Service: VITE_OBP_OAUTH2_REDIRECT_URL not set')
    }

    // Initialize OAuth2 client
    this.client = new OAuth2Client(this.clientId, this.clientSecret, this.redirectUri)

    console.log('OAuth2Service: Initialized with client ID:', this.clientId)
    console.log('OAuth2Service: Redirect URI:', this.redirectUri)
  }

  /**
   * Initialize OIDC configuration from well-known discovery endpoint
   *
   * @param {string} wellKnownUrl - The .well-known/openid-configuration URL
   * @throws {Error} If the discovery document cannot be fetched or is invalid
   *
   * @example
   * await oauth2Service.initializeFromWellKnown(
   *   'http://localhost:9000/obp-oidc/.well-known/openid-configuration'
   * )
   */
  async initializeFromWellKnown(wellKnownUrl: string): Promise<void> {
    console.log('OAuth2Service: Fetching OIDC configuration from:', wellKnownUrl)

    // Store the well-known URL for potential retries
    this.wellKnownUrl = wellKnownUrl

    try {
      const response = await fetch(wellKnownUrl)

      if (!response.ok) {
        throw new Error(
          `Failed to fetch OIDC configuration: ${response.status} ${response.statusText}`
        )
      }

      const config = (await response.json()) as OIDCConfiguration

      // Validate required endpoints
      if (!config.authorization_endpoint) {
        throw new Error('OIDC configuration missing authorization_endpoint')
      }
      if (!config.token_endpoint) {
        throw new Error('OIDC configuration missing token_endpoint')
      }
      if (!config.userinfo_endpoint) {
        throw new Error('OIDC configuration missing userinfo_endpoint')
      }

      this.oidcConfig = config
      this.initialized = true

      console.log('OAuth2Service: OIDC configuration loaded successfully')
      console.log('  Issuer:', config.issuer)
      console.log('  Authorization endpoint:', config.authorization_endpoint)
      console.log('  Token endpoint:', config.token_endpoint)
      console.log('  UserInfo endpoint:', config.userinfo_endpoint)
      console.log('  JWKS URI:', config.jwks_uri)

      // Log supported features
      if (config.code_challenge_methods_supported) {
        console.log('  PKCE methods supported:', config.code_challenge_methods_supported.join(', '))
      }
    } catch (error) {
      console.error('OAuth2Service: Failed to initialize from well-known URL:', error)
      throw error
    }
  }

  /**
   * Start periodic health check to monitor OIDC availability
   * Uses exponential backoff when reconnecting: 1s, 2s, 4s, up to 4min
   * Switches to regular monitoring (every 4 minutes) once connected
   *
   * @param {number} initialIntervalMs - Initial interval in milliseconds (default: 1000 = 1 second)
   * @param {number} monitoringIntervalMs - Interval for continuous monitoring when connected (default: 240000 = 4 minutes)
   *
   * @example
   * oauth2Service.startHealthCheck(1000, 240000) // Start checking at 1 second, monitor every 4 minutes when connected
   */
  startHealthCheck(initialIntervalMs: number = 1000, monitoringIntervalMs: number = 240000): void {
    if (this.healthCheckInterval) {
      console.log('OAuth2Service: Health check already running')
      return
    }

    if (!this.wellKnownUrl) {
      console.warn('OAuth2Service: Cannot start health check - no well-known URL configured')
      return
    }

    this.healthCheckAttempts = 0
    this.healthCheckActive = true
    console.log('OAuth2Service: Starting health check with exponential backoff')

    const scheduleNextCheck = () => {
      if (!this.wellKnownUrl) {
        return
      }

      let delay: number

      if (this.initialized) {
        // When connected, monitor every 4 minutes
        delay = monitoringIntervalMs
      } else {
        // When disconnected, use exponential backoff
        delay = Math.min(initialIntervalMs * Math.pow(2, this.healthCheckAttempts), 240000)
      }

      const delayDisplay =
        delay < 60000
          ? `${(delay / 1000).toFixed(0)} second(s)`
          : `${(delay / 60000).toFixed(1)} minute(s)`

      if (this.initialized) {
        console.log(`OAuth2Service: Monitoring scheduled in ${delayDisplay}`)
      } else {
        console.log(
          `OAuth2Service: Health check scheduled in ${delayDisplay} (attempt ${this.healthCheckAttempts + 1})`
        )
      }

      this.healthCheckInterval = setTimeout(async () => {
        if (this.initialized) {
          // When connected, verify OIDC is still available
          console.log('OAuth2Service: Verifying OIDC availability...')
          try {
            const response = await fetch(this.wellKnownUrl)
            if (!response.ok) {
              throw new Error(`OIDC server returned ${response.status}`)
            }
            console.log('OAuth2Service: OIDC is available')
            // Continue monitoring
            scheduleNextCheck()
          } catch (error) {
            console.error('OAuth2Service: OIDC server is no longer available!')
            this.initialized = false
            this.oidcConfig = null
            this.healthCheckAttempts = 0
            console.log('OAuth2Service: Attempting to reconnect...')
            // Schedule reconnection with exponential backoff
            scheduleNextCheck()
          }
        } else {
          // When disconnected, attempt to reconnect
          console.log('OAuth2Service: Health check - attempting to reconnect to OIDC server...')
          try {
            await this.initializeFromWellKnown(this.wellKnownUrl)
            console.log('OAuth2Service: Successfully reconnected to OIDC server!')
            this.healthCheckAttempts = 0
            // Switch to continuous monitoring
            scheduleNextCheck()
          } catch (error) {
            this.healthCheckAttempts++
            // Schedule next reconnection attempt
            scheduleNextCheck()
          }
        }
      }, delay)
    }

    // Start the first check
    scheduleNextCheck()
  }

  /**
   * Stop the periodic health check
   */
  stopHealthCheck(): void {
    if (this.healthCheckInterval) {
      clearTimeout(this.healthCheckInterval)
      this.healthCheckInterval = null
      this.healthCheckAttempts = 0
      this.healthCheckActive = false
      console.log('OAuth2Service: Health check stopped')
    }
  }

  /**
   * Check if health check is currently active
   *
   * @returns {boolean} True if health check is running
   */
  isHealthCheckActive(): boolean {
    return this.healthCheckActive
  }

  /**
   * Get the number of health check attempts so far
   *
   * @returns {number} Number of health check attempts
   */
  getHealthCheckAttempts(): number {
    return this.healthCheckAttempts
  }

  /**
   * Attempt to initialize with exponential backoff retry (continues indefinitely)
   *
   * @param {number} maxRetries - Maximum number of retry attempts (default: Infinity for continuous retries)
   * @param {string} wellKnownUrl - The .well-known/openid-configuration URL
   * @param {number} maxRetries - Maximum number of retry attempts (default: Infinity for continuous retries)
   * @param {number} initialDelayMs - Initial delay in milliseconds (default: 1000 = 1 second)
   * @returns {Promise<boolean>} True if initialization succeeded, false if maxRetries reached
   *
   * @example
   * const success = await oauth2Service.initializeWithRetry('http://localhost:9000/.well-known/openid-configuration', Infinity, 1000)
   */
  async initializeWithRetry(
    wellKnownUrl: string,
    maxRetries: number = Infinity,
    initialDelayMs: number = 1000
  ): Promise<boolean> {
    if (!wellKnownUrl) {
      console.error('OAuth2Service: Cannot retry - no well-known URL configured')
      return false
    }

    // Store the well-known URL for retries and health checks
    this.wellKnownUrl = wellKnownUrl

    let attempt = 0
    while (attempt < maxRetries) {
      try {
        await this.initializeFromWellKnown(wellKnownUrl)
        console.log(`OAuth2Service: Initialized successfully on attempt ${attempt + 1}`)
        return true
      } catch (error: any) {
        const delay = Math.min(initialDelayMs * Math.pow(2, attempt), 240000) // Cap at 4 minutes
        const delayDisplay =
          delay < 60000
            ? `${(delay / 1000).toFixed(0)} second(s)`
            : `${(delay / 60000).toFixed(1)} minute(s)`

        if (maxRetries === Infinity || attempt < maxRetries - 1) {
          console.log(
            `OAuth2Service: Attempt ${attempt + 1} failed. Retrying in ${delayDisplay}...`
          )
          await new Promise((resolve) => setTimeout(resolve, delay))
          attempt++
        } else {
          console.error(
            `OAuth2Service: Failed to initialize after ${maxRetries} attempts:`,
            error.message
          )
          return false
        }
      }
    }

    return false
  }

  /**
   * Check if the service is initialized and ready to use
   *
   * @returns {boolean} True if initialized, false otherwise
   */
  isInitialized(): boolean {
    return this.initialized && this.oidcConfig !== null
  }

  /**
   * Get the OIDC configuration
   *
   * @returns {OIDCConfiguration | null} The OIDC configuration or null if not initialized
   */
  getOIDCConfiguration(): OIDCConfiguration | null {
    return this.oidcConfig
  }

  /**
   * Create an authorization URL for the OAuth2 flow
   *
   * @param {string} state - CSRF protection state parameter
   * @param {string[]} scopes - OAuth2 scopes to request (default: ['openid', 'profile', 'email'])
   * @returns {URL} The authorization URL to redirect the user to
   * @throws {Error} If the service is not initialized
   *
   * @example
   * const state = PKCEUtils.generateState()
   * const authUrl = oauth2Service.createAuthorizationURL(state, ['openid', 'profile', 'email'])
   * // Add PKCE challenge to URL
   * authUrl.searchParams.set('code_challenge', codeChallenge)
   * authUrl.searchParams.set('code_challenge_method', 'S256')
   * response.redirect(authUrl.toString())
   */
  createAuthorizationURL(state: string, scopes: string[] = ['openid', 'profile', 'email']): URL {
    if (!this.isInitialized() || !this.oidcConfig) {
      throw new Error(
        'OAuth2Service: Service not initialized. Call initializeFromWellKnown() first'
      )
    }

    console.log('OAuth2Service: Creating authorization URL')
    console.log('  State:', state)
    console.log('  Scopes:', scopes.join(' '))

    const authUrl = this.client.createAuthorizationURL(
      this.oidcConfig.authorization_endpoint,
      state,
      scopes
    )

    return authUrl
  }

  /**
   * Exchange an authorization code for tokens
   *
   * @param {string} code - The authorization code from the callback
   * @param {string} codeVerifier - The PKCE code verifier
   * @returns {Promise<TokenResponse>} The tokens (access, refresh, ID)
   * @throws {Error} If the token exchange fails
   *
   * @example
   * const tokens = await oauth2Service.exchangeCodeForTokens(code, codeVerifier)
   * console.log('Access token:', tokens.accessToken)
   * console.log('Refresh token:', tokens.refreshToken)
   * console.log('ID token:', tokens.idToken)
   */
  async exchangeCodeForTokens(code: string, codeVerifier: string): Promise<TokenResponse> {
    if (!this.isInitialized() || !this.oidcConfig) {
      throw new Error(
        'OAuth2Service: Service not initialized. Call initializeFromWellKnown() first'
      )
    }

    console.log('OAuth2Service: Exchanging authorization code for tokens')

    try {
      // Use arctic's validateAuthorizationCode which handles the token request
      const tokens = await this.client.validateAuthorizationCode(
        this.oidcConfig.token_endpoint,
        code,
        codeVerifier
      )

      console.log('OAuth2Service: Token exchange successful')

      // Arctic returns an object with accessor functions
      const tokenResponse: TokenResponse = {
        accessToken: tokens.accessToken(),
        refreshToken: tokens.refreshToken ? tokens.refreshToken() : undefined,
        idToken: tokens.idToken ? tokens.idToken() : undefined,
        tokenType: 'Bearer',
        expiresIn: tokens.accessTokenExpiresAt
          ? Math.floor((tokens.accessTokenExpiresAt().getTime() - Date.now()) / 1000)
          : undefined
      }

      return tokenResponse
    } catch (error: any) {
      console.error('OAuth2Service: Token exchange failed:', error)
      throw new Error(`Token exchange failed: ${error.message}`)
    }
  }

  /**
   * Refresh an access token using a refresh token
   *
   * @param {string} refreshToken - The refresh token
   * @returns {Promise<TokenResponse>} The new tokens
   * @throws {Error} If the token refresh fails
   */
  async refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
    if (!this.isInitialized() || !this.oidcConfig) {
      throw new Error(
        'OAuth2Service: Service not initialized. Call initializeFromWellKnown() first'
      )
    }

    console.log('OAuth2Service: Refreshing access token')

    try {
      const body = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: this.clientId,
        client_secret: this.clientSecret
      })

      const response = await fetch(this.oidcConfig.token_endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json'
        },
        body: body.toString()
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error('OAuth2Service: Token refresh failed:', errorData)
        throw new Error(`Token refresh failed: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()

      console.log('OAuth2Service: Token refresh successful')

      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token || refreshToken,
        idToken: data.id_token,
        tokenType: data.token_type || 'Bearer',
        expiresIn: data.expires_in,
        scope: data.scope
      }
    } catch (error: any) {
      console.error('OAuth2Service: Token refresh failed:', error)
      throw error
    }
  }

  /**
   * Get user information from the UserInfo endpoint
   *
   * @param {string} accessToken - The access token
   * @returns {Promise<UserInfo>} The user information
   * @throws {Error} If the UserInfo request fails
   *
   * @example
   * const userInfo = await oauth2Service.getUserInfo(accessToken)
   * console.log('User ID:', userInfo.sub)
   * console.log('Email:', userInfo.email)
   * console.log('Name:', userInfo.name)
   */
  async getUserInfo(accessToken: string): Promise<UserInfo> {
    if (!this.isInitialized() || !this.oidcConfig) {
      throw new Error(
        'OAuth2Service: Service not initialized. Call initializeFromWellKnown() first'
      )
    }

    console.log('OAuth2Service: Fetching user info')

    try {
      const response = await fetch(this.oidcConfig.userinfo_endpoint, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json'
        }
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error('OAuth2Service: UserInfo request failed:', errorData)
        throw new Error(`UserInfo request failed: ${response.status} ${response.statusText}`)
      }

      const userInfo = (await response.json()) as UserInfo

      console.log('OAuth2Service: User info retrieved successfully')
      console.log('  User ID (sub):', userInfo.sub)
      console.log('  Email:', userInfo.email)
      console.log('  Name:', userInfo.name)

      return userInfo
    } catch (error: any) {
      console.error('OAuth2Service: UserInfo request failed:', error)
      throw error
    }
  }

  /**
   * Decode and validate an ID token (basic validation only)
   *
   * Note: This performs basic JWT decoding. For production use, implement
   * full signature verification using the JWKS from the jwks_uri endpoint.
   *
   * @param {string} idToken - The ID token to decode
   * @returns {any} The decoded token payload
   */
  decodeIdToken(idToken: string): any {
    try {
      const decoded = jwt.decode(idToken, { complete: true })

      if (!decoded) {
        throw new Error('Failed to decode ID token')
      }

      console.log('OAuth2Service: ID token decoded')
      console.log('  Issuer (iss):', decoded.payload['iss'])
      console.log('  Subject (sub):', decoded.payload['sub'])
      console.log('  Audience (aud):', decoded.payload['aud'])
      console.log('  Expiration (exp):', new Date(decoded.payload['exp'] * 1000).toISOString())

      return decoded.payload
    } catch (error) {
      console.error('OAuth2Service: Failed to decode ID token:', error)
      throw error
    }
  }

  /**
   * Check if an access token is expired
   *
   * @param {string} accessToken - The access token (JWT)
   * @returns {boolean} True if expired, false otherwise
   */
  isTokenExpired(accessToken: string): boolean {
    try {
      const decoded: any = jwt.decode(accessToken)

      if (!decoded || !decoded.exp) {
        console.warn('OAuth2Service: Token has no expiration claim')
        return false
      }

      const isExpired = Date.now() >= decoded.exp * 1000

      if (isExpired) {
        console.log('OAuth2Service: Access token is expired')
      }

      return isExpired
    } catch (error) {
      console.error('OAuth2Service: Failed to check token expiration:', error)
      return false
    }
  }

  /**
   * Get token expiration time in seconds
   *
   * @param {string} accessToken - The access token (JWT)
   * @returns {number | null} Seconds until expiration, or null if no expiration
   */
  getTokenExpiresIn(accessToken: string): number | null {
    try {
      const decoded: any = jwt.decode(accessToken)

      if (!decoded || !decoded.exp) {
        return null
      }

      const expiresIn = Math.floor((decoded.exp * 1000 - Date.now()) / 1000)
      return expiresIn > 0 ? expiresIn : 0
    } catch (error) {
      console.error('OAuth2Service: Failed to get token expiration:', error)
      return null
    }
  }
}
