import { useWorks } from "../works/WorkContext";
import { promptTabLabels } from "./model";

export function usePromptLabels() {
  const { activePlatformId } = useWorks();
  return activePlatformId === "알플레이" ? {
    ...promptTabLabels,
    worldStory: "전체 스토리",
    additionalPrompt: "에디셔널",
    starterPrompt: "시작 가이드"
  } : promptTabLabels;
}
