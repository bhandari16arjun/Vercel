const { S3 } = require('aws-sdk');
require('dotenv').config({ path: './build-server/.env' });

const s3 = new S3({
    region: 'ap-south-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

async function testS3() {
    try {
        console.log('Testing S3 connection...');
        const data = await s3.listBuckets().promise();
        console.log('S3 Connection Successful. Available Buckets:', data.Buckets.map(b => b.Name));
        
        const bucketName = 'vercel-clone-outputs-12042026';
        const exists = data.Buckets.some(b => b.Name === bucketName);
        if (!exists) {
            console.error(`Error: Bucket ${bucketName} not found!`);
        } else {
            console.log(`Success: Bucket ${bucketName} is available.`);
        }
    } catch (err) {
        console.error('Error connecting to S3:', err.message);
    }
}

testS3();
