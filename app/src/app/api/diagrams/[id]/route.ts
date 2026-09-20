import { NextResponse } from "next/server";
import { isFolder } from "@/lib/diagrams";
import { itemRepository } from "@/lib/dynamo";
import { itemChanges } from "@/lib/item-changes";
import { sceneStore } from "@/lib/s3";
import { canMoveInto, subtree } from "@/lib/tree";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const parsed = itemChanges(await request.json().catch(() => null), new Date());

  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const { parentId, pinnedAt } = parsed.changes;

  if (parentId !== undefined || pinnedAt !== undefined) {
    const items = await itemRepository.list();
    const target = items.find((item) => item.id === id);

    if (target === undefined) {
      return NextResponse.json({ error: "diagram not found" }, { status: 404 });
    }
    if (pinnedAt !== undefined && isFolder(target)) {
      return NextResponse.json({ error: "only a diagram can be pinned" }, { status: 400 });
    }
    if (parentId !== undefined && !canMoveInto(items, id, parentId)) {
      return NextResponse.json(
        { error: "parentId must be a folder that is not this item or one of its descendants" },
        { status: 400 },
      );
    }
  }

  const item = await itemRepository.update(id, parsed.changes);
  if (item) return NextResponse.json({ item });

  if (parsed.changes.scene !== undefined && (await itemRepository.get(id))) {
    return NextResponse.json({ error: "diagram is locked" }, { status: 409 });
  }

  return NextResponse.json({ error: "diagram not found" }, { status: 404 });
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  const item = await itemRepository.get(id);

  if (item !== null && isFolder(item)) {
    for (const member of subtree(await itemRepository.list(), id)) {
      await itemRepository.remove(member.id);
      if (!isFolder(member)) await sceneStore.remove(member.id);
    }

    return new NextResponse(null, { status: 204 });
  }

  await itemRepository.remove(id);
  await sceneStore.remove(id);

  return new NextResponse(null, { status: 204 });
}
