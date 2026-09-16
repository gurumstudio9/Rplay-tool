import { usePromptLabels } from "./usePromptLabels";
import { promptTabsForNode, type PromptTab, type PromptNodeType } from "./model";

export function PromptTabs({ activeTab, onChange, nodeType }: {
  activeTab: PromptTab; onChange: (tab: PromptTab) => void; nodeType: PromptNodeType;
}) {
  const promptTabLabels = usePromptLabels();
  const tabs: PromptTab[] = [...promptTabsForNode(nodeType), "variables", "achievements"];
  return <nav className="prompt-tabs" aria-label="노드 편집 항목">
    {tabs.map(tab => <button key={tab} type="button" className={tab === activeTab ? "is-active" : ""}
      aria-pressed={tab === activeTab} onClick={() => onChange(tab)}>
      <span className="prompt-tab-copy"><strong>{promptTabLabels[tab]}</strong></span>
    </button>)}
  </nav>;
}
