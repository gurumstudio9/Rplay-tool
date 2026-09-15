export class StorageApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "StorageApiError";
    this.status = status;
  }
}

/**
 * workId는 "workId::platformId" 형태로 넘기면 됩니다.
 * platformId 없이 "workId"만 넘기면 기본값 "젠잇"이 적용됩니다.
 * 캐릭터 Look 저장소는 서버에서 플랫폼을 무시하고 작품 공통 look/을 사용합니다.
 */
function storageKey(baseKey: string, workId: string) {
  const hasplatform = workId.includes("::");
  const fullWorkId = hasplatform ? workId : `${workId}::젠잇`;
  return `${baseKey}::${fullWorkId}`;
}

async function responsePayload(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function errorMessage(payload: unknown, fallback: string) {
  if (payload && typeof payload === "object" && "error" in payload) {
    const message = (payload as { error?: unknown }).error;
    if (typeof message === "string" && message) return message;
  }
  return fallback;
}

export async function readStorage<T>(
  baseKey: string,
  workId: string,
  fallback: T,
  signal?: AbortSignal
): Promise<T> {
  const key = encodeURIComponent(storageKey(baseKey, workId));
  const response = await fetch(`/api/storage?key=${key}`, { signal });
  const payload = await responsePayload(response);

  if (!response.ok) {
    throw new StorageApiError(
      errorMessage(payload, `데이터를 불러오지 못했습니다. (${response.status})`),
      response.status
    );
  }

  if (!payload || typeof payload !== "object") return fallback;
  const result = payload as { found?: boolean; value?: T };
  return result.found === false || result.value === null || result.value === undefined
    ? fallback
    : result.value;
}

export async function writeStorage<T>(
  baseKey: string,
  workId: string,
  value: T
): Promise<void> {
  const key = encodeURIComponent(storageKey(baseKey, workId));
  const response = await fetch(`/api/storage?key=${key}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ value })
  });
  const payload = await responsePayload(response);

  if (!response.ok) {
    throw new StorageApiError(
      errorMessage(payload, `데이터를 저장하지 못했습니다. (${response.status})`),
      response.status
    );
  }
}
