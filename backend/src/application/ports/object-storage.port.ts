export const OBJECT_STORAGE = Symbol('OBJECT_STORAGE');

export interface ObjectStorage {
  readonly enabled: boolean;
  authorize(key: string, mime: string, size: number, checksum: string): Promise<{ url: string; fields: Record<string, string> }>;
  read(key: string, maxSize: number): Promise<Uint8Array>;
  writeOnce(key: string, bytes: Uint8Array, mime: string, checksum: string): Promise<void>;
  download(key: string, name: string, mime: string): Promise<string>;
  remove(key: string): Promise<void>;
}
