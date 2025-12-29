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

const router = Router()

// Get services from container
const obpClientService = Container.get(OBPClientService)
const oauth2Service = Container.get(OAuth2Service)

/**
 * Check if access token is expired and refresh it if needed
 * This ensures API calls always use a valid token
 */
async function ensureValidToken(session: any): Promise<boolean> {
  const accessToken = session.oauth2_access_token
  const refreshToken = session.oauth2_refresh_token

  // If no access token, user is not authenticated
  if (!accessToken) {
    return false
  }

  // Check if token is expired
  if (oauth2Service.isTokenExpired(accessToken)) {
    console.log('OBP: Access token expired, attempting refresh')

    if (!refreshToken) {
      console.log('OBP: No refresh token available')
      return false
    }

    try {
      const newTokens = await oauth2Service.refreshAccessToken(refreshToken)

      // Update session with new tokens
      session.oauth2_access_token = newTokens.accessToken
      session.oauth2_refresh_token = newTokens.refreshToken || refreshToken
      session.oauth2_id_token = newTokens.idToken
      session.oauth2_token_timestamp = Date.now()
      session.oauth2_expires_in = newTokens.expiresIn

      // Update clientConfig with new access token
      if (session.clientConfig && session.clientConfig.oauth2) {
        session.clientConfig.oauth2.accessToken = newTokens.accessToken
        console.log('OBP: Updated clientConfig with refreshed token')
      }

      console.log('OBP: Token refresh successful')
      return true
    } catch (error) {
      console.error('OBP: Token refresh failed:', error)
      return false
    }
  }

  // Token is still valid
  return true
}

/**
 * GET /get
 * Proxy GET requests to OBP API
 * Query params:
 *   - path: OBP API path to call (e.g., /obp/v5.1.0/banks)
 */
router.get('/get', async (req: Request, res: Response) => {
  try {
    const path = req.query.path as string
    const session = req.session as any

    // Ensure token is valid before making the request
    const tokenValid = await ensureValidToken(session)
    if (!tokenValid && session.oauth2_user) {
      console.log('OBP: Token expired and refresh failed')
      return res.status(401).json({
        code: 401,
        message: 'Session expired. Please log in again.'
      })
    }

    const oauthConfig = session.clientConfig

    const result = await obpClientService.get(path, oauthConfig)
    res.json(result)
  } catch (error: any) {
    // 401 errors are expected when user is not authenticated - log as info, not error
    if (error.status === 401) {
      console.log(`OBP: 401 Unauthorized for path: ${req.query.path} (user not authenticated)`)
    } else {
      console.error('OBP: GET request error:', error)
    }
    res.status(error.status || 500).json({
      code: error.status || 500,
      message: error.message || 'Internal server error'
    })
  }
})

/**
 * POST /create
 * Proxy POST requests to OBP API
 * Query params:
 *   - path: OBP API path to call
 * Body: JSON data to send to OBP API
 */
router.post('/create', async (req: Request, res: Response) => {
  try {
    const path = req.query.path as string
    const data = req.body
    const session = req.session as any

    // Ensure token is valid before making the request
    const tokenValid = await ensureValidToken(session)
    if (!tokenValid && session.oauth2_user) {
      console.log('OBP: Token expired and refresh failed')
      return res.status(401).json({
        code: 401,
        message: 'Session expired. Please log in again.'
      })
    }

    const oauthConfig = session.clientConfig

    // Debug logging to diagnose authentication issues
    console.log('OBP.create - Debug Info:')
    console.log('  Path:', path)
    console.log('  Session exists:', !!session)
    console.log('  clientConfig exists:', !!oauthConfig)
    console.log('  oauth2 exists:', oauthConfig?.oauth2 ? 'YES' : 'NO')
    console.log('  accessToken exists:', oauthConfig?.oauth2?.accessToken ? 'YES' : 'NO')
    console.log('  oauth2_user exists:', session?.oauth2_user ? 'YES' : 'NO')

    const result = await obpClientService.create(path, data, oauthConfig)
    res.json(result)
  } catch (error: any) {
    console.error('OBP.create error:', error)
    res.status(error.status || 500).json({
      code: error.status || 500,
      message: error.message || 'Internal server error'
    })
  }
})

/**
 * PUT /update
 * Proxy PUT requests to OBP API
 * Query params:
 *   - path: OBP API path to call
 * Body: JSON data to send to OBP API
 */
router.put('/update', async (req: Request, res: Response) => {
  try {
    const path = req.query.path as string
    const data = req.body
    const session = req.session as any

    // Ensure token is valid before making the request
    const tokenValid = await ensureValidToken(session)
    if (!tokenValid && session.oauth2_user) {
      console.log('OBP: Token expired and refresh failed')
      return res.status(401).json({
        code: 401,
        message: 'Session expired. Please log in again.'
      })
    }

    const oauthConfig = session.clientConfig

    const result = await obpClientService.update(path, data, oauthConfig)
    res.json(result)
  } catch (error: any) {
    console.error('OBP.update error:', error)
    res.status(error.status || 500).json({
      code: error.status || 500,
      message: error.message || 'Internal server error'
    })
  }
})

/**
 * DELETE /delete
 * Proxy DELETE requests to OBP API
 * Query params:
 *   - path: OBP API path to call
 */
router.delete('/delete', async (req: Request, res: Response) => {
  try {
    const path = req.query.path as string
    const session = req.session as any

    // Ensure token is valid before making the request
    const tokenValid = await ensureValidToken(session)
    if (!tokenValid && session.oauth2_user) {
      console.log('OBP: Token expired and refresh failed')
      return res.status(401).json({
        code: 401,
        message: 'Session expired. Please log in again.'
      })
    }

    const oauthConfig = session.clientConfig

    const result = await obpClientService.discard(path, oauthConfig)
    res.json(result)
  } catch (error: any) {
    console.error('OBP.delete error:', error)
    res.status(error.status || 500).json({
      code: error.status || 500,
      message: error.message || 'Internal server error'
    })
  }
})

export default router
