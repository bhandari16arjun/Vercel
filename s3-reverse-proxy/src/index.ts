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

    // The target should just be the S3 host. We will rewrite the path in proxyReq.
    const target = 'https://vercel-clone-outputs-12042026.s3.ap-south-1.amazonaws.com';

    console.log(`Proxying request for ${hostname} to ${target}/__outputs/${subdomain}${req.url}`);

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
    const hostname = req.headers.host || '';
    const subdomain = hostname.split('.')[0];
    
    // Manually rewrite the path to include the bucket prefix
    let newPath = `/__outputs/${subdomain}${proxyReq.path}`;
    
    // If the path is empty or just '/', serve index.html
    if (proxyReq.path === '/' || proxyReq.path === '') {
        newPath = `/__outputs/${subdomain}/index.html`;
    }
    
    proxyReq.path = newPath;
});

app.listen(PORT, () => {
    console.log(`S3 Reverse Proxy Running on port ${PORT}`);
});
