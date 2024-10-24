import {
  openDB,
  deleteDB,
  DBSchema,
  IDBPDatabase,
  IDBPCursorWithValue,
} from "idb";

import { Bucket, IFS } from "@hls-downloader/core/lib/services";
import { downloads } from "webextension-polyfill";
import filenamify from "filenamify";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import type { FFFSType, LogEventCallback, ProgressEventCallback } from "@ffmpeg/ffmpeg/dist/esm/types";
import { fetchFile } from "@ffmpeg/util";

const buckets: Record<string, IndexedDBBucket> = {};

/**
 * Temporary workaround that lets streamToMp4Blob communicate when its not actually
 * an mp4 blob, e.g. mp2t (.ts) blob returned when file is too large for ffmpeg to output
 */
export declare type MarkedURLString =
  & string
  /** Hint for saving step */
  & { extension?: string }


interface ChunksDB extends DBSchema {
  chunks: {
    value: {
      data: Uint8Array;
      index: number;
    };
    key: string;
    indexes: { index: number };
  };
}

const storageManager = (function () {
  let storage = {};

  return {
    setItem: function (key: string | number, value: any) {
      storage[key] = JSON.stringify(value);
    },

    getItem: function (key: string | number) {
      const value = storage[key];
      return value ? JSON.parse(value) : null;
    },

    removeItem: function (key: string | number) {
      delete storage[key];
    },

    clear: function () {
      storage = {};
    },
  };
})();

export class IndexedDBBucket implements Bucket {
  readonly fileName = "file";
  readonly objectStoreName = "chunks";
  private db?: IDBPDatabase<ChunksDB>;
  ffmpeg: FFmpeg;

  constructor(
    readonly length: number,
    readonly id: string,
  ) {}

  async cleanup() {
    await this.deleteDB();
    this.ffmpeg.deleteFile(`${this.fileName}.mp4`);
    return;
  }

  async deleteDB() {
    if (!this.db) {
      throw Error();
    }
    this.db.close();
    await deleteDB(this.id);
    return;
  }

  async openDB() {
    const objectStoreName = this.objectStoreName;
    const db = await openDB<ChunksDB>(this.id, 1, {
      upgrade(db) {
        const store = db.createObjectStore(objectStoreName, {
          keyPath: "index",
        });
        store.createIndex("index", "index", { unique: true });
      },
    });

    const baseURL = "/assets/ffmpeg";

    this.ffmpeg = new FFmpeg();

    await this.ffmpeg.load({
      coreURL: `${baseURL}/ffmpeg-core.js`,
      wasmURL: `${baseURL}/ffmpeg-core.wasm`,
    });

    this.db = db;
  }

  async write(index: number, data: ArrayBuffer): Promise<void> {
    const typedArray = new Uint8Array(data);

    if (!this.db) {
      await this.openDB();
    }
    await this.db!.add(this.objectStoreName, {
      data: typedArray,
      index,
    });
    return Promise.resolve();
  }

  async stream() {
    if (!this.db) {
      throw Error();
    }
    const store = this.db
      .transaction(this.objectStoreName)
      .objectStore(this.objectStoreName);

    let cursor = await store.openCursor();
    let first = true;
    return new ReadableStream(
      {
        pull: (controller) => {
          async function push(
            currentCursor: IDBPCursorWithValue<
              ChunksDB,
              ["chunks"],
              "chunks",
              unknown
            > | null,
          ) {
            if (!currentCursor) {
              controller.close();
            } else {
              controller.enqueue(currentCursor.value.data);
              const nextCursor = await currentCursor.continue();
              push(nextCursor);
            }
          }
          if (first) {
            push(cursor);
            first = false;
          }
        },
      },
      {},
    );
  }

  async getLink(): Promise<MarkedURLString> {
    if (!this.db) {
      throw Error();
    }

    try {
      console.info('[getLink] getting videoBlob')
      const videoBlob = await this.streamToMp4Blob();
      console.info('[getLink] videoBlob: %o', videoBlob)
      console.info('[getLink] videoBlob.type: %o', videoBlob.type)

      let url: MarkedURLString = URL.createObjectURL(videoBlob);

      // TODO: Check what this actually is on failure and check for it explicitly, its
      //       probably "video/mp2t"
      if(videoBlob.type !== "video/mp4")
      {
        url = Object.assign(url, { extension: 'ts' })
      }

      console.info('[getLink] url: %o', url)

      return url;
    } catch (error) {
      console.error(error);
      return "";
    }
  }

  private async streamToMp4Blob() {
    if (!this.db) {
      throw Error();
    }
    const stream = await this.stream();
    const response = new Response(stream, {
      headers: {
        "Content-Type": "video/mp2t",
      },
    });
    const blob = await response.blob();
    console.info(`[streamToMp4Blob] Stream blob size: %o`,
      blob.size > 1_000_000_000
        ? (blob.size / 1024 / 1024 / 1024).toFixed(2) + `Gb`
        : (blob.size / 1024 / 1024).toFixed(2) + `Mb`)

    // TODO: Place this in best place
    const MAX_REMUX_SIZE = 2_000_000_000

    // TODO: This should be accessible as a button in DownloadsView
    if(blob.size > MAX_REMUX_SIZE)
    {
      console.info(`[streamToMp4Blob] Possible oversize remux detected, returning stream blob.`)
      return blob
    }

    const inputFilename = `${this.fileName}.ts`
    const inputFilePath = `/${inputFilename}`

    const outputFilename = `${this.fileName}.mp4`
    const outputFilePath = outputFilename // `/${outputFilename}`

    // Remove this after setup
    globalThis.ffmpeg = this.ffmpeg

    // NEW WORKERFS METHOD
    {
      const f = this.ffmpeg

      // This mounting to subfolder thing might not be needed, after this is working
      // test if it works in root to see if this can get removed
      const directory = await f.listDir("/");
      if (!directory.find(item => item.name === "mounted"))
      {
        await f.createDir('/mounted');
      }
      let directoryMounted = await f.listDir("/mounted");
      console.info(`[streamToMp4Blob] Created directory /mounted: %o`, directoryMounted)

      await f.mount('WORKERFS' as FFFSType.WORKERFS,
      {
        blobs: [
        {
          data: blob,
          name: inputFilename
        }]
      }, '/mounted');

      const mountedInputFilePath = `/mounted/${inputFilename}`
      console.info(`[streamToMp4Blob] Mounted stream blob to %s`, mountedInputFilePath)
      console.info(`[streamToMp4Blob] Updated directory listing for /mounted: %o`,
        await f.listDir("/mounted"))

      const onEvents =
      {
        log: ((e) => console.info(`[streamToMp4Blob:ffmpeg:%s] %s`, e.type, e.message)) as LogEventCallback,
        progress: ((e) => console.info(`[streamToMp4Blob:ffmpeg:progress] %o`, e.progress)) as ProgressEventCallback,
      }
      // f.on("log", onEvents.log)
      // f.on("progress", onEvents.progress)
      const res = await f.exec([
          "-i",
          mountedInputFilePath,
          "-acodec",
          "copy",
          "-vcodec",
          "copy",
          outputFilePath,
      ]);
      // f.off("log", onEvents.log)
      // f.off("progress", onEvents.progress)
      console.info(`[streamToMp4Blob] FFMPEG return code: %o`, res)
      console.info(`[streamToMp4Blob] Updated directory listing for output dir /: %o`, await f.listDir("/"))
      console.info(`[streamToMp4Blob] Unmounting mount dir %s`, mountedInputFilePath)
      await f.unmount('/mounted')
      await f.deleteDir('/mounted')
      // Success, return result
      if(res === 0)
      {
        console.info(`[streamToMp4Blob] Reading output file at: %o`, outputFilePath)
        const data = await this.ffmpeg.readFile(outputFilePath);
        console.info(`[streamToMp4Blob] Remuxed data length: %o`, data.length)

        console.info(`[streamToMp4Blob] Creating blob`)
        const blob = new Blob([data], { type: "video/mp4" })
        console.info(`[streamToMp4Blob] Final remuxed blob size: %o`, blob.size)

        return blob;
      }
    }

    console.info(`%c[streamToMp4Blob] WORKERFS method failed, falling back to file mode`, 'color: orange; font-weight: bold')

    // Fallback to original on failure
    const file = await fetchFile(blob);
    await this.ffmpeg.writeFile(inputFilename, file);
    await this.ffmpeg.exec([
        "-i",
        `${this.fileName}.ts`,
        "-acodec",
        "copy",
        "-vcodec",
        "copy",
        outputFilePath,
    ]);
    await this.ffmpeg.deleteFile(`${this.fileName}.ts`);
    const data = await this.ffmpeg.readFile(`${this.fileName}.mp4`);
    return new Blob([data], { type: "video/mp4" });
  }
}

const cleanup: IFS["cleanup"] = async function () {
  const dbsString = storageManager.getItem("dbs");
  if (!dbsString) {
    return;
  }

  const dbNames: string[] = JSON.parse(dbsString);
  for (const dbName of dbNames) {
    const db = await openDB(dbName, 1);
    db.close();
    await deleteDB(dbName);
  }
};

const createBucket: IFS["createBucket"] = async function (
  id: string,
  length: number,
) {
  buckets[id] = new IndexedDBBucket(length, id);

  storageManager.setItem("dbs", JSON.stringify(Object.keys(buckets)));
  return Promise.resolve();
};

const deleteBucket: IFS["deleteBucket"] = async function (id: string) {
  await buckets[id].deleteDB();
  delete buckets[id];
  storageManager.setItem("dbs", JSON.stringify(Object.keys(buckets)));
  return Promise.resolve();
};

const getBucket: IFS["getBucket"] = function (id: string) {
  return Promise.resolve(buckets[id]);
};

const saveAs: IFS["saveAs"] = async function (
  path: string,
  link: string,
  { dialog },
) {
  if (link === "") {
    return Promise.resolve();
  }
  window.URL = window.URL || window.webkitURL;
  const filename = filenamify(path ?? "stream.mp4");

  await downloads.download({
    // Can remove toString after MarkedURLString nonsense is done properly
    url: link.toString(),
    saveAs: dialog,
    conflictAction: "uniquify",
    filename,
  });
  // URL.revokeObjectURL(link);
  return Promise.resolve();
};

export const IndexedDBFS: IFS = {
  getBucket,
  createBucket,
  deleteBucket,
  saveAs,
  cleanup,
};
