import { describe, vi, expect, it, beforeEach } from 'vitest'
import { getobpConsent } from '@/obp/common-functions';

describe('getobpConsent', () => {
    
    beforeEach(() => {
        global.fetch = vi.fn(() =>
            Promise.resolve(new Response(JSON.stringify({consent_id: 1234}), {
                headers: { 'content-type': 'application/json' },
                status: 200,
            }))
        );
    })
    
    it('should call fetch', async () => {
        await getobpConsent()
        expect(global.fetch).toHaveBeenCalled()
    })

    it('should return a consent id', async () => {
        const consentId = await getobpConsent()
        expect(consentId).toStrictEqual({consent_id: 1234})
    })
})