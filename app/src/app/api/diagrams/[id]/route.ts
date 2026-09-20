import { NextResponse } from "next/server";
import { diagramChanges } from "@/lib/diagram-changes";
import { diagramRepository } from "@/lib/dynamo";
import { sceneStore } from "@/lib/s3";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const parsed = diagramChanges(await request.json().catch(() => null), new Date());

  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const diagram = await diagramRepository.update(id, parsed.changes);
  if (!diagram) return NextResponse.json({ error: "diagram not found" }, { status: 404 });

  return NextResponse.json({ diagram });
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const { id } = await params;

  await diagramRepository.remove(id);
  await sceneStore.remove(id);

  return new NextResponse(null, { status: 204 });
}
