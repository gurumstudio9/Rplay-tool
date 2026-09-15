import { useEffect, useMemo, useState } from "react";
import { loadHubCatalog, loadHubData } from "../hubs/api";
import { inputLabels, type HubCatalog, type HubRecord } from "../hubs/model";
import { addRegisteredHub, connectRegisteredHub, planHubImport } from "./canvasHubImport";
import type { JsonObject } from "./model";
import { hubBatchItems } from "./canvasBatch";
import { RplayCanvasBatchPanel } from "./RplayCanvasBatchPanel";

type Props = {
  workId: string;
  canvas: JsonObject;
  onApply: (canvas: JsonObject, message: string) => void;
};

export function RplayCanvasHubImport({ workId, canvas, onApply }: Props) {
  const [hubs, setHubs] = useState<HubRecord[]>([]);
  const [catalog, setCatalog] = useState<HubCatalog | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setCatalog(null);
    void Promise.all([loadHubData(workId, controller.signal), loadHubCatalog(workId, controller.signal)])
      .then(([data, sources]) => {
        if (controller.signal.aborted) return;
        setHubs(data.hubs);
        setCatalog(sources);
        setSelectedId((current) => data.hubs.some((hub) => hub.id === current) ? current : data.hubs[0]?.id ?? "");
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "허브 원본을 불러오지 못했습니다.");
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [workId, revision]);

  const hub = hubs.find((entry) => entry.id === selectedId);
  const plan = useMemo(() => hub && catalog ? planHubImport(canvas, hub, catalog) : null, [canvas, hub, catalog]);

  function apply(action: "add" | "connect") {
    if (!hub || !catalog) return;
    setError("");
    try {
      if (action === "add") {
        const next = addRegisteredHub(canvas, hub);
        onApply(next, `${hub.name}: 허브 노드를 추가했습니다.`);
      } else {
        const result = connectRegisteredHub(canvas, hub, catalog);
        onApply(result.canvas, `${hub.name}: 연결 ${result.added}개를 추가했습니다.`);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "허브를 적용하지 못했습니다.");
    }
  }

  return (
    <div className="rplay-content-workspace rplay-hub-import">
      {!loading && catalog ? <RplayCanvasBatchPanel canvas={canvas} items={hubBatchItems(canvas, hubs)} onApply={onApply} /> : null}
      <div className="rplay-content-toolbar">
        <label>
          저장된 허브
          <select aria-label="캔버스에 적용할 허브" value={selectedId} disabled={loading || !catalog || !hubs.length}
            onChange={(event) => { setSelectedId(event.target.value); setError(""); }}>
            {!hubs.length ? <option value="">등록된 허브 없음</option> : null}
            {hubs.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
          </select>
        </label>
        <button type="button" className="rplay-secondary-button" disabled={loading} onClick={() => setRevision((value) => value + 1)}>
          저장된 허브 새로고침
        </button>
      </div>
      {loading ? <p>저장된 허브와 연결 대상을 불러오는 중입니다.</p> : null}
      {error ? <p role="alert" className="rplay-hub-import-error">{error}</p> : null}
      {!loading && catalog && !hubs.length ? <p>상단 허브 관리에서 허브와 연결 대상을 등록하고 저장해 주세요.</p> : null}
      {!loading && hub && plan ? <>
        <p>로어북·인물·업데이트 규칙은 기존 탭에서 추가한 뒤, 여기서 허브를 추가하고 마지막에 연결합니다.</p>
        <div className="rplay-content-toolbar">
          <button type="button" className="rplay-secondary-button" disabled={!!plan.hubUid || !!plan.hubError} onClick={() => apply("add")}>
            {plan.hubUid ? "허브 추가됨" : "허브 추가"}
          </button>
          <button type="button" className="rplay-primary-button" disabled={!plan.hubUid || !!plan.errors.length || !plan.missingLinks.length} onClick={() => apply("connect")}>
            허브 연결
          </button>
          <span>{!plan.hubUid ? "허브 노드를 추가해 주세요." : plan.errors.length ? "연결 대상을 확인해 주세요." : plan.missingLinks.length ? `추가할 연결 ${plan.missingLinks.length}개` : "추가할 연결 없음"}</span>
        </div>
        <div className="rplay-content-table-wrap">
          <table className="rplay-content-table">
            <thead><tr><th>방향</th><th>타입</th><th>등록된 연결 대상</th><th>캔버스 확인</th></tr></thead>
            <tbody>
              {[...plan.inputs, ...plan.stories].map((entry) => <tr key={`${entry.type}:${entry.id}`}>
                <td>{entry.type === "story" ? "허브 → 스토리" : "대상 → 허브"}</td>
                <td>{entry.type === "story" ? "스토리" : inputLabels[entry.type]}</td>
                <td>{entry.name}</td>
                <td>{entry.error || "노드 있음"}</td>
              </tr>)}
              {!plan.inputs.length && !plan.stories.length ? <tr><td colSpan={4}>저장된 연결 대상이 없습니다.</td></tr> : null}
            </tbody>
          </table>
        </div>
        {plan.hubError ? <p role="alert" className="rplay-hub-import-error">{plan.hubError}</p> : null}
      </> : null}
    </div>
  );
}
