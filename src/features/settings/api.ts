import { readStorage, writeStorage } from "../../api/storage";
import {
  normalizeCharacter,
  type CharacterRecord
} from "./model";

const rosterKey = "character-manager-roster-v1";

type JsonRecord = Record<string, unknown>;

export async function loadCharacters(workId: string, signal?: AbortSignal) {
  const stored = await readStorage<unknown[]>(rosterKey, workId, [], signal);
  return Array.isArray(stored)
    ? stored.map(normalizeCharacter).filter((character) => character.id)
    : [];
}

export async function saveCharacterHeight(workId: string, characterId: string, heightCm: number | null) {
  if (heightCm !== null && (!Number.isInteger(heightCm) || heightCm < 1 || heightCm > 999)) {
    throw new Error("키는 1~999cm의 정수로 입력하세요.");
  }
  const stored = await readStorage<JsonRecord[]>(rosterKey, workId, []);
  if (!Array.isArray(stored) || !stored.some(character => character.id === characterId)) {
    throw new Error("키를 수정할 캐릭터 설정을 찾지 못했습니다.");
  }
  const next = stored.map(character => character.id === characterId ? { ...character, heightCm } : character);
  await writeStorage(rosterKey, workId, next);
  return next.map(normalizeCharacter).filter(character => character.id);
}

export async function saveCharacters(workId: string, characters: CharacterRecord[]) {
  const normalized = characters.map(normalizeCharacter).filter((character) => character.id);
  await writeStorage(rosterKey, workId, normalized);
}
