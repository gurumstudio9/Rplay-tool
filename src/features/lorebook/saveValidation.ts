import {
  lorebookBodyUnavailable,
  lorebookIdentityErrors,
  lorebookTriggerLimit,
  type LorebookEntry,
  type LorebookState
} from "./model";

export type LorebookSaveValidation =
  | { ok: true }
  | { ok: false; message?: string; entryId?: string };

export function validateLorebookSave(
  state: LorebookState,
  entries: LorebookEntry[]
): LorebookSaveValidation {
  const identityErrors = lorebookIdentityErrors(entries);
  if (identityErrors.length) {
    return {
      ok: false,
      message: identityErrors[0].message,
      entryId: identityErrors[0].entryId
    };
  }
  const unavailable = entries.filter(lorebookBodyUnavailable);
  if (unavailable.length) {
    return {
      ok: false,
      message: `${unavailable[0].bodyFileName}: 본문을 안전하게 읽지 못했습니다.`,
      entryId: unavailable[0].id
    };
  }
  if (state.invalidJsonFiles.length) {
    return {
      ok: false,
      message: `파싱할 수 없는 JSON: ${state.invalidJsonFiles.join(", ")}`
    };
  }
  const conflict = entries.find((entry) =>
    entry.migrateBodyToMarkdown && entry.bodyStatus === "unlinked-md"
  );
  if (conflict) {
    return {
      ok: false,
      message: `${conflict.bodyFileName} 파일이 미연결 상태로 이미 존재합니다.`
    };
  }
  const overTriggers = entries.filter((entry) =>
    entry.triggers.length > lorebookTriggerLimit
  );
  if (overTriggers.length && !window.confirm(
    `트리거가 ${lorebookTriggerLimit}개를 초과한 항목이 있습니다. 그대로 저장할까요?`
  )) {
    return { ok: false };
  }
  const overBodies = entries.filter((entry) =>
    entry.body.length > state.bodyLimit
  );
  if (overBodies.length && !window.confirm(
    [
      `본문 기준 ${state.bodyLimit}자를 초과한 항목이 ${overBodies.length}개 있습니다.`,
      "",
      ...overBodies.map((entry) => {
        const label = [entry.no, entry.title.trim() || entry.id].filter(Boolean).join(" · ");
        return `• ${label}: ${entry.body.length}자 (${entry.body.length - state.bodyLimit}자 초과)`;
      }),
      "",
      "그대로 저장할까요?"
    ].join("\n")
  )) {
    return { ok: false };
  }
  return { ok: true };
}
