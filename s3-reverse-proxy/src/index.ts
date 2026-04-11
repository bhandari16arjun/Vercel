import express from 'express';
import httpProxy from 'http-proxy';

const app = express();
const PORT = 8000;

// Base S3 Bucket URL (Adjust region/bucket name if needed)
const BASE_PATH = 'https://vercel-clone-outputs-12042026.s3.ap-south-1.amazonaws.com/__outputs';

const proxy = httpProxy.createProxyServer();

app.use((req, res) => {
    const hostname = req.hostname;
    const subdomain = hostname.split('.')[0];

    // Map project-id.localhost to S3 path: __outputs/<project-id>/
    const target = `${BASE_PATH}/${subdomain}`;

    console.log(`Proxying request for ${hostname} to ${target}${req.url}`);

    return proxy.web(req, res, { target, changeOrigin: true });
});

// Proxy error handling
proxy.on('error', (err, req, res) => {
    if ('writeHead' in res) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Proxy Error');
    }
});

proxy.on('proxyReq', (proxyReq, req, res) => {
    const url = req.url;
    if (url === '/') {
        proxyReq.path += 'index.html';
    }
});

app.listen(PORT, () => {
    console.log(`S3 Reverse Proxy Running on port ${PORT}`);
});
