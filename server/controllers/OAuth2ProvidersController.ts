/*
 * Open Bank Project - API Explorer II
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

import { Controller, Get } from 'routing-controllers'
import { Service, Container } from 'typedi'
import { OAuth2ProviderManager } from '../services/OAuth2ProviderManager.js'

/**
 * OAuth2 Providers Controller
 *
 * Provides endpoints to query available OIDC providers
 *
 * Endpoints:
 *   GET /api/oauth2/providers - List available OIDC providers
 *
 * @example
 * // Fetch available providers
 * const response = await fetch('/api/oauth2/providers')
 * const data = await response.json()
 * // {
 * //   providers: [
 * //     { name: "obp-oidc", available: true, lastChecked: "2024-01-15T10:30:00Z" },
 * //     { name: "keycloak", available: false, lastChecked: "2024-01-15T10:30:00Z", error: "Connection timeout" }
 * //   ],
 * //   count: 2,
 * //   availableCount: 1
 * // }
 */
@Service()
@Controller()
export class OAuth2ProvidersController {
  private providerManager: OAuth2ProviderManager

  constructor() {
    this.providerManager = Container.get(OAuth2ProviderManager)
  }

  /**
   * Get list of available OAuth2/OIDC providers
   *
   * Returns provider names and availability status for all configured providers.
   * This endpoint is used by the frontend to display provider selection UI.
   *
   * @returns JSON response with providers array, total count, and available count
   *
   * @example
   * GET /api/oauth2/providers
   *
   * Response:
   * {
   *   "providers": [
   *     {
   *       "name": "obp-oidc",
   *       "available": true,
   *       "lastChecked": "2024-01-15T10:30:00.000Z"
   *     },
   *     {
   *       "name": "keycloak",
   *       "available": false,
   *       "lastChecked": "2024-01-15T10:30:00.000Z",
   *       "error": "Connection timeout"
   *     }
   *   ],
   *   "count": 2,
   *   "availableCount": 1
   * }
   */
  @Get('/api/oauth2/providers')
  async getProviders(): Promise<any> {
    console.log('OAuth2ProvidersController: Fetching provider list')

    const allStatus = this.providerManager.getAllProviderStatus()
    const availableProviders = this.providerManager.getAvailableProviders()

    console.log(`OAuth2ProvidersController: Total providers: ${allStatus.length}`)
    console.log(`OAuth2ProvidersController: Available providers: ${availableProviders.length}`)

    return {
      providers: allStatus,
      count: allStatus.length,
      availableCount: availableProviders.length
    }
  }
}
