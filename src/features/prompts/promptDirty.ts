import type { PromptState } from "./model";

export function promptContentSignature(state: PromptState) {
  const { activeVersionId: _selection, versions, ...content } = state;
  return JSON.stringify({
    ...content,
    versions: versions.map(({ updatedAt: _timestamp, ...version }) => version)
  });
}
