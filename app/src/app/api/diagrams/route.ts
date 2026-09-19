import { NextResponse } from "next/server";
import type { Diagram } from "@/lib/diagrams";
import { diagramRepository } from "@/lib/dynamo";
import { sceneStore } from "@/lib/s3";

export const dynamic = "force-dynamic";

export async function GET() {
  const diagrams = await diagramRepository.list();
  return NextResponse.json({ diagrams }, { headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request) {
  const name = nameFrom(await request.json().catch(() => null));
  if (name === null) {
    return NextResponse.json({ error: "name must be a non-empty string" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const diagram: Diagram = { id: crypto.randomUUID(), name, createdAt: now, updatedAt: now };

  await sceneStore.createEmpty(diagram.id);
  await diagramRepository.create(diagram);

  return NextResponse.json({ diagram }, { status: 201 });
}

function nameFrom(body: unknown): string | null {
  if (typeof body !== "object" || body === null) return null;
  const { name } = body as { name?: unknown };
  if (typeof name !== "string" || name.trim().length === 0) return null;
  return name.trim();
}
