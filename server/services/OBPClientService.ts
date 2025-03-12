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

import { Service } from 'typedi'
import {
  Version,
  API,
  get,
  create,
  update,
  discard,
  GetAny,
  CreateAny,
  UpdateAny,
  DiscardAny,
  Any,
} from 'obp-typescript'
import type { APIClientConfig, OAuthConfig } from 'obp-typescript'
import { OAuth } from 'obp-typescript'

@Service()
/**
 * OBPClientService provides methods for interacting with the Open Bank Project API.
 * 
 * This service handles API communication with OBP, including OAuth authentication,
 * making HTTP requests (GET, POST, PUT, DELETE), and managing API configurations.
 * 
 * @class OBPClientService
 * 
 * @property {OAuthConfig} oauthConfig - OAuth configuration for authentication
 * @property {APIClientConfig} clientConfig - API client configuration
 * 
 * @example
 * const obpService = new OBPClientService();
 * const response = await obpService.get('/banks', clientConfig);
 */
export default class OBPClientService {
  private oauthConfig: OAuthConfig
  private clientConfig: APIClientConfig
  constructor() {
    this.oauthConfig = {
      consumerKey: process.env.VITE_OBP_CONSUMER_KEY,
      consumerSecret: process.env.VITE_OBP_CONSUMER_SECRET,
      redirectUrl: process.env.VITE_OBP_REDIRECT_URL
    }
    this.clientConfig = {
      baseUri: process.env.VITE_OBP_API_HOST,
      version: process.env.VITE_OBP_API_VERSION as Version,
      oauthConfig: this.oauthConfig
    }
    
  }
  async get(path: string, clientConfig: any): Promise<any> {
    const config = this.getSessionConfig(clientConfig)
    return await get<API.Any>(config, Any)(GetAny)(path)
  }
  async create(path: string, body: any, clientConfig: any): Promise<any> {
    const config = this.getSessionConfig(clientConfig)
    return await create<API.Any>(config, Any)(CreateAny)(path)(body)
  }
  async update(path: string, body: any, clientConfig: any): Promise<any> {
    const config = this.getSessionConfig(clientConfig)
    return await update<API.Any>(config, Any)(UpdateAny)(path)(body)
  }
  async discard(path: string, clientConfig: any): Promise<any> {
    const config = this.getSessionConfig(clientConfig)
    return await discard<API.Any>(config, Any)(DiscardAny)(path)
  }
  private getSessionConfig(clientConfig: APIClientConfig): APIClientConfig {
    return clientConfig || this.clientConfig
  }

  getOBPVersion(): string {
    return this.clientConfig.version
  }

  getOBPClientConfig(): APIClientConfig {
    return this.clientConfig
  }


  /**
   * Generates an OAuth1 authentication header for a given API request. I.e. to use in the Authorization header.
   * Currently used for boostrapping the newer 'obp-api-typescript' SDK.
   * 
   * @param path - The API endpoint path to access i.e. /banks or /consents/IMPLICIT
   *  NOTE: the path should not include the baseUri
   * @param method - The HTTP method to use (GET, POST, PUT, DELETE, etc.)
   * @param clientConfig - Configuration object containing the user's session data
   * @returns A Promise resolving to the OAuth authentication header string
   * @throws Error if OAuth configuration is missing or if access token is not available
   * 
   * @remarks
   * This method requires that the user has already authenticated and the OAuth access token
   * is stored in the clientConfig. It uses OAuth1 for authentication, which may be replaced
   * with OAuth2 in future implementations.
   */
  async getOAuthHeader(path: string, method:string, clientConfig: any): Promise<string> {
    // This gets the OAuth1 header for the given path and method for the logged in user
    // We should probably transition to OAuth2
    console.log('Getting OAuth header for path:', path, 'method:', method)
    // OAuth1 access token stored in the clientConfig
    const config = this.getSessionConfig(clientConfig)
    if (!config.oauthConfig) {
      throw new Error('OAuth configuration is missing')
    }
    if(!config.oauthConfig.accessToken) {
      throw new Error('Access token is missing, OAuth headers trying to be retrieved before login')
    }

    const oauthInstance = new OAuth(config.oauthConfig).get()

    // Use the OAuth1 instance to get the header
    const url = `${config.baseUri}${path}`
    const authHeader = oauthInstance.authHeader(url, config.oauthConfig.accessToken.key, config.oauthConfig.accessToken.secret, method)
    return authHeader
  }

  async getDirectLoginToken(): Promise<string> {
    // Hilariously insecure, should be replaced with an OAuth 2 flow as soon as possible

    const consumerKey = this.oauthConfig.consumerKey
    const username = process.env.VITE_OBP_DIRECT_LOGIN_USERNAME
    const password = process.env.VITE_OBP_DIRECT_LOGIN_PASSWORD

    const authHeader = `DirectLogin username="${username}",password="${password}",consumer_key="${consumerKey}"`
    // Get token from OBP
    const tokenResponse = await fetch(`${this.clientConfig.baseUri}/my/logins/direct`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader
      }
    })

    if (!tokenResponse.ok) {
      throw new Error(`Failed to get direct login token: ${tokenResponse.statusText} ${await tokenResponse.text()}`)
    } 
    
    const token = await tokenResponse.json()
    return token.token
    

  }
}
