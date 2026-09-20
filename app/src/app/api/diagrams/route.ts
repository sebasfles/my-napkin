import { NextResponse } from "next/server";
import { isFolder, type Item } from "@/lib/diagrams";
import { itemRepository } from "@/lib/dynamo";
import { newItem } from "@/lib/item-changes";
import { sceneStore } from "@/lib/s3";

export const dynamic = "force-dynamic";

export async function GET() {
  const items = await itemRepository.list();
  return NextResponse.json({ items }, { headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request) {
  const parsed = newItem(await request.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const { name, kind, parentId } = parsed.item;

  if (parentId !== null) {
    const parent = await itemRepository.get(parentId);
    if (parent === null || !isFolder(parent)) {
      return NextResponse.json({ error: "parentId must be an existing folder" }, { status: 400 });
    }
  }

  const now = new Date().toISOString();
  const item: Item = {
    id: crypto.randomUUID(),
    name,
    createdAt: now,
    updatedAt: now,
    ...(kind === "folder" ? { kind } : {}),
    ...(parentId === null ? {} : { parentId }),
  };

  if (kind === "diagram") await sceneStore.createEmpty(item.id);
  await itemRepository.create(item);

  return NextResponse.json({ item }, { status: 201 });
}
