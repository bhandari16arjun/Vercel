import express from 'express';
import cors from 'cors';
import { ECS } from 'aws-sdk';
import { Redis as UpstashRedis } from '@upstash/redis';
import { Server } from 'socket.io';
import http from 'http';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const PORT = process.env.PORT || 9000;

// Upstash REST client (Uses HTTPS, bypasses protocol blocks)
const restClient = new UpstashRedis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const ecs = new ECS({
    region: 'ap-south-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    httpOptions: {
        timeout: 10000,
        connectTimeout: 10000
    },
    maxRetries: 3
} as any);

const config = {
    CLUSTER: process.env.CLUSTER!,
    TASK_DEFINITION: process.env.TASK_DEFINITION!,
    SECURITY_GROUP: process.env.SECURITY_GROUP!,
    SUBNETS: process.env.SUBNETS ? process.env.SUBNETS.split(',') : []
};

app.post('/project', async (req: any, res: any) => {
    const { gitURL, slug, rootPrefix } = req.body;
    const projectSlug = (slug || `project-${Math.random().toString(36).substr(2, 9)}`).toLowerCase();

    const params: any = {
        cluster: config.CLUSTER,
        taskDefinition: config.TASK_DEFINITION,
        launchType: 'FARGATE',
        count: 1,
        networkConfiguration: {
            awsvpcConfiguration: {
                assignPublicIp: 'ENABLED',
                subnets: config.SUBNETS,
                securityGroups: [config.SECURITY_GROUP]
            }
        },
        overrides: {
            containerOverrides: [
                {
                    name: 'build-server-container',
                    environment: [
                        { name: 'GIT_REPOSITORY__URL', value: gitURL },
                        { name: 'PROJECT_ID', value: projectSlug },
                        { name: 'AWS_ACCESS_KEY_ID', value: process.env.AWS_ACCESS_KEY_ID },
                        { name: 'AWS_SECRET_ACCESS_KEY', value: process.env.AWS_SECRET_ACCESS_KEY },
                        { name: 'UPSTASH_REDIS_REST_URL', value: process.env.UPSTASH_REDIS_REST_URL },
                        { name: 'UPSTASH_REDIS_REST_TOKEN', value: process.env.UPSTASH_REDIS_REST_TOKEN },
                        { name: 'ROOT_PROJECT_DIR', value: rootPrefix || '' }
                    ]
                }
            ]
        }
    };

    try {
        await ecs.runTask(params).promise();
        return res.json({ status: 'queued', data: { projectSlug, url: `http://${projectSlug}.lvh.me:8000` } });
    } catch (error: any) {
        console.error('Error running ECS task:', error.message);
        return res.status(500).json({ error: 'Failed to queue deployment', details: error.message });
    }
});

io.on('connection', (socket: any) => {
    socket.on('subscribe', (channel: string) => {
        socket.join(channel);
        socket.emit('message', JSON.stringify({ log: `Joined ${channel}` }));
        
        let lastIndex = 0;
        const interval = setInterval(async () => {
            try {
                // Poll every 500ms for high speed
                // Fetch logs from lastIndex to the end of the list
                const logs: any[] = await restClient.lrange(channel, lastIndex, -1);
                
                if (logs && logs.length > 0) {
                    logs.forEach(log => {
                        const logStr = typeof log === 'string' ? log : JSON.stringify(log);
                        socket.emit('message', logStr);
                        
                        try {
                            const parsed = JSON.parse(logStr);
                            if (parsed.status === 'success' || parsed.status === 'error') {
                                console.log(`Stopping polling for ${channel} due to status: ${parsed.status}`);
                                clearInterval(interval);
                            }
                        } catch (e) {}
                    });
                    
                    lastIndex += logs.length;
                }
            } catch (err) {
                // Silently handle polling errors
            }
        }, 500); // 500ms for much faster updates

        socket.on('disconnect', () => clearInterval(interval));
    });
});

server.listen(PORT, () => console.log(`API Server Running on port ${PORT}`));
