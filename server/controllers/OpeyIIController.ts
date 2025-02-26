import { Controller, Session, Req, Res, Post, Get } from 'routing-controllers'
import { Request, Response } from 'express'
import { Transform, pipeline } from "node:stream"
import { Service } from 'typedi'
import OBPClientService from '../services/OBPClientService'
import OpeyClientService from '../services/OpeyClientService'
import { LangChainAdapter, streamText } from 'ai';

import { UserInput } from '../schema/OpeySchema'
import { strictEqual } from 'node:assert'

@Service()
@Controller('/opey')

export class OpeyController {
    constructor(
      public obpClientService: OBPClientService,
      public opeyClientService: OpeyClientService,
    ) {}

    @Get('/')
    async getStatus(
        @Res() response: Response
    ): Promise<Response | any> {

        try {
          const opeyStatus = await this.opeyClientService.getOpeyStatus()
          console.log("Opey status: ", opeyStatus)
          return response.status(200).json({status: 'Opey is running'});

        } catch (error) {
          console.error("Error in /opey endpoint: ", error);
          return response.status(500).json({ error: 'Internal Server Error' });
        }

        
    }

    @Post('/stream')

    async streamOpey(
        @Session() session: any,
        @Req() request: Request,
        @Res() response: Response,
    ) {

        let user_input: UserInput
        try {
          console.log("Request body: ", request.body)
          const user_message = request.body.messages[request.body.messages.length - 1]
          user_input = {
            "message": user_message.content,
            "thread_id": request.body.thread_id,
            "is_tool_call_approval": request.body.is_tool_call_approval
          }
        } catch (error) {
          console.error("Error in stream endpoint, could not parse into UserInput: ", error)
          return response.status(500).json({ error: 'Internal Server Error' })
        }
        
        

        // Define a function to transform the response from Opey into a pure langchain stream format
        const transformToPureLangchain = new TransformStream({
          transform(chunk, controller) {
            // Decode the chunk to a string
            const decodedChunk = new TextDecoder().decode(chunk)
            console.log('[transform]', decodedChunk);
            const dataString = decodedChunk.split('data: ')[1]
            controller.enqueue(dataString);
          },
          flush(controller) {
            console.log('[flush]');
            controller.terminate();
          },
        });

        let stream: ReadableStream | null = null
        
        try {
          // Read stream from OpeyClientService
          console.log("Calling OpeyClientService.stream")
          stream = await this.opeyClientService.stream(user_input)
          //console.debug(`Stream received readable: ${stream?.readable}`)
          
        } catch (error) {
          console.error("Error reading stream: ", error)
          return response.status(500).json({ error: 'Internal Server Error' })
        }

        if (!stream) {
          console.error("Stream is not recieved or not readable")
          return response.status(500).json({ error: 'Internal Server Error' })
        }

        return new Promise<Response>((resolve, reject) => {
          // pipeline(stream, convertToVercelTansform, response, (error) => {
          //   if (error) {
          //     console.error("Error piping stream: ", error)
          //     reject(error)
          //   } else {
          //     console.log("Stream piped successfully")
          //     resolve(response)
          //   }
          // })
          const streamTee = stream.tee()
          if (!streamTee) {
            console.error("Stream is not tee'd")
            return response.status(500).json({ error: 'Internal Server Error' })
          }
          const [stream1, stream2] = streamTee

          const reader = stream1.getReader()
          let charsReceived = 0;
          const decoder = new TextDecoder();

          // this is simply to log the stream to console
          reader.read().then(function processText({ done, value }) {
            // Result objects contain two properties:
            // done  - true if the stream has already given you all its data.
            // value - some data. Always undefined when done is true.
            if (done) {
              console.log("Stream complete");
              return;
            }
        
            // value for fetch streams is a Uint8Array
            charsReceived += value.length;
            const chunk = value;
            console.log("Chunk: ", decoder.decode(chunk), "\n\nChars received: ", charsReceived);

            return reader.read().then(processText);
          })

          try {
            const vercelDataStream = LangChainAdapter.toDataStream(stream2)
            resolve(vercelDataStream)
          } catch (error) {
            reject(error)
          }
          
          
          
          // stream.on('end', () => {
          //   response.status(200)
          //   resolve(response)
          // })
          // stream.on('error', (error) => {
          //   console.error("Error piping stream: ", error)
          //   reject(error)
          // })
          
        })

        
    }

    @Post('/invoke')
    async invokeOpey(
        @Session() session: any,
        @Req() request: Request,
        @Res() response: Response
    ): Promise<Response | any> {

        let user_input: UserInput
        try {
          user_input = {
            "message": request.body.message,
            "thread_id": request.body.thread_id,
            "is_tool_call_approval": request.body.is_tool_call_approval
          }
        } catch (error) {
          console.error("Error in invoke endpoint, could not parse into UserInput: ", error)
          return response.status(500).json({ error: 'Internal Server Error' })
        }

        try {
          const opey_response = await this.opeyClientService.invoke(user_input)

          //console.log("Opey response: ", opey_response)
          return response.status(200).json(opey_response)
        } catch (error) {
          console.error(error)
          return response.status(500).json({ error: 'Internal Server Error' })
        }
    }

    @Post('/consent')
    /**
    * Retrieves a consent from OBP for the current user
    */
    async getConsent(
        @Session() session: any,
        @Req() request: Request,
        @Res() response: Response
    ): Promise<Response | any> {
        try {
        console.log("Getting consent from OBP")
        // Check if consent is already in session
        if (session['obpConsent']) {
            console.log("Consent found in session, returning cached consent ID")
            const obpConsent = session['obpConsent']
            // NOTE: Arguably we should not return the consent to the frontend as it could be hijacked,
            // we can keep everything in the backend and only return the JWT token
            return response.status(200).json({consent_id: obpConsent.consent_id});
        }

        const oauthConfig = session['clientConfig']
        const version = this.obpClientService.getOBPVersion()
        // Obbiously this should not be hard-coded, especially the consumer_id, but for now it is
        const consentRequestBody = {
            "everything": false,
            "views": [],
            "entitlements": [],
            "consumer_id": "33e0a1bd-9f1d-4128-911b-8936110f802f"
        }

        // Get current user, only proceed if user is logged in
        const currentUser = await this.obpClientService.get(`/obp/${version}/users/current`, oauthConfig)
        const currentResponseKeys = Object.keys(currentUser)
        if (!currentResponseKeys.includes('user_id')) {
            return response.status(400).json({ message: 'User not logged in, Authentication required' });
        }

        // url needs to be changed once we get the 'bankless' consent endpoint
        // this creates a consent for the current logged in user, and starts SCA flow i.e. sends SMS or email OTP to user
        const consent = await this.obpClientService.create(`/obp/${version}/banks/gh.29.uk/my/consents/IMPLICIT`, consentRequestBody, oauthConfig)
        console.log("Consent: ", consent)

        // store consent in session, return consent 200 OK
        session['obpConsent'] = consent
        return response.status(200).json({consent_id: consent.consent_id});
        } catch (error) {
        console.error("Error in consent endpoint: ", error);
        return response.status(500).json({ error: 'Internal Server Error '});
        }
    }


    @Post('/consent/answer-challenge')
    /**
     * Endpoint to answer the consent challenge with code i.e. SMS or email OTP for SCA
     * If successful, returns a Consent-JWT for use by Opey to access endpoints/ roles that the consenting user has
     * This completes (i.e. is the final step in) the consent flow
     */
    async answerConsentChallenge(
      @Session() session: any,
      @Req() request: Request,
      @Res() response: Response
    ): Promise<Response | any> {
      try {
        const oauthConfig = session['clientConfig']
        const version = this.obpClientService.getOBPVersion()
  
        const obpConsent = session['obpConsent']
        if (!obpConsent) {
          return response.status(400).json({ message: 'Consent not found in session' });
        } else if (obpConsent.status === 'ACCEPTED') {
          return response.status(400).json({ message: 'Consent already accepted' });
        }
        const answerBody = request.body
  
        const consentJWT = await this.obpClientService.create(`/obp/${version}/banks/gh.29.uk/consents/${obpConsent.consent_id}/challenge`, answerBody, oauthConfig)
        console.log("Consent JWT: ", consentJWT)
        // store consent JWT in session, return consent JWT 200 OK
        session['obpConsentJWT'] = consentJWT
        return response.status(200).json(true);
  
      } catch (error) { 
        console.error("Error in consent/answer-challenge endpoint: ", error);
        return response.status(500).json({ error: 'Internal Server Error' });
      }
      
    }

    
}