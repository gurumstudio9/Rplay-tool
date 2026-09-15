import { isJsonObject, type JsonObject } from "./model";

export async function readJsonFile(file: File): Promise<JsonObject> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await file.text()) as unknown;
  } catch {
    throw new Error(`${file.name} 파일의 JSON 형식이 올바르지 않습니다.`);
  }
  if (!isJsonObject(parsed)) {
    throw new Error(`${file.name} 파일은 JSON 객체 형식이어야 합니다.`);
  }
  return parsed;
}

export function downloadJson(filename: string, value: unknown) {
  const blob = new Blob([JSON.stringify(value, null, 2)], {
    type: "application/json"
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function safeFilenamePart(value: string) {
  return value.trim().replace(/[<>:"/\\|?*\u0000-\u001f]+/g, "-") || "work";
}
