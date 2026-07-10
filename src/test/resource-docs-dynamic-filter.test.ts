import { describe, expect, it } from 'vitest'
import {
  isDynamicResourceDoc,
  removeDynamicDocsFromNonOBPStandards
} from '@/obp/resource-docs'

// Shapes taken from a real OBP-API response for
// GET /obp/v6.0.0/resource-docs/UKv3.1/obp (dynamic docs mixed in).
const ukStaticDoc = {
  operation_id: 'UKv3.1-getAccounts',
  tags: ['UK-Accounts'],
  implemented_by: { version: 'UKv3.1', function: 'getAccounts', technology: 'http4s' }
}

const dynamicEntityDoc = {
  operation_id: 'OBPv4.0.0-dynamicEntity_getSingleFooBar_',
  tags: ['_FooBar', 'Dynamic-Entity', 'Dynamic'],
  implemented_by: {
    version: 'OBPv4.0.0',
    function: 'dynamicEntity_getSingleFooBar_',
    technology: 'liftweb'
  }
}

const dynamicEndpointDoc = {
  operation_id: 'OBPv4.0.0-dynamicEndpoint_someEndpoint',
  tags: ['Dynamic-Endpoint'],
  implemented_by: {
    version: 'OBPv4.0.0',
    function: 'dynamicEndpoint_someEndpoint',
    technology: 'liftweb'
  }
}

// A dynamic doc missing the Dynamic tags — must still be caught via implemented_by
const untaggedDynamicDoc = {
  operation_id: 'OBPv4.0.0-dynamicEntity_createFooBar_',
  tags: ['_FooBar'],
  implemented_by: {
    version: 'OBPv4.0.0',
    function: 'dynamicEntity_createFooBar_',
    technology: 'liftweb'
  }
}

// User-created dynamic resource doc — carries only the 'Dynamic-Resource-Doc'
// tag and a free-form function name (no dynamicEntity/dynamicEndpoint prefix).
const dynamicResourceDoc = {
  operation_id: 'OBPv4.0.0-test-dynamic-resource-doc',
  tags: ['Dynamic-Resource-Doc'],
  implemented_by: {
    version: 'OBPv4.0.0',
    function: 'test-dynamic-resource-doc',
    technology: 'liftweb'
  }
}

const obpStaticDoc = {
  operation_id: 'OBPv6.0.0-getBanks',
  tags: ['Bank'],
  implemented_by: { version: 'OBPv6.0.0', function: 'getBanks', technology: 'http4s' }
}

describe('isDynamicResourceDoc', () => {
  it('identifies dynamic entity docs by tag', () => {
    expect(isDynamicResourceDoc(dynamicEntityDoc)).toBe(true)
  })

  it('identifies dynamic endpoint docs by tag', () => {
    expect(isDynamicResourceDoc(dynamicEndpointDoc)).toBe(true)
  })

  it('identifies dynamic docs by implemented_by.function when tags are missing', () => {
    expect(isDynamicResourceDoc(untaggedDynamicDoc)).toBe(true)
  })

  it('identifies user-created dynamic resource docs by the Dynamic-* tag family', () => {
    expect(isDynamicResourceDoc(dynamicResourceDoc)).toBe(true)
  })

  it('does not flag static docs', () => {
    expect(isDynamicResourceDoc(ukStaticDoc)).toBe(false)
    expect(isDynamicResourceDoc(obpStaticDoc)).toBe(false)
  })

  it('tolerates malformed docs', () => {
    expect(isDynamicResourceDoc({})).toBe(false)
    expect(isDynamicResourceDoc({ tags: 'not-an-array' })).toBe(false)
    expect(isDynamicResourceDoc(null)).toBe(false)
  })
})

describe('removeDynamicDocsFromNonOBPStandards', () => {
  it('strips dynamic docs from non-OBP standards but keeps their own docs', () => {
    const mapping = {
      'UKv3.1': { resource_docs: [ukStaticDoc, dynamicEntityDoc, dynamicEndpointDoc, untaggedDynamicDoc] },
      'BGv1.3': { resource_docs: [dynamicEntityDoc] }
    }
    removeDynamicDocsFromNonOBPStandards(mapping)
    expect(mapping['UKv3.1'].resource_docs).toStrictEqual([ukStaticDoc])
    expect(mapping['BGv1.3'].resource_docs).toStrictEqual([])
  })

  it('leaves OBP standard versions untouched, dynamic docs included', () => {
    const mapping = {
      'OBPv6.0.0': { resource_docs: [obpStaticDoc, dynamicEntityDoc] },
      'OBPdynamic-entity': { resource_docs: [dynamicEntityDoc] }
    }
    removeDynamicDocsFromNonOBPStandards(mapping)
    expect(mapping['OBPv6.0.0'].resource_docs).toStrictEqual([obpStaticDoc, dynamicEntityDoc])
    expect(mapping['OBPdynamic-entity'].resource_docs).toStrictEqual([dynamicEntityDoc])
  })

  it('tolerates malformed mappings', () => {
    expect(removeDynamicDocsFromNonOBPStandards(null)).toBe(null)
    expect(removeDynamicDocsFromNonOBPStandards(undefined)).toBe(undefined)
    const odd = { 'UKv3.1': {}, 'BGv1.3': { resource_docs: 'nope' } }
    expect(() => removeDynamicDocsFromNonOBPStandards(odd)).not.toThrow()
  })
})
