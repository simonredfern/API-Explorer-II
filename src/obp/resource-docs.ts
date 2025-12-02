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

import { OBP_API_VERSION, get, isServerUp } from '../obp'
import { getOBPAPIVersions } from '../obp/api-version'
import { updateLoadingInfoMessage } from './common-functions'

// Get Resource Docs
export async function getOBPResourceDocs(apiStandardAndVersion: string): Promise<any> {
  const logMessage = `Loading API ${apiStandardAndVersion}`
  console.log(logMessage)
  updateLoadingInfoMessage(logMessage)
  const path = `/obp/${OBP_API_VERSION}/resource-docs/${apiStandardAndVersion}/obp`
  try {
    return await get(path)
  } catch (error: any) {
    console.error(`Failed to load resource docs for ${apiStandardAndVersion}`)
    console.error(`  URL: ${path}`)
    console.error(`  Status: ${error.status || 'unknown'}`)
    console.error(`  Error: ${error.message || JSON.stringify(error)}`)
    throw error
  }
}

export async function getOBPDynamicResourceDocs(apiStandardAndVersion: string): Promise<any> {
  const logMessage = `Loading Dynamic Docs for ${apiStandardAndVersion}`
  console.log(logMessage)
  updateLoadingInfoMessage(logMessage)
  const path = `/obp/${OBP_API_VERSION}/resource-docs/${apiStandardAndVersion}/obp?content=dynamic`
  try {
    return await get(path)
  } catch (error: any) {
    console.error(`Failed to load dynamic resource docs for ${apiStandardAndVersion}`)
    console.error(`  URL: ${path}`)
    console.error(`  Status: ${error.status || 'unknown'}`)
    console.error(`  Error: ${error.message || JSON.stringify(error)}`)
    throw error
  }
}

export function getFilteredGroupedResourceDocs(
  apiStandardAndVersion: string,
  tags: any,
  docs: any
): Promise<any> {
  console.log(docs)
  if (
    apiStandardAndVersion === undefined ||
    docs === undefined ||
    docs[apiStandardAndVersion] === undefined
  )
    return Promise.resolve<any>({})
  let list = tags.split(',')
  return docs[apiStandardAndVersion].resource_docs
    .filter((subArray: any) => subArray.tags.some((value: string) => list.includes(value))) // Filter by tags
    .reduce((values: any, doc: any) => {
      const tag = doc.tags[0] // Group by the first tag at resorce doc
      ;(values[tag] = values[tag] || []).push(doc)
      return values
    }, {})
}

export function getGroupedResourceDocs(apiStandardAndVersion: string, docs: any): Promise<any> {
  if (apiStandardAndVersion === undefined || docs === undefined) return Promise.resolve<any>({})

  return docs[apiStandardAndVersion].resource_docs.reduce((values: any, doc: any) => {
    const tag = doc.tags[0] // Group by the first tag at resorce doc
    ;(values[tag] = values[tag] || []).push(doc)
    return values
  }, {})
}

export function getOperationDetails(version: string, operation_id: string, docs: any): any {
  return docs[version].resource_docs.filter((doc: any) => doc.operation_id === operation_id)[0]
}

export async function cacheDoc(cacheStorageOfResourceDocs: any): Promise<any> {
  try {
    const apiVersions = await getOBPAPIVersions()
    if (
      !apiVersions ||
      !apiVersions.scanned_api_versions ||
      !Array.isArray(apiVersions.scanned_api_versions)
    ) {
      console.warn('API versions response is invalid or user not authenticated, skipping cache')
      return {}
    }
    const scannedAPIVersions = apiVersions.scanned_api_versions
    const resourceDocsMapping: any = {}
    for (const { apiStandard, API_VERSION } of scannedAPIVersions) {
      // we need this to cache the dynamic entities resource doc
      if (API_VERSION === 'dynamic-entity') {
        const logMessage = `Caching Dynamic API { standard: ${apiStandard}, version: ${API_VERSION} }`
        console.log(logMessage)
        if (apiStandard) {
          try {
            const version = `${apiStandard.toUpperCase()}${API_VERSION}`
            console.log(`[CACHE] Attempting to load dynamic resource docs for: ${version}`)
            const resourceDocs = await getOBPDynamicResourceDocs(version)
            if (version && Object.keys(resourceDocs).includes('resource_docs')) {
              resourceDocsMapping[version] = resourceDocs
              console.log(`[CACHE] Successfully cached dynamic docs for: ${version}`)
            } else {
              console.warn(`[CACHE] WARNING: Response for ${version} missing 'resource_docs' field`)
            }
          } catch (error: any) {
            console.warn(`[CACHE] WARNING: Skipping dynamic endpoint ${apiStandard}${API_VERSION}:`)
            console.warn(`   API Version: ${API_VERSION}`)
            console.warn(`   API Standard: ${apiStandard}`)
            console.warn(
              `   Constructed version string: ${apiStandard.toUpperCase()}${API_VERSION}`
            )
            console.warn(`   Error status: ${error.status || 'unknown'}`)
            console.warn(`   Error message: ${error.message || 'No message'}`)
            if (error.status === 500) {
              console.warn(
                `   NOTE: This likely means the OBP-API server doesn't have this feature enabled`
              )
            }
          }
        }
        updateLoadingInfoMessage(logMessage)
        continue
      }
      const logMessage = `Caching API { standard: ${apiStandard}, version: ${API_VERSION} }`
      console.log(logMessage)
      if (apiStandard) {
        try {
          const version = `${apiStandard.toUpperCase()}${API_VERSION}`
          console.log(`[CACHE] Attempting to load resource docs for: ${version}`)
          const resourceDocs = await getOBPResourceDocs(version)
          if (version && Object.keys(resourceDocs).includes('resource_docs')) {
            resourceDocsMapping[version] = resourceDocs
            console.log(`[CACHE] Successfully cached docs for: ${version}`)
          } else {
            console.warn(`[CACHE] WARNING: Response for ${version} missing 'resource_docs' field`)
          }
        } catch (error: any) {
          console.warn(`[CACHE] WARNING: Skipping API version ${apiStandard}${API_VERSION}:`)
          console.warn(`   API Version: ${API_VERSION}`)
          console.warn(`   API Standard: ${apiStandard}`)
          console.warn(`   Constructed version string: ${apiStandard.toUpperCase()}${API_VERSION}`)
          console.warn(`   Error status: ${error.status || 'unknown'}`)
          console.warn(`   Error message: ${error.message || 'No message'}`)
          if (error.status === 500) {
            console.warn(`   NOTE: This API version may not be available on the OBP-API server`)
          } else if (error.status === 404) {
            console.warn(`   NOTE: This endpoint was not found on the OBP-API server`)
          }
        }
      }
      updateLoadingInfoMessage(logMessage)
    }
    await cacheStorageOfResourceDocs.put('/', new Response(JSON.stringify(resourceDocsMapping)))
    return resourceDocsMapping
  } catch (error) {
    console.error('Failed to cache resource docs:', error)
    console.warn('Returning empty cache - user may need to login')
    return {}
  }
}

async function getCacheDoc(cacheStorageOfResourceDocs: any): Promise<any> {
  return await cacheDoc(cacheStorageOfResourceDocs)
}

export async function cache(cachedStorage: any, cachedResponse: any, worker: any): Promise<any> {
  try {
    worker.postMessage('update-resource-docs')
    const resourceDocs = await cachedResponse.json()
    const groupedResourceDocs = getGroupedResourceDocs('OBP' + OBP_API_VERSION, resourceDocs)
    return { resourceDocs, groupedDocs: groupedResourceDocs }
  } catch (error) {
    console.warn('No resource docs cache or malformed cache.')
    console.log('Caching resource docs...')
    const isServerActive = await isServerUp()
    if (!isServerActive) throw new Error('API Server is not responding.')
    const resourceDocs = await getCacheDoc(cachedStorage)
    const groupedDocs = getGroupedResourceDocs('OBP' + OBP_API_VERSION, resourceDocs)
    return { resourceDocs, groupedDocs }
  }
}
