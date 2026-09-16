import { useEffect, useState } from "react";
import { HelpButton } from "../help/HelpButton";

type DirectoryState = { currentPath: string; savedPath: string; defaultPath: string; source: string; canChange: boolean; cancelled?: boolean };

export function DataDirectorySettings() {
  const [data, setData] = useState<DirectoryState | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/data-directory", { signal: controller.signal }).then(async (response) => {
      const result = await response.json();
      if (!response.ok) throw new Error(response.status === 404
        ? "새 데이터 폴더 설정을 사용하려면 기존 서버를 종료한 뒤 실행.cmd로 다시 실행해 주세요."
        : result.error || "데이터 폴더를 확인하지 못했습니다.");
      setData(result);
    }).catch((reason) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "데이터 폴더를 확인하지 못했습니다."); });
    return () => controller.abort();
  }, []);
  async function change(action: "pick" | "reset") {
    setPending(true); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/data-directory/${action}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "데이터 폴더 설정을 저장하지 못했습니다.");
      setData(result);
      if (!result.cancelled) setMessage("다음 실행부터 적용됩니다. 종료.cmd로 종료한 뒤 실행.cmd를 다시 실행하세요.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "데이터 폴더 설정을 저장하지 못했습니다."); }
    finally { setPending(false); }
  }
  return <details>
    <summary>데이터 폴더</summary>
    <div className="feature-help-context">저장 위치 변경 <HelpButton topic="directory" /></div>
    {data ? <>
      <p style={{ overflowWrap: "anywhere" }}>현재 위치: {data.currentPath}</p>
      {data.canChange && data.savedPath !== data.currentPath && <p style={{ overflowWrap: "anywhere" }}>다음 실행 위치: {data.savedPath}</p>}
      {!data.canChange && <p>환경변수로 데이터 폴더가 지정되어 있습니다. 실행 환경 설정에서 변경해 주세요.</p>}
      <button type="button" disabled={pending || !data.canChange} onClick={() => void change("pick")}>{pending ? "처리 중…" : "폴더 변경"}</button>{" "}
      <button type="button" disabled={pending || !data.canChange} onClick={() => void change("reset")}>기본 위치 사용</button>
      <p>폴더를 변경해도 기존 데이터는 이동하거나 복사하지 않습니다.</p>
    </> : !error && <p>데이터 폴더 확인 중…</p>}
    {error && <p role="alert">{error}</p>}
    {message && <p role="status">{message}</p>}
  </details>;
}
