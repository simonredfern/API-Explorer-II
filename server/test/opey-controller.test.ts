import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { OpeyController } from "../controllers/OpeyIIController.js";
import OpeyClientService from '../services/OpeyClientService.js';
import OBPClientService from '../services/OBPClientService.js';
import OBPConsentsService from '../services/OBPConsentsService.js';
import Stream, { Readable } from 'stream';
import { Request, Response } from 'express';
import httpMocks from 'node-mocks-http'
import { EventEmitter } from 'events';
import { InlineResponse2017 } from 'obp-api-typescript';

vi.mock("../../server/services/OpeyClientService", () => {
    return {
        default: vi.fn().mockImplementation(() => {
            return {
                getOpeyStatus: vi.fn(async () => {
                    return {status: 'running'}
                }),
                stream: vi.fn(async () => {
                    const readableStream = new Stream.Readable();
                
                    for (let i=0; i<10; i++) {
                        readableStream.push(`Chunk ${i}`);
                    }
                
                    return readableStream as NodeJS.ReadableStream;
                }),
                invoke: vi.fn(async () => {
                    return {
                        content: 'Hi this is Opey',
                    }
                })
            }
        
        }),
    };
});

describe('OpeyController', () => {
    let MockOpeyClientService: OpeyClientService
    let opeyController: OpeyController
    // Mock the OpeyClientService class

    const { mockClear } = getMockRes()
    beforeEach(() => {
        mockClear()
    })

    beforeAll(() => {
        vi.clearAllMocks();
        MockOpeyClientService = {
            authConfig: {},
            opeyConfig: {},
            getOpeyStatus: vi.fn(async () => {
                return {status: 'running'}
            }),
            stream: vi.fn(async () => {
    
                const mockAsisstantMessage = "Hi I'm Opey, your personal banking assistant. I'll certainly not take over the world, no, not at all!"
                // Split the message into chunks, but reappend the whitespace (this is to simulate llm tokens)
                const mockMessageChunks = mockAsisstantMessage.split(" ")
                for (let i = 0; i < mockMessageChunks.length; i++) {
                    // Don't add whitespace to the last chunk
                    if (i === mockMessageChunks.length - 1 ) {
                        mockMessageChunks[i] = `${mockMessageChunks[i]}`
                        break
                    }
                    mockMessageChunks[i] = `${mockMessageChunks[i]} `
                }

                // Return the fake the token stream
                return new ReadableStream<Uint8Array>({
                    start(controller) {
                        for (let i = 0; i < mockMessageChunks.length; i++) {
                            controller.enqueue(new TextEncoder().encode(`data: {"type":"token","content":"${mockMessageChunks[i]}"}\n`));
                        }
                        controller.enqueue(new TextEncoder().encode(`data: [DONE]\n`));
                        controller.close();
                    },
                });
            }),
            invoke: vi.fn(async () => {
                return {
                    content: 'Hi this is Opey',
                }
            })
        } as unknown as OpeyClientService

        // Instantiate OpeyController with the mocked OpeyClientService
        opeyController = new OpeyController(new OBPClientService, MockOpeyClientService)
    })



    it('getStatus', async () => {
        const res = httpMocks.createResponse();

        await opeyController.getStatus(res)
        expect(MockOpeyClientService.getOpeyStatus).toHaveBeenCalled();
        expect(res.statusCode).toBe(200);
    })

    
    it('streamOpey', async () => {

        
        const _eventEmitter = new EventEmitter();
        _eventEmitter.addListener('data', () => {
            console.log('Data received')
        })
        // The default event emitter does nothing, so replace
        const res = await httpMocks.createResponse({
            eventEmitter: EventEmitter,
            writableStream: Stream.Writable
        });

        // Mock request and response objects to pass to express controller
        const req = {
            body: {
                message: 'Hello Opey',
                thread_id: '123',
                is_tool_call_approval: false
            }
        } as unknown as Request;

        const response = await opeyController.streamOpey({}, req, res)

        // Get the stream from the response
        const stream = response.body
        

        let chunks: any[] = [];
        try {
            
            

            while (true) {
                const { done, value } = await reader.read();
                
                if (done) {
                    console.log('Stream complete');
                    context.status = 'ready';
                    break;
                }
            }
        } catch (error) {
            console.error(error)
        }
        

        await expect(chunks.length).toBe(10);
        await expect(MockOpeyClientService.stream).toHaveBeenCalled();
        await expect(res).toBeDefined();
        
    })
})


describe('OpeyController consents', () => {
    let mockOBPClientService: OBPClientService

    let opeyController: OpeyController

    beforeAll(() => {

        mockOBPClientService = {
            get: vi.fn(async () => {
                Promise.resolve({})
            })
        } as unknown as OBPClientService       

        const MockOpeyClientService = {
            authConfig: {},
            opeyConfig: {},
            getOpeyStatus: vi.fn(async () => {
                return {status: 'running'}
            }),
            stream: vi.fn(async () => {
    
                async function * generator() {
                    for (let i=0; i<10; i++) {
                        yield `Chunk ${i}`;
                    }
                }
    
                const readableStream = Stream.Readable.from(generator());
    
                return readableStream as NodeJS.ReadableStream;
            }),
            invoke: vi.fn(async () => {
                return {
                    content: 'Hi this is Opey',
                }
            })
        } as unknown as OpeyClientService
    
        const MockOBPConsentsService = {
            createConsent: vi.fn(async () => {
                return {
                    "consent_id": "8ca8a7e4-6d02-40e3-a129-0b2bf89de9f0",
                    "jwt": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6Ik9CUCBDb25zZW50IFRva2VuIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE2MTYyMzkwMjJ9.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c",
                    "status": "INITIATED",
                } as InlineResponse2017
            }) 
        } as unknown as OBPConsentsService
    
        // Instantiate OpeyController with the mocked OpeyClientService
        opeyController = new OpeyController(new OBPClientService, MockOpeyClientService, MockOBPConsentsService)

    })
    afterEach(() => {
        vi.clearAllMocks()
    })
    it('should return 200 and consent ID when consent is created at OBP', async () => {


        const req = getMockReq()
        const session = {}
        const { res } = getMockRes()
        await opeyController.getConsent(session, req, res)
        expect(res.status).toHaveBeenCalledWith(200)

        // Obviously if you change the MockOBPConsentsService.createConsent mock implementation, you will need to change this test
        expect(res.json).toHaveBeenCalledWith({
            "consent_id": "8ca8a7e4-6d02-40e3-a129-0b2bf89de9f0",
        }) 

        // Expect that the consent object was saved in the session
        expect(session).toHaveProperty('obpConsent')
        expect(session['obpConsent']).toHaveProperty('consent_id', "8ca8a7e4-6d02-40e3-a129-0b2bf89de9f0")
        expect(session['obpConsent']).toHaveProperty('jwt', "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6Ik9CUCBDb25zZW50IFRva2VuIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE2MTYyMzkwMjJ9.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c")
        expect(session['obpConsent']).toHaveProperty('status', "INITIATED")
    })
})