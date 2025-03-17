import {describe, it, vi, Mock } from 'vitest'
import { ConsentApi, InlineResponse2017 } from 'obp-api-typescript'
import { APIClientConfig, OAuthConfig } from 'obp-typescript';
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

describe('OBPConsentsService.createUserConsentsClient', () => {
    let obpConsentsService: OBPConsentsService;
    let mockedOAuthHeaders: string;
    let mockSession: any;

    beforeEach(async () => {
        
        vi.clearAllMocks();

        mockSession = {
            clientConfig: <APIClientConfig>{
                baseUri: 'https://test.openbankproject.com',
                version: 'v5.1.0',
                oauthConfig: <OAuthConfig>{
                    consumerKey: 'jgaawf2fnj4yixqdsfaq4gipt4v1wvgsxgre',
                    consumerSecret: 'asdofasdpfjawpefapwehhpfawheofphawfefh',
                    accessToken: {
                        key: 'asdhfiwah83o74gha8ygd8020ga8g28eoiahd',
                        secret: 'hpdasf79a4hahp9h29pphphepuuhu9hwpwufhpuw9eh',
                    }
                }
            }
        }

        mockGetOAuthHeader.mockImplementation(async () => `OAuth oauth_consumer_key="jgaawf2fnj4yixqdsfaq4gipt4v1wvgsxgre",oauth_nonce="JiGDBWA3MAyKtsd9qkfWCxfju36bMjsA",oauth_signature_method="HMAC-SHA1",oauth_timestamp="1741364123",oauth_version="1.0",oauth_signature="sa%2FRylnsdfLK8VPZI%2F2WkGFlTKs%3D"`);
        // Mock the OBP Client service for getting the OAuth and direct login headers
        obpConsentsService = new OBPConsentsService();
    });

    it('should return a ConsentApi client for logged in user', async () => {
        
        const consentClient = await obpConsentsService.createUserConsentsClient(mockSession, '/consents', 'POST');
        expect
        expect(consentClient).toBeDefined();
        // Check that getOAuthHeader was called when creating the client
        expect(mockGetOAuthHeader).toHaveBeenCalled();
        expect(consentClient).toBeInstanceOf(ConsentApi);
    })

    it('should throw correct error if OBPClientService.getOAuthHeader fails for logged in user', async () => {

        mockGetOAuthHeader.mockImplementationOnce(async () => {
            throw new Error('OAuth header error');
        });

        await expect(obpConsentsService.createUserConsentsClient(mockSession, '/consents', 'POST'))
            .rejects.toThrow(`Could not create Consents API client for logged in user, Error: OAuth header error`);
    })

})

describe('OBPConsentsService.createConsent', () => {
    let obpConsentsService: OBPConsentsService;
    let mockOBPv310CreateConsentImplicit: Mock
    let mockConsentApi: ConsentApi;
    let mockSession: any;

    beforeEach(() => {
        // reset mocks
        vi.clearAllMocks();
        // create mock session
        mockSession = {
            clientConfig: <APIClientConfig>{
                baseUri: 'https://test.openbankproject.com',
                version: 'v5.1.0',
                oauthConfig: <OAuthConfig>{
                    consumerKey: 'jgaawf2fnj4yixqdsfaq4gipt4v1wvgsxgre',
                    consumerSecret: 'asdofasdpfjawpefapwehhpfawheofphawfefh',
                    accessToken: {
                        key: 'asdhfiwah83o74gha8ygd8020ga8g28eoiahd',
                        secret: 'hpdasf79a4hahp9h29pphphepuuhu9hwpwufhpuw9eh',
                    }
                }
            }
        }

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
            oBPv510CreateConsentImplicit: mockOBPv310CreateConsentImplicit,
        } as unknown as ConsentApi;
        
        
        
        // Mock the createConsentClient method
        vi.spyOn(obpConsentsService, 'createUserConsentsClient').mockResolvedValue(mockConsentApi);

        const consentRequest = await obpConsentsService.createConsent(mockSession);

        expect(consentRequest).toBeDefined();
        expect(consentRequest).toHaveProperty('consent_id', '12345678');
        expect(consentRequest).toHaveProperty('jwt', 'asdjfawieofaowbfaowhh2084h02pefhh0.20fh02h0h29eyf09q3h09h.2-hf4-8h284hf0h0h0284h0');
        expect(consentRequest).toHaveProperty('status', 'INITIATED');
        expect(mockOBPv310CreateConsentImplicit).toHaveBeenCalled();
    })

    it('should update the session with a valid OpeyConfig with auth', async () => {
        // Create mock response function for consent IMPLICIT 
        mockOBPv310CreateConsentImplicit = vi.fn().mockResolvedValue({
            data: {
                consent_id: '12345678',
                jwt: "asdjfawieofaowbfaowhh2084h02pefhh0.20fh02h0h29eyf09q3h09h.2-hf4-8h284hf0h0h0284r0",
                status: 'INITIATED',
            },
        } as AxiosResponse<InlineResponse2017>);

        mockConsentApi = {
            oBPv510CreateConsentImplicit: mockOBPv310CreateConsentImplicit,
        } as unknown as ConsentApi;
        
        // Mock the createConsentClient method
        vi.spyOn(obpConsentsService, 'createUserConsentsClient').mockResolvedValue(mockConsentApi);

        await obpConsentsService.createConsent(mockSession);

        expect(mockSession).toHaveProperty('opeyConfig');
        expect(mockSession.opeyConfig).toHaveProperty('authConfig');
        expect(mockSession.opeyConfig.authConfig).toHaveProperty('obpConsent');
        expect(mockSession.opeyConfig.authConfig.obpConsent).toHaveProperty('status', 'INITIATED');
        expect(mockSession.opeyConfig.authConfig.obpConsent).toHaveProperty('jwt', 'asdjfawieofaowbfaowhh2084h02pefhh0.20fh02h0h29eyf09q3h09h.2-hf4-8h284hf0h0h0284r0');
    });
})