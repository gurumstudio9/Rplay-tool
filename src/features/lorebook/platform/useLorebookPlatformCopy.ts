import { loadLorebook } from "../api";
import {
  lorebookBodyUnavailable,
  type LorebookEntry
} from "../model";
import type { LorebookManager } from "../useLorebookManager";
import { copyLorebookText } from "./clipboard";
import { buildRplayData } from "./data";
import { buildRplayLorebookScript } from "./rplay";
export type LorebookPlatformAction = "rplay-sync";
function platformLabel(_action: LorebookPlatformAction) { return "알플레이"; }
function bodyCheckRequired(_action: LorebookPlatformAction) { return true; }

export function useLorebookPlatformCopy(
  activeWorkId: string,
  manager: LorebookManager
) {
  async function validate(
    action: LorebookPlatformAction,
    entries: LorebookEntry[]
  ) {
    const label = platformLabel(action);
    if (manager.dirty) {
      manager.announce(
        `${label} 복사 전에 현재 변경을 저장해 주세요. 저장된 JSON/MD만 사용합니다.`,
        "error"
      );
      return false;
    }
    if (!entries.length) {
      manager.announce("복사할 로어북 항목이 없습니다.", "error");
      return false;
    }
    if (manager.savedState.invalidJsonFiles.length) {
      manager.announce(
        `파싱할 수 없는 JSON: ${manager.savedState.invalidJsonFiles.join(", ")}`,
        "error"
      );
      return false;
    }
    try {
      const latest = await loadLorebook(activeWorkId);
      if (latest.invalidJsonFiles.length) {
        manager.announce(
          `외부에서 파싱할 수 없는 JSON이 발견됨: ${latest.invalidJsonFiles.join(", ")}`,
          "error"
        );
        return false;
      }
      if (
        latest.collectionRevision
        && latest.collectionRevision !== manager.savedState.collectionRevision
      ) {
        manager.announce(
          "JSON/MD 파일이 외부에서 변경되었습니다. 새로고침 후 다시 복사해 주세요.",
          "error"
        );
        return false;
      }
    } catch (error) {
      manager.announce(
        error instanceof Error
          ? `${label} 복사 전 최신 상태 확인 실패: ${error.message}`
          : `${label} 복사 전 최신 상태를 확인하지 못했습니다.`,
        "error"
      );
      return false;
    }
    if (bodyCheckRequired(action)) {
      const unavailable = entries.filter(lorebookBodyUnavailable);
      if (unavailable.length) {
        manager.announce(
          `본문을 읽지 못한 파일: ${unavailable.slice(0, 8).map(
            (entry) => entry.bodyFileName
          ).join(", ")}`,
          "error"
        );
        return false;
      }
      const unlinked = entries.filter((entry) => entry.bodyStatus === "unlinked-md");
      if (unlinked.length && !window.confirm(
        `${unlinked.length}개 항목 옆에 연결되지 않은 MD가 있습니다. 현재 JSON 본문으로 계속할까요?`
      )) return false;
    }
    return true;
  }

  async function copyPlatform(action: LorebookPlatformAction) {
    const entries = manager.savedState.entries;
    if (!await validate(action, entries)) return;
    const script = buildRplayLorebookScript(buildRplayData(entries, manager.savedState.bodyLimit), manager.savedState.bodyLimit);
    await copyLorebookText(script);
    manager.announce(
      `${platformLabel(action)}용 로어북 스크립트 ${entries.length}개 항목 복사됨`
    );
  }

  return { copyPlatform };
}
