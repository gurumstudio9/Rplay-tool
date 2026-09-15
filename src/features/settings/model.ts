export const groupLabels = {
  core: "핵심",
  additional: "추가",
  candidate: "후보",
  other: "기타"
} as const;

export const genderLabels = {
  female: "여성",
  male: "남성",
  other: "기타",
  unspecified: "미지정"
} as const;

export type CharacterGroup = keyof typeof groupLabels;
export type CharacterGender = keyof typeof genderLabels;

export const editableFields = [
  "englishName",
  "folderCode",
  "faction",
  "role",
  "background",
  "introduction",
  "prompt",
  "notes"
] as const;

export type EditableField = typeof editableFields[number];

export type CharacterRecord = {
  id: string;
  name: string;
  group: CharacterGroup;
  gender: CharacterGender;
  heightCm: number | null;
  headAccessoryHeightCm: number | null;
  bustSize: string;
  hairColor: string;
  hairLength: string;
  hairStyle: string;
  eyeColor: string;
  skinColor: string;
  aliases: string[];
  englishName: string;
  folderCode: string;
  faction: string;
  role: string;
  background: string;
  introduction: string;
  prompt: string;
  notes: string;
  [key: string]: unknown;
};

export type CharacterForm = {
  id: string;
  name: string;
  group: CharacterGroup;
  gender: CharacterGender;
  heightCm: string;
  headAccessoryHeightCm: string;
  bustSize: string;
  hairColor: string;
  hairLength: string;
  hairStyle: string;
  eyeColor: string;
  skinColor: string;
  aliases: string;
} & Record<EditableField, string>;

const legacyReferenceFields = ["redFlags", "firstScene", "forbidden"] as const;
const legacyPromptFields = ["statusMessage", "journal"] as const;
const removedCharacterFields = [
  "coreConcept",
  "personality",
  "userRelation",
  "appearance",
  "voice"
] as const;
const specializedFields = new Set([
  "archetype",
  "scores",
  "profile",
  "hairDetail",
  "faceDetail",
  "bodyDetail",
  "outfitDetail",
  "accessoryDetail",
  "extraTags",
  "promptOverride",
  "appearanceOnly",
  "appearanceWithOutfit",
  "appearanceWithWeapon",
  "upperClothing",
  "lowerClothing",
  "accessories",
  "shoes",
  "weapons",
  "note",
  "checks"
]);

const summaryFields: Array<[string, EditableField]> = [
  ["소속", "faction"],
  ["역할/신분", "role"],
  ["배경", "background"],
  ["소개", "introduction"],
  ["프롬프트", "prompt"],
  ["메모", "notes"]
];

export function text(value: unknown) {
  return String(value ?? "").trim();
}

export function normalizeList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return [...new Set(value.flatMap((item) => normalizeList(item)))];
  }
  return String(value ?? "")
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function makeId(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase()
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "") || `character-${Date.now()}`;
}

export function normalizeGroup(value: unknown): CharacterGroup {
  const group = text(value).toLocaleLowerCase();
  if (group in groupLabels) return group as CharacterGroup;
  if (group === "new") return "additional";
  return "other";
}

export function normalizeGender(value: unknown): CharacterGender {
  const gender = text(value).normalize("NFKC").toLocaleLowerCase();
  if (["female", "f", "woman", "여", "여성", "여자", "女"].includes(gender)) return "female";
  if (["male", "m", "man", "남", "남성", "남자", "男"].includes(gender)) return "male";
  if (["other", "nonbinary", "non-binary", "기타", "논바이너리"].includes(gender)) return "other";
  return "unspecified";
}

export function normalizeHeightCm(value: unknown): number | null {
  const match = String(value ?? "").match(/\d+(?:\.\d+)?/);
  if (!match) return null;
  const height = Math.round(Number(match[0]));
  return Number.isFinite(height) && height > 0 && height <= 999 ? height : null;
}

function normalizeHeadAccessoryHeightCm(value: unknown): number | null {
  const match = String(value ?? "").match(/\d+(?:\.\d+)?/);
  if (!match) return null;
  const height = Math.round(Number(match[0]) * 10) / 10;
  return Number.isFinite(height) && height > 0 && height <= 999 ? height : null;
}

function sourceRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export function normalizeCharacter(value: unknown): CharacterRecord {
  const source = sourceRecord(value);
  const name = text(source.name || source.id || "이름 없음");
  const id = makeId(source.id || name);
  const normalized = {
    ...source,
    id,
    name,
    group: normalizeGroup(source.group),
    gender: normalizeGender(source.gender),
    heightCm: normalizeHeightCm(source.heightCm),
    headAccessoryHeightCm: normalizeHeadAccessoryHeightCm(source.headAccessoryHeightCm),
    bustSize: text(source.bustSize),
    hairColor: text(source.hairColor),
    hairLength: text(source.hairLength),
    hairStyle: text(source.hairStyle),
    eyeColor: text(source.eyeColor),
    skinColor: text(source.skinColor),
    aliases: normalizeList([id, name, source.aliases])
  } as CharacterRecord;

  editableFields.forEach((field) => {
    normalized[field] = text(source[field]);
  });
  normalized.introduction = text(source.introduction || source.statusMessage);
  normalized.prompt = text(source.prompt || source.journal);
  removedCharacterFields.forEach((field) => delete normalized[field]);
  specializedFields.forEach((field) => delete normalized[field]);
  return normalized;
}

export function emptyCharacterForm(): CharacterForm {
  return {
    id: "",
    name: "",
    group: "candidate",
    gender: "unspecified",
    heightCm: "",
    headAccessoryHeightCm: "",
    bustSize: "",
    hairColor: "",
    hairLength: "",
    hairStyle: "",
    eyeColor: "",
    skinColor: "",
    aliases: "",
    englishName: "",
    folderCode: "",
    faction: "",
    role: "",
    background: "",
    introduction: "",
    prompt: "",
    notes: ""
  };
}

export function referenceFieldValue(character: CharacterRecord, field: EditableField) {
  return text(character[field]);
}

export function characterToForm(character: CharacterRecord): CharacterForm {
  const aliases = normalizeList(character.aliases)
    .filter((alias) => alias !== character.id && alias !== character.name)
    .join(", ");
  const form = {
    id: character.id,
    name: character.name,
    group: normalizeGroup(character.group),
    gender: normalizeGender(character.gender),
    heightCm: character.heightCm ? String(character.heightCm) : "",
    headAccessoryHeightCm: character.headAccessoryHeightCm ? String(character.headAccessoryHeightCm) : "",
    bustSize: text(character.bustSize),
    hairColor: text(character.hairColor),
    hairLength: text(character.hairLength),
    hairStyle: text(character.hairStyle),
    eyeColor: text(character.eyeColor),
    skinColor: text(character.skinColor),
    aliases
  } as CharacterForm;
  editableFields.forEach((field) => {
    form[field] = referenceFieldValue(character, field);
  });
  return form;
}

export function formToCharacter(
  form: CharacterForm,
  previous?: CharacterRecord
): CharacterRecord {
  const name = text(form.name) || text(form.id) || "이름 없음";
  const id = makeId(form.id || name);
  const next = {
    ...(previous ?? {}),
    id,
    name,
    group: normalizeGroup(form.group),
    gender: normalizeGender(form.gender),
    heightCm: normalizeHeightCm(form.heightCm),
    headAccessoryHeightCm: normalizeHeadAccessoryHeightCm(form.headAccessoryHeightCm),
    bustSize: text(form.bustSize),
    hairColor: text(form.hairColor),
    hairLength: text(form.hairLength),
    hairStyle: text(form.hairStyle),
    eyeColor: text(form.eyeColor),
    skinColor: text(form.skinColor),
    aliases: normalizeList([id, name, form.aliases])
  } as CharacterRecord;

  editableFields.forEach((field) => {
    next[field] = text(form[field]);
  });
  removedCharacterFields.forEach((field) => delete next[field]);
  legacyReferenceFields.forEach((field) => delete next[field]);
  legacyPromptFields.forEach((field) => delete next[field]);
  return normalizeCharacter(next);
}

export function formatCharacterSummary(character: CharacterRecord) {
  const lines = [
    `# 캐릭터 설정: ${character.name}`,
    `- ID: ${character.id}`,
    `- 분류: ${groupLabels[character.group]}`,
    `- 성별: ${genderLabels[character.gender]}`,
    `- 키: ${character.heightCm ? `${character.heightCm}cm` : "-"}`,
    `- 머리장식 높이: ${character.headAccessoryHeightCm ? `${character.headAccessoryHeightCm}cm` : "-"}`,
    `- 가슴 크기: ${character.bustSize || "-"}`,
    `- 머리색: ${character.hairColor || "-"}`,
    `- 머리길이: ${character.hairLength || "-"}`,
    `- 머리모양: ${character.hairStyle || "-"}`,
    `- 눈색: ${character.eyeColor || "-"}`,
    `- 피부색: ${character.skinColor || "-"}`,
    `- 별칭: ${normalizeList(character.aliases).join(", ") || "-"}`
  ];
  summaryFields.forEach(([label, field]) => {
    const value = referenceFieldValue(character, field);
    if (value) lines.push("", `## ${label}`, value);
  });
  return lines.join("\n");
}

export function characterSearchText(character: CharacterRecord) {
  return [
    character.id,
    character.name,
    character.group,
    groupLabels[character.group],
    character.gender,
    genderLabels[character.gender],
    character.heightCm,
    character.headAccessoryHeightCm,
    character.bustSize,
    character.hairColor,
    character.hairLength,
    character.hairStyle,
    character.eyeColor,
    character.skinColor,
    normalizeList(character.aliases).join(" "),
    ...editableFields.map((field) => referenceFieldValue(character, field)),
    ...legacyReferenceFields.map((field) => text(character[field])),
    ...legacyPromptFields.map((field) => text(character[field]))
  ].join("\n").toLocaleLowerCase("ko-KR");
}

export function filterCharacters(
  characters: CharacterRecord[],
  query: string,
  group: CharacterGroup | "all",
  gender: CharacterGender | "all"
) {
  const normalizedQuery = text(query).toLocaleLowerCase("ko-KR");
  return characters.filter((character) => {
    if (group !== "all" && character.group !== group) return false;
    if (gender !== "all" && character.gender !== gender) return false;
    return !normalizedQuery || characterSearchText(character).includes(normalizedQuery);
  });
}
