import { Service } from 'typedi'
import { UserInput, StreamInput, OpeyConfig, AuthConfig, ConsentRequestResponse } from '../schema/OpeySchema'
import OBPClientService from './OBPClientService'

@Service()
export default class OpeyClientService {
    private opeyConfig: OpeyConfig
    public obpClientService: OBPClientService
    constructor() {
        this.opeyConfig = {
            baseUri: process.env.VITE_CHATBOT_URL? process.env.VITE_CHATBOT_URL : 'http://localhost:5000',
            paths: {
                status: '/status',
                stream: '/stream',
                invoke: '/invoke',
                approve_tool: '/approve_tool/{thead_id}',
                feedback: '/feedback',
            }
        }
        
    }

    async getOpeyConfig(opeyConfig: OpeyConfig): Promise<OpeyConfig> {
        return opeyConfig || this.opeyConfig
    }

    async getOpeyStatus(opeyConfig: OpeyConfig): Promise<any> {
        // Endpoint to check if Opey is running
        const config = await this.getOpeyConfig(opeyConfig)
        const auth = await this.checkAuthConfig(config)
        if (!auth.valid) {
            console.warn(`AuthConfig not valid: ${auth.reason}`)
        }

        try {
            const url = `${config.baseUri}${config.paths.status}`
            const response = await fetch(url, {
                method: 'GET',
                headers: {}
            })
            if (response.status === 200) {
                const status = await response.json()
                return status
            } else {
                throw new Error(`Error getting status from Opey: ${response.status} ${response.statusText}`)
            }
            
            
            

        } catch (error) {
            throw new Error(`Error getting status from Opey: ${error}`)
        }
    }


    /**
     * Streams a response from Opey by posting a user input message.
     * 
     * This method sends the user input to Opey's streaming endpoint and returns
     * a ReadableStream for the client to consume token by token or message by message.
     * 
     * @param user_input - The user's input message and settings to send to Opey
     * @param opeyConfig - Configuration object for Opey connection
     *                     Contains details like baseUri, paths, and authentication settings
     * 
     * @returns A Promise resolving to a ReadableStream containing the streamed response
     * @throws Error if authentication is not valid
     * @throws Error if there's no response body
     * @throws Error if there's any issue streaming from Opey
     */
    async stream(user_input: UserInput, opeyConfig: OpeyConfig): Promise<any> {
        // Endpoint to post a message to Opey and stream the response tokens/messages
        const config = await this.getOpeyConfig(opeyConfig)

        // Check if we have the consent for Opey
        const auth = await this.checkAuthConfig(config)
        if (!auth.valid) {
            throw new Error(`AuthConfig not valid: ${auth.reason}`)
        }

        // Should check here if the consent status is 'ACCEPTED' before streaming

        
        try {

            const url = `${config.baseUri}${config.paths.stream}`
            // We need to set whether we want to stream tokens or not
            const stream_input = user_input as StreamInput
            stream_input.stream_tokens = true

            console.log(`Posting to Opey with streaming: ${JSON.stringify(stream_input)}\n URL: ${url}`) //DEBUG
            
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    "Authorization": `Bearer ${config.authConfig.opeyConsent.jwt}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(stream_input)
            })
            if (!response.body) {
                throw new Error("No response body")
            }

            console.log("Got response body: ", response.body) //DEBUG

            return response.body as unknown as ReadableStream<any>
        }
        catch (error) {
            throw new Error(`Error streaming from Opey: ${error}`)
        }
    }

    async invoke(user_input: UserInput): Promise<any> {
        // Endpoint to post a message to Opey and get a response without stream
        // I.e. a normal REST call
        const url = `${this.opeyConfig.baseUri}${this.opeyConfig.paths.invoke}`

        console.log(`Posting to Opey, STREAMING OFF: ${JSON.stringify(user_input)}\n URL: ${url}`) //DEBUG

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    "Authorization": `Bearer ${this.opeyConfig.authConfig.opeyJWT}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(user_input)
            })
            if (response.status === 200) {
                const opey_response = await response.json()
                return opey_response
            } else {
                throw new Error(`Error invoking Opey: ${response.status} ${response.statusText}`)
            }
        } catch (error) {
            throw new Error(`Error invoking Opey: ${error}`)
        }
    }


    async checkAuthConfig(opeyConfig: OpeyConfig): Promise<{ valid: boolean; reason: string }> {
        // Check if the authConfig is set in the OpeyConfig
        if (!opeyConfig.authConfig || !opeyConfig.authConfig.opeyConsent) {
            return { valid: false, reason: 'No authConfig set in opeyConfig, authentication required' }
        } else if (!opeyConfig.authConfig.opeyConsent) {
            return { valid: false, reason: 'Opey consent missing in opeyConfig.authConfig' }
        }

        if (!(opeyConfig.authConfig.opeyConsent.status === 'ACCEPTED')) {
            return { valid: false, reason: 'Opey consent status is not ACCEPTED' }
        }

        return { valid: true, reason: 'AuthConfig is valid' }
    }

    // async createConsentRequest(): Promise<ConsentRequestResponse | Error> {
    //     // Create a consent request for the current user


    //     const oauthConfig = session['clientConfig']

    //     try {
    //         this.obpClientService.create('/obp/v5.0.0/consumer/consent-requests', )
    //     } catch (error) {
    //         throw new Error(`Error creating consent request: ${error}`)
    //     }
    // }
}