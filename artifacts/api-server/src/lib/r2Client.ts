import { S3Client } from "@aws-sdk/client-s3";

let s3ClientInstance: S3Client | null = null;

export function getR2Client(): S3Client {
  if (!s3ClientInstance) {
    const endpoint = process.env.R2_ENDPOINT;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

    if (!endpoint || !accessKeyId || !secretAccessKey) {
      throw new Error("R2 environment variables are missing (R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY)");
    }

    s3ClientInstance = new S3Client({
      region: "auto",
      endpoint,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }
  return s3ClientInstance;
}

export function getR2Bucket(): string {
  const bucket = process.env.R2_BUCKET_NAME;
  if (!bucket) {
    throw new Error("R2_BUCKET_NAME environment variable is missing");
  }
  return bucket;
}