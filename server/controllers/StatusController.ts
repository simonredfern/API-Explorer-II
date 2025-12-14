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

import { Controller, Session, Req, Res, Get } from 'routing-controllers'
import type { Request, Response } from 'express'
import OBPClientService from '../services/OBPClientService.js'

import { Service, Container } from 'typedi'
import { OAuthConfig } from 'obp-typescript'
import { commitId } from '../app.js'
import { OAuth2Service } from '../services/OAuth2Service.js'
import {
  RESOURCE_DOCS_API_VERSION,
  MESSAGE_DOCS_API_VERSION,
  API_VERSIONS_LIST_API_VERSION
} from '../../src/shared-constants.js'

@Service()
@Controller('/status')
export class StatusController {
  private obpExplorerHome = process.env.VITE_OBP_API_EXPLORER_HOST
  private connectors = [
    'akka_vDec2018',
    'rest_vMar2019',
    'stored_procedure_vDec2019',
    'rabbitmq_vOct2024'
  ]
  private obpClientService: OBPClientService

  constructor() {
    // Explicitly get OBPClientService from the container to avoid injection issues
    this.obpClientService = Container.get(OBPClientService)
  }

  @Get('/')
  async index(
    @Session() session: any,
    @Req() request: Request,
    @Res() response: Response
  ): Response {
    const oauthConfig = session['clientConfig']
    const version = this.obpClientService.getOBPVersion()

    // Check if user is authenticated
    const isAuthenticated = oauthConfig && oauthConfig.oauth2?.accessToken

    let currentUser = null
    let apiVersions = false
    let messageDocs = false
    let resourceDocs = false

    if (isAuthenticated) {
      try {
        currentUser = await this.obpClientService.get(`/obp/${version}/users/current`, oauthConfig)
        apiVersions = await this.checkApiVersions(oauthConfig, version)
        messageDocs = await this.checkMessagDocs(oauthConfig, version)
        resourceDocs = await this.checkResourceDocs(oauthConfig, version)
      } catch (error) {
        console.error('StatusController: Error fetching authenticated data:', error)
      }
    }

    return response.json({
      status: apiVersions && messageDocs && resourceDocs,
      apiVersions,
      messageDocs,
      resourceDocs,
      currentUser,
      isAuthenticated,
      commitId
    })
  }

  isCodeError(response: any, path: string): boolean {
    console.log(`Validating ${path} response...`)
    if (!response || Object.keys(response).length == 0) return true
    if (Object.keys(response).includes('code')) {
      const code = response['code']
      if (code >= 400) {
        console.log(response) // Log error responce
        return true
      }
    }
    return false
  }

  async checkResourceDocs(oauthConfig: OAuthConfig, version: string): Promise<boolean> {
    try {
      const path = `/obp/${RESOURCE_DOCS_API_VERSION}/resource-docs/${version}/obp`
      const resourceDocs = await this.obpClientService.get(path, oauthConfig)
      return !this.isCodeError(resourceDocs, path)
    } catch (error) {
      return false
    }
  }
  async checkMessagDocs(oauthConfig: OAuthConfig, version: string): Promise<boolean> {
    try {
      const messageDocsCodeResult = await Promise.all(
        this.connectors.map(async (connector) => {
          const path = `/obp/${MESSAGE_DOCS_API_VERSION}/message-docs/${connector}`
          return !this.isCodeError(await this.obpClientService.get(path, oauthConfig), path)
        })
      )
      return messageDocsCodeResult.every((isCodeError: boolean) => isCodeError)
    } catch (error) {
      return false
    }
  }

  async checkApiVersions(oauthConfig: OAuthConfig, version: string): Promise<boolean> {
    try {
      const path = `/obp/${API_VERSIONS_LIST_API_VERSION}/api/versions`
      const versions = await this.obpClientService.get(path, oauthConfig)
      return !this.isCodeError(versions, path)
    } catch (error) {
      return false
    }
  }

  @Get('/oauth2')
  getOAuth2Status(@Res() response: Response): Response {
    try {
      const oauth2Service = Container.get(OAuth2Service)
      const isInitialized = oauth2Service.isInitialized()
      const oidcConfig = oauth2Service.getOIDCConfiguration()
      const healthCheckActive = oauth2Service.isHealthCheckActive()
      const healthCheckAttempts = oauth2Service.getHealthCheckAttempts()

      return response.json({
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
      return response.status(500).json({
        available: false,
        message: 'Error checking OAuth2 status',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  @Get('/oauth2/reconnect')
  async reconnectOAuth2(@Res() response: Response): Promise<Response> {
    try {
      const oauth2Service = Container.get(OAuth2Service)

      if (oauth2Service.isInitialized()) {
        return response.json({
          success: true,
          message: 'OAuth2 is already connected',
          alreadyConnected: true
        })
      }

      const wellKnownUrl = process.env.VITE_OBP_OAUTH2_WELL_KNOWN_URL
      if (!wellKnownUrl) {
        return response.status(400).json({
          success: false,
          message: 'VITE_OBP_OAUTH2_WELL_KNOWN_URL not configured'
        })
      }

      console.log('Manual OAuth2 reconnection attempt triggered...')
      await oauth2Service.initializeFromWellKnown(wellKnownUrl)

      console.log('Manual OAuth2 reconnection successful!')
      return response.json({
        success: true,
        message: 'OAuth2 reconnection successful',
        issuer: oauth2Service.getOIDCConfiguration()?.issuer || null
      })
    } catch (error) {
      console.error('Manual OAuth2 reconnection failed:', error)
      return response.status(500).json({
        success: false,
        message: 'OAuth2 reconnection failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
}
