import { mount } from '@vue/test-utils'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: {}, query: {} }),
  onBeforeRouteUpdate: () => {}
}))

vi.mock('../obp', () => ({
  OBP_API_DEFAULT_RESOURCE_DOC_VERSION: 'OBPv7.0.0',
  get: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  discard: vi.fn(),
  createEntitlement: vi.fn(),
  getCurrentUser: vi.fn(async () => ({})),
  getUserEntitlements: vi.fn(async () => ({ list: [] }))
}))

vi.mock('../obp/resource-docs', () => ({
  getOperationDetails: vi.fn()
}))

import Preview from '../components/Preview.vue'

const mountPreview = () =>
  mount(Preview, {
    global: {
      mocks: {
        $t: (key: string) => key
      }
    }
  })

describe('Preview.vue - resolvedRequestUrl', () => {
  const originalHost = import.meta.env.VITE_OBP_API_HOST

  afterEach(() => {
    if (originalHost === undefined) {
      delete import.meta.env.VITE_OBP_API_HOST
    } else {
      import.meta.env.VITE_OBP_API_HOST = originalHost
    }
    vi.restoreAllMocks()
  })

  it('prefixes the resolved path with the configured OBP API host', async () => {
    import.meta.env.VITE_OBP_API_HOST = 'http://127.0.0.1:8080'
    const wrapper = mountPreview()
    wrapper.vm.url = '/obp/v6.0.0/banks/gh.29.uk/accounts'
    await wrapper.vm.$nextTick()

    expect(wrapper.vm.resolvedRequestUrl).toBe('http://127.0.0.1:8080/obp/v6.0.0/banks/gh.29.uk/accounts')
    expect(wrapper.find('#resolved-request-url').text()).toBe(
      'http://127.0.0.1:8080/obp/v6.0.0/banks/gh.29.uk/accounts'
    )
  })

  it('falls back to the raw path without crashing when no host is configured', async () => {
    delete import.meta.env.VITE_OBP_API_HOST
    const wrapper = mountPreview()
    wrapper.vm.url = '/obp/v6.0.0/banks/gh.29.uk/accounts'
    await wrapper.vm.$nextTick()

    expect(wrapper.vm.resolvedRequestUrl).toBe('/obp/v6.0.0/banks/gh.29.uk/accounts')
  })

  it('returns an empty url as-is when nothing has been entered yet', async () => {
    import.meta.env.VITE_OBP_API_HOST = 'http://127.0.0.1:8080'
    const wrapper = mountPreview()
    wrapper.vm.url = ''
    await wrapper.vm.$nextTick()

    expect(wrapper.vm.resolvedRequestUrl).toBe('')
  })
})
