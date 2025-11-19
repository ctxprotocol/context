import { artifactKinds, documentHandlersByArtifactKind } from "@/lib/artifacts/server";
import { getDocumentById } from "@/lib/db/queries";
import { generateUUID } from "@/lib/utils";
import { getSkillRuntime } from "./runtime";

export type CreateDocumentParams = {
  title: string;
  kind: (typeof artifactKinds)[number];
};

export type UpdateDocumentParams = {
  id: string;
  description: string;
};

export async function createDocument(params: CreateDocumentParams) {
  const { session, dataStream } = getSkillRuntime();
  if (!dataStream) {
    throw new Error("Data stream is required to create documents");
  }

  const id = generateUUID();

  dataStream.write({ type: "data-kind", data: params.kind, transient: true });
  dataStream.write({ type: "data-id", data: id, transient: true });
  dataStream.write({ type: "data-title", data: params.title, transient: true });
  dataStream.write({ type: "data-clear", data: null, transient: true });

  const handler = documentHandlersByArtifactKind.find(
    (candidate) => candidate.kind === params.kind
  );

  if (!handler) {
    throw new Error(`No document handler found for kind: ${params.kind}`);
  }

  await handler.onCreateDocument({
    id,
    title: params.title,
    dataStream,
    session,
  });

  dataStream.write({ type: "data-finish", data: null, transient: true });

  return {
    id,
    title: params.title,
    kind: params.kind,
    content: "Document created successfully.",
  };
}

export async function updateDocument(params: UpdateDocumentParams) {
  const { session, dataStream } = getSkillRuntime();
  if (!dataStream) {
    throw new Error("Data stream is required to update documents");
  }

  const document = await getDocumentById({ id: params.id });

  if (!document) {
    throw new Error("Document not found");
  }

  dataStream.write({ type: "data-clear", data: null, transient: true });

  const handler = documentHandlersByArtifactKind.find(
    (candidate) => candidate.kind === document.kind
  );

  if (!handler) {
    throw new Error(`No document handler found for kind: ${document.kind}`);
  }

  await handler.onUpdateDocument({
    document,
    description: params.description,
    dataStream,
    session,
  });

  dataStream.write({ type: "data-finish", data: null, transient: true });

  return {
    id: document.id,
    title: document.title,
    kind: document.kind,
    content: "Document updated successfully.",
  };
}




