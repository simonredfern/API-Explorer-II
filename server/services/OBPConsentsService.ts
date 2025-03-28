import { Service } from 'typedi'
import { Configuration, ConsentApi, ConsentsIMPLICITBody1, ConsumerConsentrequestsBody, InlineResponse20151, InlineResponse2017, ErrorUserNotLoggedIn} from 'obp-api-typescript'
import OBPClientService from './OBPClientService'
import OauthInjectedService from './OauthInjectedService'
import { AxiosResponse } from 'axios'
import axios from 'axios'
import { Session } from 'express-session'

@Service()
export default class OBPConsentsService {
    private consentApiConfig: Configuration
    public obpClientService: OBPClientService // This needs to be changed once we migrate away from the old OBP SDK
    constructor() {
        this.obpClientService = new OBPClientService()
    }
    /**
     * Function to create a OBP Consents API client
     * at differnt times in the consent flow we will either need to be acting as the logged in user, or the API Explorer II consumer
     * 
     * @param path 
     * @param method 
     * @param as_client 
     * @returns 
     */
    async createUserConsentsClient(session: any, path: string, method: string): Promise<ConsentApi | undefined> {
        // This function creates a Consents API client as the logged in user, using their OAuth1 headers

        // Check if the user is logged in
        const clientConfig = session['clientConfig']
        if (!clientConfig || !clientConfig.oauthConfig.accessToken) {
            throw new Error('User is not logged in')
        }
        
        
        try {

            // Get the OAuth1 headers for the logged in user to use in the API call
            const oauth1Headers = await this.obpClientService.getOAuthHeader(path, method, clientConfig)
            
            // Set config for the Consents API client from the new typescript SDK
            this.consentApiConfig = new Configuration({
                basePath: this.obpClientService.getOBPClientConfig().baseUri,
                apiKey: oauth1Headers
            })
            
            // Create the Consents API client
            return new ConsentApi(this.consentApiConfig)

        } catch (error) {
            console.error(error)
            throw new Error(`Could not create Consents API client for logged in user, ${error}`)
        }
    }
      
    async createConsent(session: Session): Promise<InlineResponse2017 | undefined> {
        // Create a consent as the logged in user, using Opey's consumerID 
        // I.e. give permission to Opey to do anything on behalf of the logged in user

        // Get the Consents API client from the OBP SDK
        const client = await this.createUserConsentsClient(session, '/obp/v5.1.0/my/consents/IMPLICIT', 'POST')
        if (!client) {
            throw new Error('Could not create Consents API client')
        }

        // get consumer ID for Opey
        const opeyConsumerID = process.env.VITE_OPEY_CONSUMER_ID
        if (!opeyConsumerID) {
            throw new Error('Opey Consumer ID is missing, please set VITE_OPEY_CONSUMER_ID')
        }

        // Format date for OBP, this is a mess
        const today = new Date().toISOString().split('.')[0] + 'Z' // get rid of milliseconds as OBP doesn't like them;

        const body: ConsentsIMPLICITBody1 = {
            everything: true, 
            entitlements: [],
            consumer_id: opeyConsumerID,
            views: [],
            valid_from: today,
            time_to_live: 3600,
        }

        
        try {
            const consentResponse = await client.oBPv510CreateConsentImplicit(body, {headers: {'Content-Type': 'application/json',}})
            
            // Save the consent in the session
            session['opeyConfig'] = {
                authConfig: {
                    obpConsent: consentResponse.data
                }
            }

            return consentResponse.data

        } catch (error: any) {
            console.log('error', error)
            if (error.response && error.response.data) {
                const errorData = error.response.data
                if (errorData.message) {
                    throw new Error(`OBP Error: ${JSON.stringify(errorData)}`);
                }
            }
            throw new Error(`Could not create consent, ${error}`)
        }
        
    }

    async getExistingConsent(session: Session): Promise<any> {
        // Get Consents for the current user, check if any of them are for Opey
        // If so, return the consent

        // I.e. this is done by iterating and finding the consent with the correct consumer ID

        // Get the Consents API client from the OBP SDK
        // The OBP SDK is fucked here, so we'll need to use Fetch until the SWAGGER WILL ACTUALLY WORK
        // const client = await this.createUserConsentsClient(session, '/obp/v5.1.0/my/consents/IMPLICIT', 'POST')
        // if (!client) {
        //     throw new Error('Could not create Consents API client')
        // }


        // Function to send an OBP request using the logged in user's OAuth1 headers
        const sendOBPRequest = async (path: string, method: string, clientConfig: any) =>{
            const oauth1Headers = await this.obpClientService.getOAuthHeader(path, method, clientConfig)
            const config = {
                headers: {
                    'Authorization': oauth1Headers,
                    'Content-Type': 'application/json',
                }
            }
            return axios.get(`${clientConfig.baseUri}${path}`, config)
        }

        const clientConfig = session['clientConfig']
        if (!clientConfig || !clientConfig.oauthConfig.accessToken) {
            throw new Error('User is not logged in')
        }


        const consentInfosPath = '/obp/v5.1.0/my/consent-infos'

        let opeyConsentId: string | null = null
        try {
            const response = await sendOBPRequest(consentInfosPath, 'GET', clientConfig)
            const consents = response.data.consents

            const opeyConsumerID = process.env.VITE_OPEY_CONSUMER_ID
            if (!opeyConsumerID) {
                throw new Error('Opey Consumer ID is missing, please set VITE_OPEY_CONSUMER_ID')
            }

            

            for (const consent of consents) {
                console.log('consent ', consent)
                if (consent.consumer_id === opeyConsumerID && consent.staus === 'ACCEPTED') {
                    opeyConsentId = consent.consent_id
                    break
                }
            }

            if (!opeyConsentId) {
                console.log('getExistingConsent: No consent found for Opey for current user')
                return null
            }

        } catch (error) {
            console.error(error)
            throw new Error(`Could not get existing consent info, ${error}`)
        }

        // Now try to get the consent using the consent ID
        try {
            const response = await sendOBPRequest(`/obp/v5.1.0/user/current/consents/${opeyConsentId}`, 'GET', clientConfig)
            
            session['opeyConfig'] = {
                authConfig: {
                    obpConsent: response.data
                }
            }
            
            return response.data
        } catch (error) {
            console.error(error)
            throw new Error(`Could not get existing consent, ${error}`)
        }


    }
        






    // Probably not needed, but will keep for later

    // async createConsentRequest(): Promise<InlineResponse20151 | undefined> {
    //     // this should be done as API Explorer II, so set client on instance for that
    //     const client = await this.createConsentClient('API_Explorer')
    //     if (!client) {
    //         throw new Error('Could not create Consents API client')
    //     }
    //     // Create a consent request
    //     // Parameters in body to be changed later to fit our needs, or match parameters given to this function
    //     try {
    //         const consentRequestResponse = await client.oBPv500CreateConsentRequest(
    //             {
    //                 accountAccess: [],
    //                 everything: false,
    //                 entitlements: [], 
    //                 consumerId: '',
    //             } as unknown as ConsumerConsentrequestsBody,
    //             {
    //                 headers: {
    //                     'Content-Type': 'application/json',
    //                 },
    //             }
    //         )

    //         return consentRequestResponse.data
    //     } catch (error) {
    //         console.error(error)
    //         throw new Error(`Could not create consent request, ${error}`)
    //     }
        


    // }
}