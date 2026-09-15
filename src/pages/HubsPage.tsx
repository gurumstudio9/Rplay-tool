import { useEffect, useState } from "react";
import { useBlocker } from "react-router";
import { loadHubCatalog, loadHubData, saveHubData } from "../features/hubs/api";
import { createHub, emptyHubData, hubSelection, inputLabels, inputTypes, setHubTargets, targetsWithMissing, type HubCatalog, type HubData, type HubDirection, type HubInputType, type HubRecord } from "../features/hubs/model";
import { lorebookTypeOptions } from "../features/lorebook/model";
import { SidebarSection, ToolbarSlot } from "../features/workspace/WorkspaceSidebar";
import { useWorks } from "../features/works/WorkContext";
import "../styles/hubs.css";

export function HubsPage() {
  const { activeWorkId, activePlatformId, activeWork } = useWorks();
  const workKey = `${activeWorkId}::${activePlatformId}`;
  return <HubWorkspace key={workKey} workKey={workKey} workName={activeWork?.name ?? "현재 작품"} />;
}

function HubWorkspace({ workKey, workName }: { workKey: string; workName: string }) {
  const [data, setData] = useState<HubData>(emptyHubData);
  const [saved, setSaved] = useState<HubData>(emptyHubData);
  const [catalog, setCatalog] = useState<HubCatalog>({ lorebook: [], character: [], updateRule: [], story: [] });
  const [selectedId, setSelectedId] = useState("");
  const [newName, setNewName] = useState("");
  const [direction, setDirection] = useState<HubDirection>("in");
  const [type, setType] = useState<HubInputType>("lorebook");
  const [category, setCategory] = useState("all");
  const [query, setQuery] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [revision, setRevision] = useState(0);
  const [message, setMessage] = useState("허브 데이터를 불러오는 중입니다.");
  const dirty = JSON.stringify(data) !== JSON.stringify(saved);
  const blocker = useBlocker(dirty && !saving);
  const selected = data.hubs.find((hub) => hub.id === selectedId) ?? data.hubs[0];

  useEffect(() => {
    const controller = new AbortController();
    setLoaded(false);
    Promise.all([loadHubData(workKey, controller.signal), loadHubCatalog(workKey, controller.signal)])
      .then(([next, targets]) => {
        if (controller.signal.aborted) return;
        setData(next); setSaved(next); setCatalog(targets); setLoaded(true); setMessage("허브 데이터 연결됨");
      }).catch((error) => { if (!controller.signal.aborted) setMessage(error instanceof Error ? error.message : "허브 데이터를 불러오지 못했습니다."); });
    return () => controller.abort();
  }, [workKey, revision]);

  useEffect(() => {
    if (!dirty) return;
    const guard = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [dirty]);

  function updateHub(next: HubRecord) {
    setData((current) => ({ ...current, hubs: current.hubs.map((hub) => hub.id === next.id ? next : hub) }));
    setMessage("미저장 변경사항");
  }
  async function save() {
    if (!loaded || saving) return;
    const snapshot = structuredClone(data);
    setSaving(true);
    try { await saveHubData(workKey, snapshot); setSaved(snapshot); setMessage("허브 데이터를 저장했습니다."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "허브 저장에 실패했습니다."); }
    finally { setSaving(false); }
  }
  const selectedTargets = selected ? hubSelection(selected, direction, type) : [];
  const targets = targetsWithMissing(catalog[direction === "out" ? "story" : type], selectedTargets);
  const filtered = targets.filter((target) => (category === "all" || target.category === category || target.missing)
    && `${target.name} ${target.detail ?? ""} ${target.id}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const selectableIds = filtered.filter((target) => !target.missing).map((target) => target.id);
  const visibleSelected = filtered.filter((target) => selectedTargets.includes(target.id)).length;
  function setTargets(ids: string[], checked: boolean) { if (selected && !saving) updateHub(setHubTargets(selected, direction, type, ids, checked)); }

  return <div className="hubs-page">
    <SidebarSection order={10}>
      <h1>허브 관리</h1><p>{workName}의 허브와 IN·OUT 연결을 관리합니다.</p>
      <p>허브 {data.hubs.length}개</p>
    </SidebarSection>
    <SidebarSection order={20} title="허브 추가">
      <form className="hubs-create" onSubmit={(event) => {
        event.preventDefault();
        if (!loaded || saving || !newName.trim()) return;
        const hub = createHub(newName);
        setData((current) => ({ ...current, hubs: [...current.hubs, hub] })); setSelectedId(hub.id); setNewName(""); setMessage("미저장 변경사항");
      }}>
        <label>새 허브 이름<input value={newName} onChange={(event) => setNewName(event.target.value)} disabled={!loaded || saving} /></label>
        <button type="submit" disabled={!loaded || saving || !newName.trim()}>허브 추가</button>
      </form>
    </SidebarSection>
    <SidebarSection order={21} title="허브 목록">
      <div className="hubs-list">
        {data.hubs.map((hub) => <button type="button" key={hub.id} aria-pressed={hub.id === selected?.id} disabled={saving} onClick={() => setSelectedId(hub.id)}>
          <strong>{hub.name || "이름 없는 허브"}</strong>
          <small>IN {inputTypes.reduce((n, kind) => n + hub.inputs[kind].length, 0)} · OUT {hub.outputs.story.length}</small>
        </button>)}
      </div>
    </SidebarSection>
    <ToolbarSlot slot="save"><button type="button" disabled={!loaded || !dirty || saving} onClick={() => void save()}>{saving ? "저장 중…" : "저장"}</button></ToolbarSlot>
    <ToolbarSlot slot="status"><span role="status">{dirty && message !== "미저장 변경사항" ? "미저장 변경사항 · " : ""}{message}</span></ToolbarSlot>
    <SidebarSection order={22} title="관리">
      <button type="button" className="hubs-action" disabled={!dirty || saving} onClick={() => { setData(saved); setMessage("저장된 내용으로 되돌렸습니다."); }}>변경 되돌리기</button>
      {selected && <button type="button" className="hubs-action" disabled={saving} onClick={() => { setData((current) => ({ ...current, hubs: current.hubs.filter((hub) => hub.id !== selected.id) })); setMessage("허브를 목록에서 제외했습니다. 저장 전에는 되돌릴 수 있습니다."); }}>선택 허브 삭제</button>}
    </SidebarSection>
    {blocker.state === "blocked" && <div className="hubs-notice" role="alert">
      저장하지 않은 허브 변경사항이 있습니다.
      <button type="button" onClick={() => blocker.reset()}>계속 편집</button>
      <button type="button" onClick={() => blocker.proceed()}>저장하지 않고 이동</button>
    </div>}
    {!loaded ? <div className="hubs-empty"><p>{message}</p><button type="button" onClick={() => setRevision((n) => n + 1)}>다시 불러오기</button></div>
      : !selected ? <div className="hubs-empty"><h2>허브를 추가하세요</h2><p>왼쪽에서 허브를 만든 뒤 IN 대상과 OUT 스토리를 선택합니다.</p></div>
      : <>
        <header className="hubs-header"><h2>{selected.name || "이름 없는 허브"}</h2><span>{direction === "in" ? "IN · 대상 → 허브" : "OUT · 허브 → 스토리"}</span></header>
        <div className="hubs-editor">
          <section className="hubs-targets" aria-label={direction === "in" ? "IN 연결 대상" : "OUT 연결 스토리"}>
            <h3>{direction === "in" ? "연결할 대상" : "연결할 스토리"}</h3>
            <div className="hubs-filters">
              {direction === "in" && <label>대상 타입<select value={type} onChange={(event) => { setType(event.target.value as HubInputType); setCategory("all"); setQuery(""); }}>
                {inputTypes.map((kind) => <option key={kind} value={kind}>{inputLabels[kind]}</option>)}
              </select></label>}
              {direction === "in" && type === "lorebook" && <label>로어북 분류<select value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">분류 전체</option>{lorebookTypeOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>}
              {direction === "out" && <label>스토리 종류<select value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">전체</option><option value="start">시작 노드</option><option value="normal">일반 노드</option></select></label>}
              <label>대상 검색<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="이름·키워드 검색" /></label>
            </div>
            <div className="hubs-bulk">
              <button type="button" disabled={saving || !selectableIds.length} onClick={() => setTargets(selectableIds, true)}>현재 목록 전체 선택</button>
              <button type="button" disabled={saving || !visibleSelected} onClick={() => setTargets(filtered.map((target) => target.id), false)}>현재 목록 선택 해제</button>
              <span>{visibleSelected} / {filtered.length} 선택</span>
            </div>
            <div className="hubs-checklist">
              {!filtered.length && <p className="hubs-empty-list">해당 조건의 대상이 없습니다.</p>}
              {filtered.map((target) => <label key={target.id} className={target.missing ? "hubs-target is-missing" : "hubs-target"}>
                <input type="checkbox" disabled={saving} checked={selectedTargets.includes(target.id)} onChange={(event) => setTargets([target.id], event.target.checked)} />
                <span><strong>{target.name}</strong>{target.detail && <small>{target.detail}</small>}</span>
              </label>)}
            </div>
          </section>
          <section className="hubs-selected" aria-label="선택한 허브">
            <div className="hubs-mode" role="group" aria-label="연결 방향">
              <button type="button" aria-pressed={direction === "in"} onClick={() => { setDirection("in"); setCategory("all"); setQuery(""); }}>IN · 연결 대상</button>
              <button type="button" aria-pressed={direction === "out"} onClick={() => { setDirection("out"); setCategory("all"); setQuery(""); }}>OUT · 스토리</button>
            </div>
            <div className="hubs-node">
              <span className="hubs-node-icon" aria-hidden="true">{direction === "in" ? "→" : "←"}</span>
              <label>허브 이름<input value={selected.name} disabled={saving} onChange={(event) => updateHub({ ...selected, name: event.target.value })} /></label>
              <dl>{inputTypes.map((kind) => <div key={kind}><dt>{inputLabels[kind]}</dt><dd>{selected.inputs[kind].length}개</dd></div>)}<div><dt>연결 스토리</dt><dd>{selected.outputs.story.length}개</dd></div></dl>
            </div>
            <p>{direction === "in" ? "왼쪽에서 이 허브에 묶을 대상을 체크하세요. 타입을 바꿔도 다른 타입의 선택은 유지됩니다." : "왼쪽에서 이 허브를 사용할 스토리를 체크하세요. IN 대상 설정은 유지됩니다."}</p>
          </section>
        </div>
      </>}
  </div>;
}
