const { S3 } = require('aws-sdk');
require('dotenv').config({ path: './build-server/.env' });

const s3 = new S3({
    region: 'ap-south-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

async function checkS3() {
    try {
        const data = await s3.listObjectsV2({
            Bucket: 'vercel-clone-outputs-12042026',
            Prefix: '__outputs/test-deployment-01/'
        }).promise();
        
        console.log('--- S3 Bucket Contents for test-deployment-01 ---');
        if (!data.Contents || data.Contents.length === 0) {
            console.log('No files found!');
        } else {
            data.Contents.forEach(obj => console.log(obj.Key));
        }
    } catch (err) {
        console.error('Error connecting to S3:', err.message);
    }
}

checkS3();
