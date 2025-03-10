import { Service } from 'typedi'
import { Configuration, ConsentApi, ConsumerConsentrequestsBody, InlineResponse20151} from 'obp-api-typescript'
import OBPClientService from './OBPClientService'
import { AxiosResponse } from 'axios'

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
    async createConsentClient(as_consumer: "logged_in_user" | "API_Explorer", path?: string, method?: string): Promise<ConsentApi | undefined> {
        // This function creates a Consents API client as the logged in user, using their OAuth1 headers
        if (as_consumer === "logged_in_user") {
            if (!path || !method) {
                throw new Error("Path and method are required when creating a Consents API client for a logged in user")
            }
            try {

                // Get the OAuth1 headers for the logged in user to use in the API call
                const oauth1Headers = await this.obpClientService.getOAuthHeader(path, method)
                const authHeader = "OAuth " + oauth1Headers
                // Set config for the Consents API client from the new typescript SDK
                this.consentApiConfig = new Configuration({
                    basePath: this.obpClientService.getOBPClientConfig().baseUri,
                    accessToken: authHeader
                })
                
                // Create the Consents API client
                return new ConsentApi(this.consentApiConfig)

            } catch (error) {
                console.error(error)
                throw new Error(`Could not create Consents API client for logged in user, ${error}`)
            }

        } else if (as_consumer === "API_Explorer") {

            try {
                // Get direct Login token from OBP for API Explorer II
                const directLoginToken = await this.obpClientService.getDirectLoginToken()
                const directLoginHeader = "DirectLogin token=" + directLoginToken
                // Set config for the Consents API client from the new typescript SDK
                this.consentApiConfig = new Configuration({
                    basePath: this.obpClientService.getOBPClientConfig().baseUri,
                    accessToken: directLoginHeader
                })

                return new ConsentApi(this.consentApiConfig)

            } catch (error) {
                console.error(error)
                throw new Error(`Could not create Consents API client for API Explorer, ${error}`)
            }
        } else {
            throw new Error("Invalid client type, must be 'logged_in_user' or 'API_Explorer'")
        }
    }
        
        
    async createConsentRequest(): Promise<InlineResponse20151 | undefined> {
        // this should be done as API Explorer II, so set client on instance for that
        const client = await this.createConsentClient('API_Explorer')
        if (!client) {
            throw new Error('Could not create Consents API client')
        }
        // Create a consent request
        // Parameters in body to be changed later to fit our needs, or match parameters given to this function
        try {
            const consentRequestResponse = await client.oBPv500CreateConsentRequest(
                {
                    accountAccess: [],
                    everything: false,
                    entitlements: [], 
                    consumerId: '',
                } as unknown as ConsumerConsentrequestsBody,
                {
                    headers: {
                        'Content-Type': 'application/json',
                    },
                }
            )

            return consentRequestResponse.data
        } catch (error) {
            console.error(error)
            throw new Error(`Could not create consent request, ${error}`)
        }
        


    }
}