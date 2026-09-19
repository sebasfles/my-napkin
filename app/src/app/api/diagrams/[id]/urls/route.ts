import { NextResponse } from "next/server";
import { diagramRepository } from "@/lib/dynamo";
import { sceneStore } from "@/lib/s3";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const diagram = await diagramRepository.get(id);
  if (!diagram) return NextResponse.json({ error: "diagram not found" }, { status: 404 });

  return NextResponse.json(await sceneStore.urls(id), {
    headers: { "cache-control": "no-store" },
  });
}
