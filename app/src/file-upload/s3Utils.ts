import { randomUUID } from 'crypto';
import { S3Client } from '@aws-sdk/client-s3';
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3Client = new S3Client({
  region: process.env.AWS_S3_REGION,
  credentials: {
    accessKeyId: process.env.AWS_S3_IAM_ACCESS_KEY!,
    secretAccessKey: process.env.AWS_S3_IAM_SECRET_KEY!,
  },
});

type S3Upload = {
  fileName: string;
  fileType: string;
  userInfo: string;
}

export const getUploadFileSignedURLFromS3 = async ({ fileName, fileType, userInfo}: S3Upload) => {
  const Key = `${userInfo}/${fileName}.${fileType}`;
  const s3Params = {
    Bucket: process.env.AWS_S3_FILES_BUCKET,
    Key,
    ContentType: `image/${fileType}`,
  };
  const command = new PutObjectCommand(s3Params);
  const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600,});
  return { uploadUrl, key: Key };
}

export const getDownloadFileSignedURLFromS3 = async ({ key }: { key: string }) => {
  const s3Params = {
    Bucket: process.env.AWS_S3_FILES_BUCKET,
    Key: key,
  };
  const command = new GetObjectCommand(s3Params);
  return await getSignedUrl(s3Client, command, { expiresIn: 3600 });
}