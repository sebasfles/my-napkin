import { Editor } from "@/components/editor";

export default async function DiagramPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return <Editor key={id} diagramId={id} />;
}
