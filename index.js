const net = require('net');
const http = require('http');
const cluster = require('cluster');
const numCPUs = require('os').cpus().length;

// Configuration
const LISTEN_PORT = process.env.LISTEN_PORT || 443;
const HEALTH_PORT = process.env.HEALTH_PORT || 8080;
const ORIGIN_HOST = process.env.ORIGIN_HOST || 'mt4.abc.com';
const ORIGIN_PORT = process.env.ORIGIN_PORT || 15743;
const MAX_CONNECTIONS = process.env.MAX_CONNECTIONS || 1000;

console.log(`MT4 TCP Proxy starting...`);
console.log(`TCP Proxy: *:${LISTEN_PORT} → ${ORIGIN_HOST}:${ORIGIN_PORT}`);
console.log(`Health Check: *:${HEALTH_PORT}/health`);

if (cluster.isMaster && numCPUs > 1) {
    // Fork workers for better performance
    for (let i = 0; i < Math.min(numCPUs, 4); i++) {
        cluster.fork();
    }
    
    cluster.on('exit', (worker) => {
        console.log(`Worker ${worker.process.pid} died, restarting...`);
        cluster.fork();
    });
} else {
    createProxyServer();
    createHealthServer();
}

function createHealthServer() {
    const healthServer = http.createServer((req, res) => {
        if (req.url === '/health') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
                status: 'healthy',
                timestamp: new Date().toISOString(),
                origin: `${ORIGIN_HOST}:${ORIGIN_PORT}`,
                worker: process.pid
            }));
        } else {
            res.writeHead(404);
            res.end('Not Found');
        }
    });
    
    healthServer.listen(HEALTH_PORT, () => {
        console.log(`Health server listening on port ${HEALTH_PORT}`);
    });
}

function createProxyServer() {
    let activeConnections = 0;
    
    const server = net.createServer((clientSocket) => {
        if (activeConnections >= MAX_CONNECTIONS) {
            console.log('Max connections reached, rejecting new connection');
            clientSocket.end();
            return;
        }
        
        activeConnections++;
        const clientId = `${clientSocket.remoteAddress}:${clientSocket.remotePort}`;
        console.log(`New MT4 connection from ${clientId} (Active: ${activeConnections})`);
        
        // Create connection to MT4 origin server
        const originSocket = net.createConnection({
            host: ORIGIN_HOST,
            port: parseInt(ORIGIN_PORT),
            timeout: 10000
        });
        
        // Connection timeout handler
        const timeoutHandler = setTimeout(() => {
            console.log(`Origin connection timeout for ${clientId}`);
            originSocket.destroy();
            clientSocket.destroy();
        }, 10000);
        
        originSocket.on('connect', () => {
            clearTimeout(timeoutHandler);
            console.log(`Connected ${clientId} to origin ${ORIGIN_HOST}:${ORIGIN_PORT}`);
            
            // Pipe data bidirectionally for MT4 protocol
            clientSocket.pipe(originSocket, { end: false });
            originSocket.pipe(clientSocket, { end: false });
        });
        
        // Error handling and cleanup
        const cleanup = () => {
            activeConnections--;
            clearTimeout(timeoutHandler);
            if (!originSocket.destroyed) originSocket.destroy();
            if (!clientSocket.destroyed) clientSocket.destroy();
        };
        
        clientSocket.on('error', (err) => {
            console.log(`Client ${clientId} error: ${err.message}`);
            cleanup();
        });
        
        originSocket.on('error', (err) => {
            console.log(`Origin error for ${clientId}: ${err.message}`);
            cleanup();
        });
        
        clientSocket.on('close', () => {
            console.log(`Client ${clientId} disconnected (Active: ${activeConnections - 1})`);
            cleanup();
        });
        
        originSocket.on('close', () => {
            console.log(`Origin closed for ${clientId}`);
            cleanup();
        });
        
        // Optimize for MT4 trading
        clientSocket.setKeepAlive(true, 60000);  // Keep connections alive
        clientSocket.setNoDelay(true);           // Disable Nagle's algorithm for low latency
        originSocket.setKeepAlive(true, 60000);
        originSocket.setNoDelay(true);
    });
    
    // Server error handling
    server.on('error', (err) => {
        console.error(`TCP Proxy server error: ${err.message}`);
    });
    
    server.listen(LISTEN_PORT, '0.0.0.0', () => {
        console.log(`MT4 TCP Proxy listening on port ${LISTEN_PORT}`);
        console.log(`Worker PID: ${process.pid}`);
    });
    
    // Graceful shutdown for container orchestration
    process.on('SIGTERM', () => {
        console.log('Received SIGTERM, shutting down gracefully...');
        server.close(() => {
            process.exit(0);
        });
    });
}
