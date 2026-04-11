import express from 'express';
import { ECS } from 'aws-sdk';
import Redis from 'ioredis';
import { Server } from 'socket.io';
import http from 'http';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const PORT = process.env.PORT || 9000;

const subscriber = new Redis(process.env.REDIS_URL || '');

const ecs = new ECS({
    region: 'ap-south-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
} as any);

const config = {
    CLUSTER: process.env.CLUSTER,
    TASK_DEFINITION: process.env.TASK_DEFINITION,
    SECURITY_GROUP: process.env.SECURITY_GROUP,
    SUBNETS: process.env.SUBNETS ? process.env.SUBNETS.split(',') : []
};

app.use(express.json());

app.post('/project', async (req: any, res: any) => {
    const { gitURL, slug } = req.body;
    const projectSlug = slug || `project-${Math.random().toString(36).substr(2, 9)}`;

    // Spin up the ECS Container
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
                        { name: 'REDIS_URL', value: process.env.REDIS_URL }
                    ]
                }
            ]
        }
    };

    try {
        await ecs.runTask(params).promise();
        return res.json({ status: 'queued', data: { projectSlug, url: `http://${projectSlug}.localhost:8000` } });
    } catch (error) {
        console.error('Error running ECS task:', error);
        return res.status(500).json({ error: 'Failed to queue deployment' });
    }
});

async function initRedisSubscribe() {
    console.log('Subscribed to logs...');
    subscriber.psubscribe('logs:*');
    subscriber.on('pmessage', (pattern: string, channel: string, message: string) => {
        io.to(channel).emit('message', message);
    });
}

initRedisSubscribe();

io.on('connection', (socket: any) => {
    socket.on('subscribe', (channel: string) => {
        socket.join(channel);
        socket.emit('message', JSON.stringify({ log: `Joined ${channel}` }));
    });
});

server.listen(PORT, () => console.log(`API Server Running on port ${PORT}`));
