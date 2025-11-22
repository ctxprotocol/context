"use client";

import { useEffect } from "react";
import { initialArtifactData, useArtifact } from "@/hooks/use-artifact";
import { artifactDefinitions } from "./artifact";
import { useDataStream } from "./data-stream-provider";

export function DataStreamHandler() {
  const { dataStream, setDataStream } = useDataStream();

  const { artifact, setArtifact, setMetadata } = useArtifact();

  useEffect(() => {
    if (!dataStream?.length) {
      return;
    }

    // Only consume artifact-related stream parts here.
    // Leave other events (e.g. data-debugCode/data-debugResult, data-toolStatus, data-usage)
    // in the shared dataStream so developer-mode UIs and other consumers
    // can still access them.
    const artifactTypes = new Set([
      "data-id",
      "data-title",
      "data-kind",
      "data-clear",
      "data-finish",
    ] as const);

    const artifactDeltas = dataStream.filter((delta) =>
      artifactTypes.has(delta.type as (typeof artifactTypes extends Set<infer T> ? T : never))
    );

    if (!artifactDeltas.length) {
      return;
    }

    const remainingDeltas = dataStream.filter(
      (delta) => !artifactTypes.has(delta.type as (typeof artifactTypes extends Set<infer T> ? T : never))
    );
    setDataStream(remainingDeltas);

    for (const delta of artifactDeltas) {
      const artifactDefinition = artifactDefinitions.find(
        (currentArtifactDefinition) =>
          currentArtifactDefinition.kind === artifact.kind
      );

      if (artifactDefinition?.onStreamPart) {
        artifactDefinition.onStreamPart({
          streamPart: delta,
          setArtifact,
          setMetadata,
        });
      }

      setArtifact((draftArtifact) => {
        if (!draftArtifact) {
          return { ...initialArtifactData, status: "streaming" };
        }

        switch (delta.type) {
          case "data-id":
            return {
              ...draftArtifact,
              documentId: delta.data,
              status: "streaming",
            };

          case "data-title":
            return {
              ...draftArtifact,
              title: delta.data,
              status: "streaming",
            };

          case "data-kind":
            return {
              ...draftArtifact,
              kind: delta.data,
              status: "streaming",
            };

          case "data-clear":
            return {
              ...draftArtifact,
              content: "",
              status: "streaming",
            };

          case "data-finish":
            return {
              ...draftArtifact,
              status: "idle",
            };

          default:
            return draftArtifact;
        }
      });
    }
  }, [artifact, dataStream, setArtifact, setDataStream, setMetadata]);

  return null;
}
