import type { SimpleLorebookData } from "./data";

export function buildRplayLorebookScript(
  entries: SimpleLorebookData[],
  bodyLimit: number
) {
  return `(async () => {
  const lorebookData = ${JSON.stringify(entries)};
  const bodyLimit = ${JSON.stringify(bodyLimit)};
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function setValue(element, value) {
    if (!element) return;
    const prototype = Object.getPrototypeOf(element);
    const ownSetter = Object.getOwnPropertyDescriptor(element, "value")?.set;
    const prototypeSetter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
    if (prototypeSetter) prototypeSetter.call(element, value);
    else if (ownSetter) ownSetter.call(element, value);
    else element.value = value;
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function setEditable(element, value) {
    if (!element) return;
    element.focus();
    const lines = String(value || "").split(String.fromCharCode(10));
    const fragments = lines.map((line) => {
      const row = document.createElement("div");
      if (line) row.textContent = line;
      else row.appendChild(document.createElement("br"));
      return row;
    });
    element.replaceChildren(...fragments);
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }

  async function addKeyword(input, keyword) {
    setValue(input, keyword);
    await sleep(30);
    input?.dispatchEvent(new KeyboardEvent("keydown", {
      bubbles: true,
      key: "Enter",
      code: "Enter"
    }));
    input?.dispatchEvent(new KeyboardEvent("keyup", {
      bubbles: true,
      key: "Enter",
      code: "Enter"
    }));
    await sleep(30);
  }

  const normalizeType = (type) => {
    const t = String(type || "").trim().toLowerCase();
    if (t === "mode" || t === "모드" || t === "명령어") return "command";
    if (t === "지침" || t === "지침서") return "instruction";
    if (t === "인물" || t === "캐릭터") return "person";
    if (t === "인물서브" || t === "서브인물") return "person-sub";
    if (t === "설정" || t === "세계관") return "setting";
    if (t === "지역" || t === "장소") return "region";
    if (t === "물건" || t === "아이템") return "item";
    return t;
  };

  const typeOrder = [
    "command",
    "instruction",
    "person",
    "person-sub",
    "person-gimmick",
    "setting",
    "region",
    "region-sub",
    "faction",
    "item",
    "gimmick",
    "other",
    "general"
  ];
  const priority = (type) => {
    const norm = normalizeType(type);
    const rplayPriority = {
      instruction: 80,
      person: 90,
      region: 85,
      "person-sub": 80,
      "person-gimmick": 70
    };
    if (Object.prototype.hasOwnProperty.call(rplayPriority, norm)) {
      return rplayPriority[norm];
    }
    const index = typeOrder.indexOf(norm || "general");
    return index < 0 ? 10 : (typeOrder.length - index) * 10;
  };

  const addButton = Array.from(document.querySelectorAll("button")).find(
    (button) => String(button.textContent || "").includes("매크로 프롬프트 추가")
  );
  if (!addButton) {
    alert("'매크로 프롬프트 추가' 버튼을 찾을 수 없습니다. 알플레이 화면을 확인해 주세요.");
    return;
  }

  const beforeCount = document.querySelectorAll(".lite-lorebook-card").length;
  for (let index = 0; index < lorebookData.length; index++) {
    addButton.click();
    await sleep(150);
  }
  await sleep(1000);

  const cards = Array.from(document.querySelectorAll(".lite-lorebook-card"));
  const targetCards = cards.slice(beforeCount);
  if (targetCards.length < lorebookData.length) {
    console.warn("추가된 알플레이 슬롯 수가 요청보다 적습니다.");
  }

  for (let index = 0; index < lorebookData.length; index++) {
    const item = lorebookData[index];
    const card = targetCards[index] || cards[index];
    if (!card) continue;
    const titleInput = card.querySelector('input[placeholder="매크로 프롬프트 이름 입력"]');
    const keywordInput = card.querySelector('input[placeholder="단어나 문구를 입력하세요..."]');
    const bodyEditable = card.querySelector('div[contenteditable="true"]');
    const priorityLabel = Array.from(card.querySelectorAll("label")).find(
      (label) => String(label.textContent || "").includes("우선순위")
    );
    let priorityInput = priorityLabel?.nextElementSibling?.tagName === "INPUT"
      ? priorityLabel.nextElementSibling
      : card.querySelector('input[type="number"]');

    setValue(titleInput, item.title);
    setValue(priorityInput, String(priority(item.type)));
    setEditable(bodyEditable, String(item.body || "").slice(0, bodyLimit));
    await sleep(30);
    for (const keyword of item.triggers || []) {
      await addKeyword(keywordInput, keyword);
    }
    console.log("[" + (index + 1) + "/" + lorebookData.length + "] 입력 성공: " + item.title);
    await sleep(0);
  }

  alert("알플레이 벌크 입력이 완료되었습니다. 내용을 확인한 뒤 저장해 주세요.");
})().catch((error) => {
  alert("알플레이 로어북 입력 중 오류: " + error.message);
});`;
}
