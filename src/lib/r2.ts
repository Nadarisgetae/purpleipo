import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

/**
 * Returns a fresh R2/S3 client using runtime env vars.
 * Called lazily inside uploadToR2() / deleteFromR2() — never at module load time.
 */
function getR2Client(): S3Client | null {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) return null;

  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

export function isR2Configured(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY
  );
}

/**
 * Uploads a file buffer to Cloudflare R2 (or returns a local fallback URL).
 */
export async function uploadToR2(
  fileBuffer: Buffer,
  fileName: string,
  contentType: string = 'application/pdf'
): Promise<string> {
  const client = getR2Client();

  if (!client) {
    console.warn('⚠️ Cloudflare R2 not configured. Using local fallback URL.');
    return `/uploads/${encodeURIComponent(fileName)}`;
  }

  const accountId = process.env.R2_ACCOUNT_ID!;
  const bucketName = process.env.R2_BUCKET_NAME || 'purpleipo-docs';
  const key = `prospectuses/${Date.now()}-${fileName}`;

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: fileBuffer,
    ContentType: contentType,
  });

  await client.send(command);

  const publicDomain = process.env.R2_PUBLIC_DOMAIN;
  if (publicDomain) {
    return `${publicDomain}/${key}`;
  }

  return `https://${accountId}.r2.cloudflarestorage.com/${bucketName}/${key}`;
}

/**
 * Deletes a file from Cloudflare R2 bucket.
 */
export async function deleteFromR2(fileUrlOrKey: string): Promise<boolean> {
  const client = getR2Client();
  if (!client || !fileUrlOrKey) return false;

  try {
    const bucketName = process.env.R2_BUCKET_NAME || 'purpleipo-docs';
    let key = fileUrlOrKey;

    if (key.includes('prospectuses/')) {
      key = 'prospectuses/' + key.split('prospectuses/')[1];
    } else if (key.startsWith('http')) {
      const urlObj = new URL(key);
      key = urlObj.pathname.replace(/^\/[^/]+\//, '');
    }

    const command = new DeleteObjectCommand({
      Bucket: bucketName,
      Key: key,
    });

    await client.send(command);
    console.log(`  🗑️ Successfully purged from Cloudflare R2: ${key}`);
    return true;
  } catch (err: any) {
    console.warn(`  ⚠️ Could not purge R2 object (${fileUrlOrKey}):`, err.message);
    return false;
  }
}
