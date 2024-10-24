// import type { } from '@hls-downloader/background/lib/services/indexedb-fs'
export declare type MarkedURLString =
  | string
  | { extension: string; toString(): string }

export interface IFS {
  cleanup(): Promise<void>;
  getBucket(id: string): Promise<Bucket>;
  createBucket(id: string, length: number): Promise<void>;
  deleteBucket(id: string): Promise<void>;
  saveAs(
    path: string,
    link: string,
    options: {
      dialog: boolean;
    },
  ): Promise<void>;
}

export interface Bucket {
  write(index: number, data: ArrayBuffer): Promise<void>;
  getLink(): Promise<MarkedURLString>;
}
