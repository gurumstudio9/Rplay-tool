import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";

const activeWorkStorageKey = "rplay-canvas-active-work-v1";
const activePlatformStorageKey = "rplay-canvas-active-platform-v1";

export type Work = {
  id: string;
  name: string;
  platforms: string[];
};

type WorkStatus = "loading" | "ready" | "offline";

type WorkContextValue = {
  works: Work[];
  activeWorkId: string;
  activePlatformId: string;
  activeWork?: Work;
  status: WorkStatus;
  setActiveWorkId: (workId: string) => void;
  addWork: (workName: string) => Promise<void>;
  renameWork: (workId: string, workName: string, folderId: string) => Promise<Work>;
  storageKey: (toolKey: string) => string;
  registerWorkspaceGuard: (guard: () => boolean) => () => void;
};

const fallbackWork: Work = {
  id: "default",
  name: "기본",
  platforms: ["알플레이"]
};

const WorkContext = createContext<WorkContextValue | null>(null);

function storedWorkId() {
  return window.localStorage.getItem(activeWorkStorageKey) ?? "";
}

function isWork(value: unknown): value is Work {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<Work>;
  return typeof candidate.id === "string"
    && candidate.id.length > 0
    && typeof candidate.name === "string"
    && candidate.name.length > 0;
}

async function fetchWorks(signal: AbortSignal): Promise<Work[]> {
  const response = await fetch("/api/works", { signal });
  if (!response.ok) {
    throw new Error(`작품 목록 요청 실패: ${response.status}`);
  }

  const payload: unknown = await response.json();
  if (!payload || typeof payload !== "object" || !("works" in payload)) {
    return [];
  }

  const works = (payload as { works?: unknown }).works;
  return Array.isArray(works)
    ? works.filter(isWork).map((w) => ({
        ...w,
        platforms: ["알플레이"]
      }))
    : [];
}

export function WorkProvider({ children }: { children: ReactNode }) {
  const [works, setWorks] = useState<Work[]>([fallbackWork]);
  const [activeWorkId, setActiveWorkIdState] = useState(storedWorkId() || fallbackWork.id);
  const activePlatformId = "알플레이";
  const [status, setStatus] = useState<WorkStatus>("loading");
  const workspaceGuardRef = useRef<(() => boolean) | null>(null);
  const registerWorkspaceGuard = useCallback((guard: () => boolean) => {
    workspaceGuardRef.current = guard;
    return () => {
      if (workspaceGuardRef.current === guard) workspaceGuardRef.current = null;
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    void fetchWorks(controller.signal)
      .then((loadedWorks) => {
        const nextWorks = loadedWorks.length > 0 ? loadedWorks : [fallbackWork];
        const savedWorkId = storedWorkId();
        const nextActiveWorkId = nextWorks.some((work) => work.id === savedWorkId)
          ? savedWorkId
          : nextWorks[0].id;

        const nextPlatformId = "알플레이";

        setWorks(nextWorks);
        setActiveWorkIdState(nextActiveWorkId);
        window.localStorage.setItem(activeWorkStorageKey, nextActiveWorkId);
        window.localStorage.setItem(activePlatformStorageKey, nextPlatformId);
        setStatus("ready");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        console.warn("기존 관리툴 서버에서 작품 목록을 불러오지 못했습니다.", error);
        setStatus("offline");
      });

    return () => controller.abort();
  }, []);

  const setActiveWorkId = useCallback((workId: string) => {
    const work = works.find((w) => w.id === workId);
    if (!work) return;
    const newPlatformId = "알플레이";
    if ((workId !== activeWorkId || newPlatformId !== activePlatformId)
      && workspaceGuardRef.current && !workspaceGuardRef.current()) return;
    setActiveWorkIdState(workId);
    window.localStorage.setItem(activeWorkStorageKey, workId);
    window.localStorage.setItem(activePlatformStorageKey, newPlatformId);
  }, [works, activeWorkId, activePlatformId]);

  const addWork = useCallback(async (workName: string) => {
    if (workspaceGuardRef.current && !workspaceGuardRef.current()) return;
    const res = await fetch("/api/works", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: workName })
    });
    if (!res.ok) throw new Error("작품 추가 실패");

    const data = await res.json() as { work?: Work; works?: Work[] };
    if (!data.work) throw new Error("작품 추가 응답이 올바르지 않습니다.");

    const nextPlatformId = "알플레이";
    setWorks((prev) => data.works?.length ? data.works : [...prev, data.work as Work]);
    setActiveWorkIdState(data.work.id);
    window.localStorage.setItem(activeWorkStorageKey, data.work.id);
    window.localStorage.setItem(activePlatformStorageKey, nextPlatformId);
  }, []);

  const renameWork = useCallback(async (
    workId: string,
    workName: string,
    folderId: string
  ) => {
    if (workspaceGuardRef.current && !workspaceGuardRef.current()) throw new Error("작품 이름 변경을 취소했습니다.");
    const res = await fetch(`/api/works/${encodeURIComponent(workId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: workName, id: folderId })
    });
    const data = await res.json() as {
      error?: string;
      work?: Work;
      works?: Work[];
    };
    if (!res.ok) throw new Error(data.error || "작품 이름 변경 실패");
    if (!data.work) throw new Error("작품 이름 변경 응답이 올바르지 않습니다.");

    setWorks((prev) => data.works?.length
      ? data.works
      : prev.map((work) => work.id === workId ? data.work as Work : work)
    );
    setActiveWorkIdState((current) => {
      if (current !== workId) return current;
      window.localStorage.setItem(activeWorkStorageKey, data.work!.id);
      return data.work!.id;
    });
    return data.work;
  }, []);

  const storageKey = useCallback((toolKey: string) => {
    return `${toolKey}::${activeWorkId}::${activePlatformId}`;
  }, [activeWorkId, activePlatformId]);

  const value = useMemo<WorkContextValue>(() => ({
    works,
    activeWorkId,
    activePlatformId,
    activeWork: works.find((work) => work.id === activeWorkId),
    status,
    setActiveWorkId,
    addWork,
    renameWork,
    storageKey,
    registerWorkspaceGuard
  }), [activeWorkId, activePlatformId, addWork, renameWork, setActiveWorkId, status, storageKey, works, registerWorkspaceGuard]);

  return <WorkContext.Provider value={value}>{children}</WorkContext.Provider>;
}

export function useWorks() {
  const context = useContext(WorkContext);
  if (!context) {
    throw new Error("useWorks는 WorkProvider 안에서 사용해야 합니다.");
  }
  return context;
}
