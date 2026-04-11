import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import { S3 } from 'aws-sdk';
import mime from 'mime-types';
import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const publisher = new Redis(process.env.REDIS_URL || '');

const s3 = new S3({
    region: 'ap-south-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

const PROJECT_ID = process.env.PROJECT_ID;

function publishLog(log: string) {
    publisher.publish(`logs:${PROJECT_ID}`, JSON.stringify({ log }));
}

async function init() {
    console.log('Build Server Started...');
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

        const buildProcess = exec(`cd ${outDirPath} && npm install && npm run build`);

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

        buildProcess.on('close', async function () {
            console.log('Build Complete');
            publishLog('Build Complete');

            const distPath = path.join(outDirPath, 'dist');
            if (!fs.existsSync(distPath)) {
                const errorMsg = 'Error: dist folder not found after build.';
                console.error(errorMsg);
                publishLog(`error: ${errorMsg}`);
                return;
            }

            const distFiles = fs.readdirSync(distPath, { recursive: true });

            for (const file of distFiles) {
                const filePath = path.join(distPath, file.toString());
                if (fs.lstatSync(filePath).isDirectory()) continue;

                console.log('Uploading', filePath);
                publishLog(`Uploading ${file}`);

                const params = {
                    Bucket: 'vercel-clone-outputs-12042026',
                    Key: `__outputs/${PROJECT_ID}/${file.toString()}`,
                    Body: fs.createReadStream(filePath),
                    ContentType: mime.lookup(filePath) || 'application/octet-stream'
                };

                try {
                    await s3.putObject(params).promise();
                    console.log('Uploaded', filePath);
                } catch (err) {
                    console.error('Error uploading', filePath, err);
                    publishLog(`error: Error uploading ${file}`);
                }
            }
            console.log('All Files Uploaded. Deployment Complete!');
            publishLog('All Files Uploaded. Deployment Complete!');
            process.exit(0);
        });
    });
}

init();
