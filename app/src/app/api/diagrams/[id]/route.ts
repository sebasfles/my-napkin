import { NextResponse } from "next/server";
import { diagramRepository } from "@/lib/dynamo";
import { sceneStore } from "@/lib/s3";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const name = typeof body === "object" && body !== null ? (body as { name?: unknown }).name : null;

  if (name !== undefined && name !== null) {
    if (typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "name must be a non-empty string" }, { status: 400 });
    }
  }

  const diagram = await diagramRepository.touch(
    id,
    typeof name === "string" ? name.trim() : undefined,
  );
  if (!diagram) return NextResponse.json({ error: "diagram not found" }, { status: 404 });

  return NextResponse.json({ diagram });
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const { id } = await params;

  await diagramRepository.remove(id);
  await sceneStore.remove(id);

  return new NextResponse(null, { status: 204 });
}
