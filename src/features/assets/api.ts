import type { AssetSummary } from "./model";

async function readJson<T>(response: Response) {
  const payload = await response.json() as T & {
    error?: string;
    message?: string;
  };
  if (!response.ok) {
    throw new Error(payload.error || payload.message || `요청 실패: ${response.status}`);
  }
  return payload;
}

export async function listAssets(workId: string, signal?: AbortSignal) {
  const response = await fetch(
    `/api/assets?workId=${encodeURIComponent(workId)}`,
    { signal }
  );
  const payload = await readJson<{
    success?: boolean;
    assets?: AssetSummary[];
    message?: string;
  }>(response);
  return {
    assets: Array.isArray(payload.assets) ? payload.assets : [],
    message: payload.success === false
      ? payload.message || "에셋 디렉토리를 찾을 수 없습니다."
      : ""
  };
}

export async function loadAsset(
  workId: string,
  name: string,
  signal?: AbortSignal
) {
  const response = await fetch(
    `/api/asset-content?workId=${encodeURIComponent(workId)}&name=${encodeURIComponent(name)}`,
    { signal }
  );
  const payload = await readJson<{
    success?: boolean;
    content?: string;
  }>(response);
  if (!payload.success || typeof payload.content !== "string") {
    throw new Error("에셋을 불러오지 못했습니다.");
  }
  return payload.content;
}

export async function saveAsset(
  workId: string,
  name: string,
  content: string
) {
  const response = await fetch("/api/asset-content", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ workId, name, content })
  });
  const payload = await readJson<{ success?: boolean }>(response);
  if (!payload.success) throw new Error("에셋을 저장하지 못했습니다.");
}

export async function deleteAsset(workId: string, name: string) {
  const response = await fetch(
    `/api/asset-content?workId=${encodeURIComponent(workId)}&name=${encodeURIComponent(name)}`,
    { method: "DELETE" }
  );
  const payload = await readJson<{ success?: boolean }>(response);
  if (!payload.success) throw new Error("에셋을 삭제하지 못했습니다.");
}
