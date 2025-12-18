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

import { Controller, Session, Req, Res, Get, Delete, Post, Put } from 'routing-controllers'
import type { Request, Response } from 'express'
import OBPClientService from '../services/OBPClientService.js'
import { OAuth2Service } from '../services/OAuth2Service.js'
import { Service, Container } from 'typedi'

@Service()
@Controller()
export class OBPController {
  private obpClientService: OBPClientService
  private oauth2Service: OAuth2Service

  constructor() {
    // Explicitly get services from the container to avoid injection issues
    this.obpClientService = Container.get(OBPClientService)
    this.oauth2Service = Container.get(OAuth2Service)
  }

  /**
   * Check if access token is expired and refresh it if needed
   * This ensures API calls always use a valid token
   */
  private async ensureValidToken(session: any): Promise<boolean> {
    const accessToken = session['oauth2_access_token']
    const refreshToken = session['oauth2_refresh_token']

    // If no access token, user is not authenticated
    if (!accessToken) {
      return false
    }

    // Check if token is expired
    if (this.oauth2Service.isTokenExpired(accessToken)) {
      console.log('RequestController: Access token expired, attempting refresh')

      if (!refreshToken) {
        console.log('RequestController: No refresh token available')
        return false
      }

      try {
        const newTokens = await this.oauth2Service.refreshAccessToken(refreshToken)

        // Update session with new tokens
        session['oauth2_access_token'] = newTokens.accessToken
        session['oauth2_refresh_token'] = newTokens.refreshToken || refreshToken
        session['oauth2_id_token'] = newTokens.idToken
        session['oauth2_token_timestamp'] = Date.now()
        session['oauth2_expires_in'] = newTokens.expiresIn

        // CRITICAL: Update clientConfig with new access token
        if (session['clientConfig'] && session['clientConfig'].oauth2) {
          session['clientConfig'].oauth2.accessToken = newTokens.accessToken
          console.log('RequestController: Updated clientConfig with refreshed token')
        }

        console.log('RequestController: Token refresh successful')
        return true
      } catch (error) {
        console.error('RequestController: Token refresh failed:', error)
        return false
      }
    }

    // Token is still valid
    return true
  }

  @Get('/get')
  async get(@Session() session: any, @Req() request: Request, @Res() response: Response): Response {
    const path = request.query.path

    // Ensure token is valid before making the request
    const tokenValid = await this.ensureValidToken(session)
    if (!tokenValid && session['oauth2_user']) {
      console.log('RequestController: Token expired and refresh failed')
      return response.status(401).json({
        code: 401,
        message: 'Session expired. Please log in again.'
      })
    }

    const oauthConfig = session['clientConfig']

    try {
      const result = await this.obpClientService.get(path, oauthConfig)
      return response.json(result)
    } catch (error: any) {
      // 401 errors are expected when user is not authenticated - log as info, not error
      if (error.status === 401) {
        console.log(
          `[RequestController] 401 Unauthorized for path: ${path} (user not authenticated)`
        )
      } else {
        console.error('[RequestController] GET request error:', error)
      }
      return response.status(error.status || 500).json({
        code: error.status || 500,
        message: error.message || 'Internal server error'
      })
    }
  }

  @Post('/create')
  async create(
    @Session() session: any,
    @Req() request: Request,
    @Res() response: Response
  ): Response {
    const path = request.query.path
    const data = request.body

    // Ensure token is valid before making the request
    const tokenValid = await this.ensureValidToken(session)
    if (!tokenValid && session['oauth2_user']) {
      console.log('RequestController: Token expired and refresh failed')
      return response.status(401).json({
        code: 401,
        message: 'Session expired. Please log in again.'
      })
    }

    const oauthConfig = session['clientConfig']

    // Debug logging to diagnose authentication issues
    console.log('RequestController.create - Debug Info:')
    console.log('  Path:', path)
    console.log('  Session exists:', !!session)
    console.log('  Session keys:', session ? Object.keys(session) : 'N/A')
    console.log('  clientConfig exists:', !!oauthConfig)
    console.log('  oauth2 exists:', oauthConfig?.oauth2 ? 'YES' : 'NO')
    console.log('  accessToken exists:', oauthConfig?.oauth2?.accessToken ? 'YES' : 'NO')
    console.log('  oauth2_user exists:', session?.oauth2_user ? 'YES' : 'NO')

    try {
      const result = await this.obpClientService.create(path, data, oauthConfig)
      return response.json(result)
    } catch (error: any) {
      console.error('RequestController.create error:', error)
      return response.status(error.status || 500).json({
        code: error.status || 500,
        message: error.message || 'Internal server error'
      })
    }
  }

  @Put('/update')
  async update(
    @Session() session: any,
    @Req() request: Request,
    @Res() response: Response
  ): Response {
    const path = request.query.path
    const data = request.body

    // Ensure token is valid before making the request
    const tokenValid = await this.ensureValidToken(session)
    if (!tokenValid && session['oauth2_user']) {
      console.log('RequestController: Token expired and refresh failed')
      return response.status(401).json({
        code: 401,
        message: 'Session expired. Please log in again.'
      })
    }

    const oauthConfig = session['clientConfig']

    try {
      const result = await this.obpClientService.update(path, data, oauthConfig)
      return response.json(result)
    } catch (error: any) {
      console.error('RequestController.update error:', error)
      return response.status(error.status || 500).json({
        code: error.status || 500,
        message: error.message || 'Internal server error'
      })
    }
  }

  @Delete('/delete')
  async discard(
    @Session() session: any,
    @Req() request: Request,
    @Res() response: Response
  ): Response {
    const path = request.query.path

    // Ensure token is valid before making the request
    const tokenValid = await this.ensureValidToken(session)
    if (!tokenValid && session['oauth2_user']) {
      console.log('RequestController: Token expired and refresh failed')
      return response.status(401).json({
        code: 401,
        message: 'Session expired. Please log in again.'
      })
    }

    const oauthConfig = session['clientConfig']

    try {
      const result = await this.obpClientService.discard(path, oauthConfig)
      return response.json(result)
    } catch (error: any) {
      console.error('RequestController.delete error:', error)
      return response.status(error.status || 500).json({
        code: error.status || 500,
        message: error.message || 'Internal server error'
      })
    }
  }
}
