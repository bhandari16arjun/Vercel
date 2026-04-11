import express from 'express';
import httpProxy from 'http-proxy';

const app = express();
const PORT = 8001; // Using a different port for testing

const BASE_PATH = 'https://vercel-clone-outputs-12042026.s3.ap-south-1.amazonaws.com/__outputs';
const proxy = httpProxy.createProxyServer();

app.use((req, res) => {
    const hostname = req.hostname;
    const subdomain = hostname.split('.')[0];
    const target = `${BASE_PATH}/${subdomain}`;

    // For testing: we'll return the target URL in a custom header to verify the mapping
    res.setHeader('X-Resolved-Target', target);
    
    console.log(`[TEST] Host: ${hostname} -> Target: ${target}`);
    
    return proxy.web(req, res, { target, changeOrigin: true });
});

proxy.on('error', (err, req, res) => {
    // If S3 returns 403/404, the proxy still technically "worked" in its routing logic
    if ('writeHead' in res) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Proxy reached S3 (as expected for this test). Check headers for resolution.');
    }
});

app.listen(PORT, () => {
    console.log(`Test Proxy Server running on port ${PORT}`);
});
