import { Injectable } from '@nestjs/common';
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client, S3ServiceException } from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'node:stream';
import { createHash } from 'node:crypto';
import { ObjectStorage } from '../../application/ports/object-storage.port';
import { ConflictError, ValidationError } from '../../domain/shared/domain-errors';

@Injectable()
export class S3ObjectStorage implements ObjectStorage {
  readonly enabled = process.env.FILE_STORAGE === 's3';
  private readonly bucket = process.env.S3_FILES_BUCKET ?? '';
  private readonly client = new S3Client({
    region: process.env.AWS_REGION ?? 'us-east-1',
    ...(process.env.S3_ENDPOINT ? { endpoint: process.env.S3_ENDPOINT, forcePathStyle: true } : {}),
  });

  private check() {
    if (!this.enabled || !this.bucket) throw new ConflictError('S3 no esta configurado');
  }

  async authorize(key: string, mime: string, size: number, checksum: string) {
    this.check();
    return createPresignedPost(this.client, {
      Bucket: this.bucket, Key: key, Expires: 300,
      Fields: { 'Content-Type': mime, 'x-amz-checksum-algorithm': 'SHA256', 'x-amz-checksum-sha256': checksum },
      Conditions: [
        ['content-length-range', size, size],
        ['eq', '$Content-Type', mime],
        ['eq', '$x-amz-checksum-algorithm', 'SHA256'],
        ['eq', '$x-amz-checksum-sha256', checksum],
      ],
    });
  }

  async read(key: string, maxSize: number): Promise<Uint8Array> {
    this.check();
    const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    if (!(result.Body instanceof Readable)) throw new ValidationError('El archivo S3 no tiene un flujo de contenido valido');
    if (!result.ContentLength || result.ContentLength > maxSize) {
      result.Body.destroy();
      throw new ValidationError('El archivo S3 excede el limite');
    }
    const chunks: Buffer[] = [];
    let length = 0;
    for await (const chunk of result.Body) {
      const buffer = Buffer.from(chunk);
      length += buffer.length;
      if (length > maxSize) {
        result.Body.destroy();
        throw new ValidationError('El archivo S3 excede el limite');
      }
      chunks.push(buffer);
    }
    return Buffer.concat(chunks);
  }

  async writeOnce(key: string, bytes: Uint8Array, mime: string, checksum: string) {
    this.check();
    try {
      await this.client.send(new PutObjectCommand({
        Bucket: this.bucket, Key: key, Body: bytes, ContentType: mime, ChecksumSHA256: checksum,
        IfNoneMatch: '*', ServerSideEncryption: 'AES256',
      }));
    } catch (error) {
      if (!(error instanceof S3ServiceException) || error.$metadata.httpStatusCode !== 412) throw error;
      const existing = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key, ChecksumMode: 'ENABLED' }));
      if (existing.ContentLength !== bytes.length || existing.ContentType !== mime) {
        throw new ConflictError('El objeto definitivo no coincide con la carga');
      }
      const saved = await this.read(key, bytes.length);
      if (saved.length !== bytes.length || createHash('sha256').update(saved).digest('base64') !== checksum) {
        throw new ConflictError('El objeto definitivo no coincide con la carga');
      }
    }
  }

  async download(key: string, name: string, mime: string) {
    this.check();
    return getSignedUrl(this.client, new GetObjectCommand({
      Bucket: this.bucket, Key: key,
      ResponseContentType: mime,
      ResponseContentDisposition: `${mime.startsWith('image/') ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(name)}`,
      ResponseCacheControl: 'private, no-store',
    }), { expiresIn: 300 });
  }

  async remove(key: string) {
    this.check();
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}
