export type AssetSummary = {
  name: string;
};

export type AssetStatus = "loading" | "idle" | "saving" | "error";

export type AssetPreviewValue = string | number | boolean;

export type AssetPreviewVariable = {
  name: string;
  title: string;
  type: "string" | "number" | "boolean";
  initialValue: AssetPreviewValue;
};

export type AssetPreviewMode = "slot" | "rplay";

export const assetVariableDefaults: Record<string, string> = {
  date: "2030년 06월 09일 20:00 (밤)",
  gold: "3000",
  gold_diff: "+100",
  inventory: "예시 아이템 1개",
  inv_diff: "+ 예시 아이템 1개",
  prestige: "15",
  prestige_diff: "+5",
  pr: "2",
  income: "110",
  fixed_cost: "50",
  quest: "예시 목표",
  hint: "예시 안내",
  employees: "인물 A, 인물 B",
  relations: "인물 A: 동료\n인물 B: 지인",
  tank1: "예시 항목",
  tank2: "빈곳",
  tank3: "빈곳",
  tank4: "빈곳",
  desc: "미리보기용 설명입니다.",
  item: "예시 아이템",
  price: "1500",
  status: "협상 중",
  vs_title: "예시 장면",
  char_left: "인물 A",
  role_left: "역할 A",
  img_left: "",
  char_right: "인물 B",
  role_right: "역할 B",
  img_right: "",
  vs_desc: "두 인물의 장면 설명입니다."
};

export const multilineAssetVariables = new Set([
  "relations",
  "desc",
  "inventory",
  "quest",
  "hint"
]);

export const initialAssetTemplate = `<!-- Google Fonts -->
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;700;900&family=Noto+Sans+KR:wght@400;700;900&display=swap" rel="stylesheet">

<div style="width: 100%; max-width: 380px; background: linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%); border: 2px solid #00f2fe; border-radius: 16px; padding: 16px; font-family: 'Outfit', 'Noto Sans KR', sans-serif; color: #fff; box-shadow: 0 8px 20px rgba(0, 242, 254, 0.2); margin: 8px auto;">
  <div style="font-size: 10px; color: #00f2fe; font-weight: bold; letter-spacing: 0.1em; text-transform: uppercase;">New Asset Template</div>
  <h3 style="font-size: 18px; margin: 4px 0 12px 0;">{{title}}</h3>

  <div style="background: rgba(0, 242, 254, 0.05); border: 1px solid rgba(0, 242, 254, 0.2); padding: 12px; border-radius: 8px; font-size: 13px; line-height: 1.5;">
    {{content}}
  </div>
</div>`;

export function normalizeAssetName(value: string) {
  const trimmed = value.trim();
  return trimmed && !trimmed.toLocaleLowerCase().endsWith(".html")
    ? `${trimmed}.html`
    : trimmed;
}

export function validateAssetName(value: string) {
  const name = normalizeAssetName(value);
  if (!name) return "파일명을 입력해 주세요.";
  if (name.includes("/") || name.includes("\\") || name.includes("..")) {
    return "경로 문자를 제외한 HTML 파일명만 입력해 주세요.";
  }
  return "";
}

export function extractAssetVariables(html: string) {
  const variables = new Set<string>();
  const regex = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    variables.add(match[1]);
  }
  return [...variables];
}

export function compileAssetPreview(
  html: string,
  mockData: Record<string, AssetPreviewValue>
) {
  return extractAssetVariables(html).reduce((compiled, variable) => {
    const value = mockData[variable] ?? assetVariableDefaults[variable] ?? "";
    const pattern = new RegExp(`\\{\\{\\s*${variable}\\s*\\}\\}`, "g");
    return compiled.replace(pattern, String(value).replace(/\n/g, "<br>"));
  }, html);
}
