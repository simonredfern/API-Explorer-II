import { getExpressServer } from './server-manager'

async function globalTeardown() {

    console.log('Tearing down global setup...')

    const expressServer = getExpressServer()
    // Kill the express server
    if (expressServer) {
        expressServer.kill('SIGTERM')
        console.log('Express server killed')
    }
}

export default globalTeardown