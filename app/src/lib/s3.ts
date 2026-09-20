import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { LibraryStore, ObjectUrls, SceneStore } from "@/lib/diagrams";
import { scenesBucket } from "@/lib/env";
import { emptyScene, sceneContentType } from "@/lib/scene";

const expiresIn = 300;

let s3: S3Client | undefined;

function client(): S3Client {
  s3 ??= new S3Client({});
  return s3;
}

function sceneKey(id: string): string {
  return `scenes/${id}.json`;
}

function libraryKey(id: string): string {
  return `libraries/${id}/scene.json`;
}

function itemsKey(id: string): string {
  return `libraries/${id}/items.json`;
}

async function signed(key: string, write: boolean): Promise<ObjectUrls> {
  const [get, put] = await Promise.all([
    getSignedUrl(client(), new GetObjectCommand({ Bucket: scenesBucket(), Key: key }), {
      expiresIn,
    }),
    write
      ? getSignedUrl(
          client(),
          new PutObjectCommand({
            Bucket: scenesBucket(),
            Key: key,
            ContentType: sceneContentType,
          }),
          { expiresIn, signableHeaders: new Set(["content-type"]) },
        )
      : undefined,
  ]);

  return { get, put };
}

function expiry(): string {
  return new Date(Date.now() + expiresIn * 1000).toISOString();
}

async function put(key: string, body: string): Promise<void> {
  await client().send(
    new PutObjectCommand({
      Bucket: scenesBucket(),
      Key: key,
      ContentType: sceneContentType,
      Body: body,
    }),
  );
}

async function drop(key: string): Promise<void> {
  await client().send(new DeleteObjectCommand({ Bucket: scenesBucket(), Key: key }));
}

export const sceneStore: SceneStore = {
  async urls(id, write) {
    return { ...(await signed(sceneKey(id), write)), expiresAt: expiry() };
  },

  async createEmpty(id) {
    await put(sceneKey(id), JSON.stringify(emptyScene()));
  },

  async remove(id) {
    await drop(sceneKey(id));
  },
};

export const libraryStore: LibraryStore = {
  async urls(id) {
    const [scene, items] = await Promise.all([
      signed(libraryKey(id), true),
      signed(itemsKey(id), true),
    ]);

    return { ...scene, items, expiresAt: expiry() };
  },

  async createEmpty(id) {
    await put(libraryKey(id), JSON.stringify(emptyScene()));
  },

  async remove(id) {
    await drop(itemsKey(id));
    await drop(libraryKey(id));
  },
};
