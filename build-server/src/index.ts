import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import { S3 } from 'aws-sdk';
import mime from 'mime-types';
import { Redis } from '@upstash/redis';
import dotenv from 'dotenv';

dotenv.config();

const publisher = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const s3 = new S3({
    region: 'ap-south-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

const PROJECT_ID = process.env.PROJECT_ID;

function publishLog(log: string) {
    console.log(`[LOG]: ${log}`);
    publisher.rpush(`logs:${PROJECT_ID}`, JSON.stringify({ log })).catch(err => {
        // console.error('Failed to publish log to Redis:', err.message);
    });
}

async function publishStatus(status: 'building' | 'success' | 'error') {
    await publisher.rpush(`logs:${PROJECT_ID}`, JSON.stringify({ status })).catch(err => {
        // console.error('Failed to publish status to Redis:', err.message);
    });
}

async function init() {
    console.log('Build Server Started...');
    await publishStatus('building');
    publishLog('Build Server Started...');

    const outDirPath = path.join(__dirname, 'output');

    if (fs.existsSync(outDirPath)) {
        fs.rmSync(outDirPath, { recursive: true, force: true });
    }
    fs.mkdirSync(outDirPath);

    console.log(`Cloning repository: ${process.env.GIT_REPOSITORY__URL}`);
    publishLog(`Cloning repository: ${process.env.GIT_REPOSITORY__URL}`);

    const p = exec(`git clone ${process.env.GIT_REPOSITORY__URL} ${outDirPath}`);

    p.stdout?.on('data', function (data) {
        const log = data.toString();
        console.log(log);
        publishLog(log);
    });

    p.stderr?.on('data', function (data) {
        const log = data.toString();
        console.error(log);
        publishLog(`error: ${log}`);
    });

    p.on('close', async function () {
        console.log('Build Started...');
        publishLog('Build Started...');

        // Remove package-lock.json to avoid platform-specific issues
        const lockFilePath = path.join(outDirPath, 'package-lock.json');
        if (fs.existsSync(lockFilePath)) {
            fs.unlinkSync(lockFilePath);
        }

        const rootDir = process.env.ROOT_PROJECT_DIR ? path.join(outDirPath, process.env.ROOT_PROJECT_DIR) : outDirPath;
        console.log(`Working directory for build: ${rootDir}`);
        publishLog(`Working directory for build: ${process.env.ROOT_PROJECT_DIR || 'root'}`);

        const buildProcess = exec(`cd ${rootDir} && npm install && npm run build`, {
            env: { ...process.env, NODE_OPTIONS: "--max-old-space-size=1600" }
        });

        buildProcess.stdout?.on('data', function (data) {
            const log = data.toString();
            console.log(log);
            publishLog(log);
        });

        buildProcess.stderr?.on('data', function (data) {
            const log = data.toString();
            console.error(log);
            publishLog(`error: ${log}`);
        });

        buildProcess.on('close', async function (code) {
            if (code !== 0) {
                const errorMsg = `Error: Build failed with exit code ${code}. Check logs for memory/other errors.`;
                console.error(errorMsg);
                publishLog(`error: ${errorMsg}`);
                await publishStatus('error');
                setTimeout(() => process.exit(1), 1000);
                return;
            }

            console.log('Build Complete');
            publishLog('Build Complete');

            // --- IMPROVED: Auto-detect output directory ---
            const possibleDirs = ['dist', 'build', '.next', 'out', 'public'];
            let distPath = '';
            
            for (const dir of possibleDirs) {
                const p = path.join(rootDir, dir);
                console.log(`Checking for output directory at: ${p}`);
                if (fs.existsSync(p)) {
                    distPath = p;
                    break;
                }
            }

            if (!distPath) {
                const errorMsg = `Error: No build output folder (dist, build, .next, etc.) found in ${rootDir}`;
                console.error(errorMsg);
                publishLog(`error: ${errorMsg}`);
                await publishStatus('error');
                setTimeout(() => process.exit(1), 1000);
                return;
            }

            console.log(`Using output directory: ${distPath}`);
            publishLog(`Using output directory: ${path.basename(distPath)}`);

            const distFiles = fs.readdirSync(distPath, { recursive: true });

            // --- IMPROVED: Parallel S3 Uploads ---
            const uploadPromises = distFiles.map(async (file) => {
                const filePath = path.join(distPath, file.toString());
                if (fs.lstatSync(filePath).isDirectory()) return;

                const key = `__outputs/${PROJECT_ID}/${file.toString().replace(/\\/g, '/')}`;

                const params = {
                    Bucket: 'vercel-clone-outputs-12042026',
                    Key: key,
                    Body: fs.createReadStream(filePath),
                    ContentType: mime.lookup(filePath) || 'application/octet-stream'
                };

                try {
                    await s3.putObject(params).promise();
                    console.log('Uploaded', filePath);
                    publishLog(`Uploaded ${file}`);
                } catch (err: any) {
                    console.error('Error uploading', filePath, err);
                    publishLog(`error: Error uploading ${file}: ${err.message}`);
                }
            });

            await Promise.all(uploadPromises);

            console.log('All Files Uploaded. Deployment Complete!');
            publishLog('All Files Uploaded. Deployment Complete!');
            await publishStatus('success');
            
            // Wait for REST calls to finish before exiting container
            setTimeout(() => process.exit(0), 1500);
        });
    });
}

init();
