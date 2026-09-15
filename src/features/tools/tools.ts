export type ToolDefinition = {
  id: string;
  label: string;
  shortLabel: string;
  path: string;
  description: string;
  group: "캐릭터" | "작품" | "플랫폼";
};

export const tools: ToolDefinition[] = [
  {
    id: "settings",
    label: "캐릭터 설정",
    shortLabel: "설",
    path: "설정",
    description: "이름, 역할, 배경, 소개와 캐릭터별 프롬프트를 관리합니다.",
    group: "캐릭터"
  },
  {
    id: "prompts",
    label: "작품 프롬프트",
    shortLabel: "프",
    path: "프롬프트",
    description: "시작·일반 노드의 메인 프롬프트와 월드스토리를 관리합니다.",
    group: "작품"
  },
  {
    id: "lorebook",
    label: "로어북",
    shortLabel: "로",
    path: "로어북",
    description: "설정집 항목, 호출 키워드와 플랫폼 동기화를 관리합니다.",
    group: "작품"
  },
  {
    id: "assets",
    label: "HTML 에셋",
    shortLabel: "에",
    path: "에셋",
    description: "HTML 에셋 템플릿을 편집하고 결과를 미리 봅니다.",
    group: "작품"
  },
  {
    id: "hubs",
    label: "허브 관리",
    shortLabel: "허",
    path: "허브",
    description: "허브 원본 데이터와 대상별 IN 연결, 스토리 OUT 연결을 관리합니다.",
    group: "플랫폼"
  },
  {
    id: "rplay",
    label: "알플레이 캔버스",
    shortLabel: "알",
    path: "알플레이",
    description: "캔버스 콘텐츠를 편집하고 왕복 과정의 잘림과 누락을 검사합니다.",
    group: "플랫폼"
  },
];

export const toolGroups: ToolDefinition["group"][] = ["캐릭터", "작품", "플랫폼"];

export const toolNavigationRows: ToolDefinition["group"][][] = [
  ["캐릭터", "작품"],
  ["플랫폼"]
];
