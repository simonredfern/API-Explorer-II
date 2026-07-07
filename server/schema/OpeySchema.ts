
export interface UserInput {
    message: string;
    thread_id?: string | null;
    is_tool_call_approval: boolean;
}

export interface StreamInput extends UserInput {
    stream_tokens: boolean;
}

export interface OpeyPaths {
    [key: string]: string;
}



export interface OBPConsent {
    consent_id: string;
    jwt: string;
    status: string;
}
export interface AuthConfig {
    obpConsent: OBPConsent;
    // Add more auth config fields here if needed
}

export interface OpeyConfig {
    baseUri: string,
    paths: OpeyPaths,
    authConfig?: AuthConfig,
    // Opey session cookie ("session=..."), established once via /create-session and
    // reused for subsequent /stream and /invoke calls in the same conversation.
    sessionCookie?: string,
}

export interface ConsentRequestResponse {
    consentId: string;
}