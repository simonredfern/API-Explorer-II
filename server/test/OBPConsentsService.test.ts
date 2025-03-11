import {describe, beforeAll, it, vi, Mock, MockInstance } from 'vitest'
import { ConsentApi, InlineResponse20151, InlineResponse2017 } from 'obp-api-typescript'
import { AxiosResponse } from 'axios'

const mockGetOAuthHeader = vi.fn(async () => (`OAuth oauth_consumer_key="jgaawf2fnj4yixqdsfaq4gipt4v1wvgsxgre",oauth_nonce="JiGDBWA3MAyKtsd9qkfWCxfju36bMjsA",oauth_signature_method="HMAC-SHA1",oauth_timestamp="1741364123",oauth_version="1.0",oauth_signature="sa%2FRylnsdfLK8VPZI%2F2WkGFlTKs%3D"`));
const mockGetDirectLoginToken = vi.fn(async () => {
    return "eyJhbGciOisdReI1NiJ9.eyIiOiIifQ.neaNv-ltBoEEyErvmhmEbYIG8KLdjqRfT7hA7uKPdvs"
});

vi.mock('../services/OBPClientService', () => {
    return {
      default: vi.fn().mockImplementation(() => {
        return {
            // mock getOAuthHeader
            getOBPClientConfig: vi.fn(() => ({baseUri: 'https://test.openbankproject.com'})),
            getOAuthHeader: mockGetOAuthHeader,
            getDirectLoginToken: mockGetDirectLoginToken,
        }
      }),
    }
})

import OBPConsentsService from '../services/OBPConsentsService';
import { before } from 'node:test';

describe('OBPConsentsService.createConsentClient', () => {
    let obpConsentsService: OBPConsentsService;
    let mockedOAuthHeaders: string;

    beforeEach(async () => {
        
        vi.clearAllMocks();

        mockGetOAuthHeader.mockImplementation(async () => `OAuth oauth_consumer_key="jgaawf2fnj4yixqdsfaq4gipt4v1wvgsxgre",oauth_nonce="JiGDBWA3MAyKtsd9qkfWCxfju36bMjsA",oauth_signature_method="HMAC-SHA1",oauth_timestamp="1741364123",oauth_version="1.0",oauth_signature="sa%2FRylnsdfLK8VPZI%2F2WkGFlTKs%3D"`);
        // Mock the OBP Client service for getting the OAuth and direct login headers
        obpConsentsService = new OBPConsentsService();
    });

    it('should return a ConsentApi client for logged in user', async () => {
        const consentClient = await obpConsentsService.createConsentClient('logged_in_user', '/consents', 'POST');
        expect(consentClient).toBeDefined();
        expect(consentClient).toBeInstanceOf(ConsentApi);
    })

    it('should return a ConsentApi client for API Explorer', async () => {
        const consentClient = await obpConsentsService.createConsentClient('API_Explorer');
        expect(consentClient).toBeDefined();
        expect(consentClient).toBeInstanceOf(ConsentApi);
    })

    it('should throw an error if the client type is not recognized', async () => {
        await expect(obpConsentsService.createConsentClient('unknown', '/consents', 'POST')).rejects.toThrow();
    })

    it('should throw correct error if OBPClientService.getOAuthHeader fails for logged in user', async () => {

        mockGetOAuthHeader.mockImplementationOnce(async () => {
            throw new Error('OAuth header error');
        });

        await expect(obpConsentsService.createConsentClient('logged_in_user', '/consents', 'POST'))
            .rejects.toThrow(`Could not create Consents API client for logged in user, Error: OAuth header error`);
    })

    it('should throw correct error if OBPClientService.getDirectLoginToken fails for API Explorer', async () => {

        mockGetDirectLoginToken.mockImplementationOnce(async () => {
            throw new Error('Direct login token error');
        });

        await expect(obpConsentsService.createConsentClient('API_Explorer', '/consents', 'POST'))
            .rejects.toThrow(`Could not create Consents API client for API Explorer, Error: Direct login token error`);
    })

    it('should throw an error if as_consumer is logged_in_user and path or method is missing', async () => {
        await expect(obpConsentsService.createConsentClient('logged_in_user'))
            .rejects.toThrow('Path and method are required when creating a Consents API client for a logged in user');
    })
})

describe('OBPConsentsService.createConsentRequest', () => {
    let obpConsentsService: OBPConsentsService;
    let mockOBPv500CreateConsentRequest: Mock
    let mockConsentApi: ConsentApi;
    beforeEach(() => {
        // reset mocks
        vi.clearAllMocks();

        // Create mock response function
        mockOBPv500CreateConsentRequest = vi.fn().mockResolvedValue({
            data: {
                consent_request_id: '12345678',
                payload: {},
                consumer_id: '87654321',
            },
        } as AxiosResponse<InlineResponse20151>);

        mockConsentApi = {
            oBPv500CreateConsentRequest: mockOBPv500CreateConsentRequest,
        } as unknown as ConsentApi;
        
        // Create service instance
        obpConsentsService = new OBPConsentsService();
        
        // Mock the createConsentClient method
        vi.spyOn(obpConsentsService, 'createConsentClient').mockResolvedValue(mockConsentApi);
    })

    it('should call the createConsentClient method as the API_Explorer user', async () => {
        // 
        await obpConsentsService.createConsentRequest();
        expect(obpConsentsService.createConsentClient).toHaveBeenCalledWith('API_Explorer');
    });

    it('should return a consent request response object with valid fields', async () => {
        
        // Call the method
        const consentRequest = await obpConsentsService.createConsentRequest();
        
        console.log('Response: ', consentRequest);
        // Verify the result
        expect(consentRequest).toBeDefined();
        expect(consentRequest).toHaveProperty('consent_request_id', '12345678');
        expect(consentRequest).toHaveProperty('consumer_id', '87654321');
        expect(consentRequest).toHaveProperty('payload');
        
        // Verify the mock was called
        expect(mockOBPv500CreateConsentRequest).toHaveBeenCalled();

    });
});

describe('OBPConsentsService.createConsent', () => {
    let obpConsentsService: OBPConsentsService;
    let mockOBPv310CreateConsentImplicit: Mock
    let mockConsentApi: ConsentApi;
    beforeEach(() => {
        // reset mocks
        vi.clearAllMocks();
        // Create service instance
        obpConsentsService = new OBPConsentsService();
    })

    it('with mocked', async () => {
        // Create mock response function for consent IMPLICIT 
        mockOBPv310CreateConsentImplicit = vi.fn().mockResolvedValue({
            data: {
                consent_id: '12345678',
                jwt: "asdjfawieofaowbfaowhh2084h02pefhh0.20fh02h0h29eyf09q3h09h.2-hf4-8h284hf0h0h0284h0",
                status: 'INITIATED',
            },
        } as AxiosResponse<InlineResponse2017>);

        mockConsentApi = {
            oBPv310CreateConsentImplicit: mockOBPv310CreateConsentImplicit,
        } as unknown as ConsentApi;
        
        
        
        // Mock the createConsentClient method
        vi.spyOn(obpConsentsService, 'createConsentClient').mockResolvedValue(mockConsentApi);

        const consentRequest = await obpConsentsService.createConsent();

        expect(consentRequest).toBeDefined();
        expect(consentRequest).toHaveProperty('consent_id', '12345678');
        expect(consentRequest).toHaveProperty('jwt', 'asdjfawieofaowbfaowhh2084h02pefhh0.20fh02h0h29eyf09q3h09h.2-hf4-8h284hf0h0h0284h0');
        expect(consentRequest).toHaveProperty('status', 'INITIATED');
        expect(mockOBPv310CreateConsentImplicit).toHaveBeenCalled();
    })
})