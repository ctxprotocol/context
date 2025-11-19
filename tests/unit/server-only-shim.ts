import Module from "node:module";

const originalLoad = Module._load;

// server-only is a Next.js runtime guard that throws when imported from the
// client. Our unit tests run outside of Next.js, so we stub it with a no-op.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(Module._load as any) = function patchedLoad(
  request: string,
  parent: NodeModule | undefined,
  isMain: boolean
) {
  if (request === "server-only") {
    return {};
  }

  return originalLoad.apply(this, [request, parent, isMain]);
};


