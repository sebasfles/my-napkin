import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { SceneStore } from "@/lib/diagrams";
import { scenesBucket } from "@/lib/env";
import { emptyScene, sceneContentType } from "@/lib/scene";

const expiresIn = 300;

let s3: S3Client | undefined;

function client(): S3Client {
  s3 ??= new S3Client({});
  return s3;
}

function key(id: string): string {
  return `scenes/${id}.json`;
}

export const sceneStore: SceneStore = {
  async urls(id) {
    const [get, put] = await Promise.all([
      getSignedUrl(client(), new GetObjectCommand({ Bucket: scenesBucket(), Key: key(id) }), {
        expiresIn,
      }),
      getSignedUrl(
        client(),
        new PutObjectCommand({
          Bucket: scenesBucket(),
          Key: key(id),
          ContentType: sceneContentType,
        }),
        { expiresIn, signableHeaders: new Set(["content-type"]) },
      ),
    ]);

    return { get, put, expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString() };
  },

  async createEmpty(id) {
    await client().send(
      new PutObjectCommand({
        Bucket: scenesBucket(),
        Key: key(id),
        ContentType: sceneContentType,
        Body: JSON.stringify(emptyScene()),
      }),
    );
  },

  async remove(id) {
    await client().send(new DeleteObjectCommand({ Bucket: scenesBucket(), Key: key(id) }));
  },
};
