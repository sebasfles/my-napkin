import { NextResponse } from "next/server";
import { isFolder, isLocked } from "@/lib/diagrams";
import { itemRepository } from "@/lib/dynamo";
import { sceneStore } from "@/lib/s3";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const item = await itemRepository.get(id);
  if (item === null || isFolder(item)) {
    return NextResponse.json({ error: "diagram not found" }, { status: 404 });
  }

  const locked = isLocked(item);
  const urls = await sceneStore.urls(id, !locked);

  return NextResponse.json(
    { ...urls, locked },
    {
      headers: { "cache-control": "no-store" },
    },
  );
}
