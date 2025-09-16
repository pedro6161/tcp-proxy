const http = require('http');

const healthPort = process.env.HEALTH_PORT || 8080;

const req = http.request({
    hostname: 'localhost',
    port: healthPort,
    path: '/health',
    timeout: 2000
}, (res) => {
    if (res.statusCode === 200) {
        console.log('Health check passed');
        process.exit(0);
    } else {
        console.log(`Health check failed with status ${res.statusCode}`);
        process.exit(1);
    }
});

req.on('error', (err) => {
    console.log(`Health check failed: ${err.message}`);
    process.exit(1);
});

req.on('timeout', () => {
    console.log('Health check timeout');
    req.destroy();
    process.exit(1);
});

req.end();
