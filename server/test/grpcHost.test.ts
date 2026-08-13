import { describe, it, expect } from 'vitest'
import { resolveGrpcHost, defaultGrpcHost } from '../utils/grpcHost'

describe('resolveGrpcHost', () => {
  it('prefers VITE_OBP_GRPC_HOST when set', () => {
    expect(
      resolveGrpcHost({
        VITE_OBP_GRPC_HOST: 'grpc.example.com:9999',
        VITE_OBP_API_HOST: 'https://api.example.com'
      })
    ).toBe('grpc.example.com:9999')
  })

  it('derives grpc.<host> from VITE_OBP_API_HOST when VITE_OBP_GRPC_HOST is unset', () => {
    expect(resolveGrpcHost({ VITE_OBP_API_HOST: 'https://api.example.com' })).toBe(
      'grpc.api.example.com:50051'
    )
  })

  it('falls back to localhost when neither is set', () => {
    expect(resolveGrpcHost({})).toBe('localhost:50051')
  })
})

describe('defaultGrpcHost', () => {
  it('prefixes grpc. onto the OBP-API hostname with the standard gRPC port', () => {
    expect(defaultGrpcHost('https://api.example.com')).toBe('grpc.api.example.com:50051')
  })

  it('drops the REST port from the base URL', () => {
    expect(defaultGrpcHost('http://obp.internal:8080')).toBe('grpc.obp.internal:50051')
  })

  it('does not prefix grpc. onto localhost or IP literals', () => {
    expect(defaultGrpcHost('http://localhost:8080')).toBe('localhost:50051')
    expect(defaultGrpcHost('http://obp.localhost:8080')).toBe('obp.localhost:50051')
    expect(defaultGrpcHost('http://127.0.0.1:8080')).toBe('127.0.0.1:50051')
    expect(defaultGrpcHost('http://[::1]:8080')).toBe('[::1]:50051')
  })

  it('falls back to localhost when the base URL is unset or unparseable', () => {
    expect(defaultGrpcHost(undefined)).toBe('localhost:50051')
    expect(defaultGrpcHost('')).toBe('localhost:50051')
    expect(defaultGrpcHost('not a url')).toBe('localhost:50051')
  })
})
