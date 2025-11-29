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
import { Request, Response } from 'express'
import OBPClientService from '../services/OBPClientService'
import OauthInjectedService from '../services/OauthInjectedService'
import { Service } from 'typedi'
import superagent from 'superagent'
import { OAuth2Service } from '../services/OAuth2Service'

@Service()
@Controller('/user')
export class UserController {
  private obpExplorerHome = process.env.VITE_OBP_API_EXPLORER_HOST
  private useOAuth2 = process.env.VITE_USE_OAUTH2 === 'true'

  constructor(
    private obpClientService: OBPClientService,
    private oauthInjectedService: OauthInjectedService,
    private oauth2Service: OAuth2Service
  ) {}
  @Get('/logoff')
  async logout(
    @Session() session: any,
    @Req() request: Request,
    @Res() response: Response
  ): Response {
    console.log('UserController: Logging out user')

    // Clear OAuth 1.0a session data
    this.oauthInjectedService.requestTokenKey = undefined
    this.oauthInjectedService.requestTokenSecret = undefined
    session['clientConfig'] = undefined

    // Clear OAuth2 session data
    delete session['oauth2_access_token']
    delete session['oauth2_refresh_token']
    delete session['oauth2_id_token']
    delete session['oauth2_token_type']
    delete session['oauth2_expires_in']
    delete session['oauth2_token_timestamp']
    delete session['oauth2_user_info']
    delete session['oauth2_user']

    // Destroy the session completely
    session.destroy((err: any) => {
      if (err) {
        console.error('UserController: Error destroying session:', err)
      } else {
        console.log('UserController: Session destroyed successfully')
      }
    })

    const redirectPage = (request.query.redirect as string) || this.obpExplorerHome || '/'

    if (!this.obpExplorerHome) {
      console.error(`VITE_OBP_API_EXPLORER_HOST: ${this.obpExplorerHome}`)
    }

    console.log('UserController: Redirecting to:', redirectPage)
    response.redirect(redirectPage)

    return response
  }

  @Get('/current')
  async current(
    @Session() session: any,
    @Req() request: Request,
    @Res() response: Response
  ): Response {
    console.log('UserController: Getting current user')
    console.log('  OAuth2 enabled:', this.useOAuth2)

    // Check OAuth2 session first (if OAuth2 is enabled)
    if (this.useOAuth2 && session['oauth2_user']) {
      console.log('UserController: Returning OAuth2 user info')
      const oauth2User = session['oauth2_user']

      // Check if access token is expired and needs refresh
      const accessToken = session['oauth2_access_token']
      const refreshToken = session['oauth2_refresh_token']

      if (accessToken && this.oauth2Service.isTokenExpired(accessToken)) {
        console.log('UserController: Access token expired')

        if (refreshToken) {
          console.log('UserController: Attempting token refresh')
          try {
            const newTokens = await this.oauth2Service.refreshAccessToken(refreshToken)

            // Update session with new tokens
            session['oauth2_access_token'] = newTokens.accessToken
            session['oauth2_refresh_token'] = newTokens.refreshToken || refreshToken
            session['oauth2_id_token'] = newTokens.idToken
            session['oauth2_token_timestamp'] = Date.now()
            session['oauth2_expires_in'] = newTokens.expiresIn

            console.log('UserController: Token refresh successful')
          } catch (error) {
            console.error('UserController: Token refresh failed:', error)
            // Return empty object to indicate user needs to re-authenticate
            return response.json({})
          }
        } else {
          console.log('UserController: No refresh token available, user needs to re-authenticate')
          return response.json({})
        }
      }

      // Return user info in format compatible with frontend
      return response.json({
        user_id: oauth2User.sub,
        username: oauth2User.username,
        email: oauth2User.email,
        email_verified: oauth2User.email_verified,
        name: oauth2User.name,
        given_name: oauth2User.given_name,
        family_name: oauth2User.family_name,
        provider: oauth2User.provider || 'oauth2'
      })
    }

    // Fall back to OAuth 1.0a
    console.log('UserController: Checking OAuth 1.0a session')
    const oauthConfig = session['clientConfig']

    if (!oauthConfig) {
      console.log('UserController: No authentication session found')
      return response.json({})
    }

    console.log('UserController: Returning OAuth 1.0a user info')
    const version = this.obpClientService.getOBPVersion()

    try {
      const userData = await this.obpClientService.get(`/obp/${version}/users/current`, oauthConfig)
      return response.json(userData)
    } catch (error) {
      console.error('UserController: Failed to get user from OBP API:', error)
      return response.json({})
    }
  }
}
