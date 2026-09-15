import { useLayoutEffect, useRef, type CSSProperties } from "react";
import { WorkspaceSidebarContext, sidebarOrders, rightSidebarOrders } from "../features/workspace/WorkspaceSidebar";
import { useMemo, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router";
import { ToolIcon } from "../features/tools/ToolIcon";
import { toolNavigationRows, tools } from "../features/tools/tools";
import { useWorks, type Work } from "../features/works/WorkContext";
import { DataDirectorySettings } from "../features/workspace/DataDirectorySettings";

function connectionLabel(status: "loading" | "ready" | "offline") {
  if (status === "ready") return "기존 데이터 연결됨";
  if (status === "offline") return "기존 서버 연결 필요";
  return "데이터 확인 중";
}

const workInitials = ["ㄱ", "ㄴ", "ㄷ", "ㄹ", "ㅁ", "ㅂ", "ㅅ", "ㅇ", "ㅈ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"] as const;
const hangulChoseong = ["ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"] as const;
const doubledInitials: Record<string, string> = {
  "ㄲ": "ㄱ",
  "ㄸ": "ㄷ",
  "ㅃ": "ㅂ",
  "ㅆ": "ㅅ",
  "ㅉ": "ㅈ"
};

function workInitial(value: string) {
  const first = value.trim().normalize("NFC").charAt(0);
  if (!first) return "#";
  const code = first.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) {
    const initial = hangulChoseong[Math.floor((code - 0xac00) / 588)];
    return doubledInitials[initial] ?? initial;
  }
  if (/^[a-z]$/i.test(first)) return "A–Z";
  return "#";
}

export function AppShell() {
  const [sidebarHosts, setSidebarHosts] = useState<Partial<Record<number, HTMLElement | null>>>({});
  const sidebarRefs = useMemo(() => Object.fromEntries(sidebarOrders.map((order) => [
    order,
    (element: HTMLDivElement | null) => setSidebarHosts((current) => current[order] === element
      ? current : { ...current, [order]: element })
  ])), []);
  const headerRef = useRef<HTMLElement>(null);
  const [headerHeight, setHeaderHeight] = useState(169);
  useLayoutEffect(() => {
    const header = headerRef.current;
    if (!header) return;
    const measure = () => setHeaderHeight(header.getBoundingClientRect().height);
    const observer = new ResizeObserver(measure);
    measure();
    observer.observe(header);
    return () => observer.disconnect();
  }, []);
  const sidebarRef = useRef<HTMLElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const actionSidebarRef = useRef<HTMLElement>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { pathname } = useLocation();
  useLayoutEffect(() => {
    sidebarRef.current?.scrollTo(0, 0);
    mainRef.current?.scrollTo(0, 0);
    actionSidebarRef.current?.scrollTo(0, 0);
    setSidebarOpen(false);
  }, [pathname]);
  const {
    works,
    activeWorkId,
    activePlatformId,
    activeWork,
    setActiveWorkId,
    addWork,
    renameWork,
    status
  } = useWorks();

  const [newWorkInput, setNewWorkInput] = useState("");
  const [showWorkPicker, setShowWorkPicker] = useState(false);
  const [showAddWork, setShowAddWork] = useState(false);
  const [addingWork, setAddingWork] = useState(false);
  const [workQuery, setWorkQuery] = useState("");
  const [workInitialFilter, setWorkInitialFilter] = useState("전체");
  const [showEditWork, setShowEditWork] = useState(false);
  const [editingWorkId, setEditingWorkId] = useState("");
  const [editWorkNameInput, setEditWorkNameInput] = useState("");
  const [editWorkFolderInput, setEditWorkFolderInput] = useState("");
  const [editingWork, setEditingWork] = useState(false);
  const searchedWorks = useMemo(() => {
    const query = workQuery.trim().toLocaleLowerCase("ko-KR");
    if (!query) return works;
    return works.filter((work) => (
      work.name.toLocaleLowerCase("ko-KR").includes(query)
      || work.id.toLocaleLowerCase("ko-KR").includes(query)
    ));
  }, [workQuery, works]);
  const filteredWorks = useMemo(() => (
    workInitialFilter === "전체"
      ? searchedWorks
      : searchedWorks.filter((work) => workInitial(work.name) === workInitialFilter)
  ), [searchedWorks, workInitialFilter]);
  const availableInitials = useMemo<Set<string>>(
    () => new Set(works.map((work) => workInitial(work.name))),
    [works]
  );
  const editingWorkTarget = works.find((work) => work.id === editingWorkId);

  async function handleAddWork() {
    const name = newWorkInput.trim();
    if (!name) return;
    setAddingWork(true);
    try {
      await addWork(name);
      setNewWorkInput("");
      setShowAddWork(false);
      setShowWorkPicker(false);
      setWorkQuery("");
      setWorkInitialFilter("전체");
    } catch {
      alert("작품 추가에 실패했습니다. 같은 이름의 작품이 이미 있는지 확인해 주세요.");
    } finally {
      setAddingWork(false);
    }
  }

  function openEditWork(work: Work) {
    setEditingWorkId(work.id);
    setEditWorkNameInput(work.name);
    setEditWorkFolderInput(work.id);
    setShowAddWork(false);
    setShowEditWork(true);
  }

  async function handleEditWork() {
    const name = editWorkNameInput.trim();
    const folderId = editWorkFolderInput.trim();
    if (!editingWorkTarget || !name || !folderId) return;
    const folderChanged = folderId !== editingWorkTarget.id;
    if (folderChanged && !window.confirm(
      `실제 작품 폴더를 '${editingWorkTarget.id}'에서 '${folderId}'(으)로 변경합니다. 계속할까요?`
    )) return;

    setEditingWork(true);
    try {
      const work = await renameWork(editingWorkTarget.id, name, folderId);
      setEditWorkNameInput(work.name);
      setEditWorkFolderInput(work.id);
      setEditingWorkId("");
      setShowEditWork(false);
      setWorkQuery("");
    } catch (error) {
      alert(error instanceof Error ? error.message : "작품 이름 변경에 실패했습니다.");
    } finally {
      setEditingWork(false);
    }
  }

  return (
    <WorkspaceSidebarContext value={sidebarHosts}>
    <div className="app-shell" style={{ "--workspace-header-height": `${headerHeight}px` } as CSSProperties}>
      <aside id="workspace-tools" className={`workspace-sidebar${sidebarOpen ? " is-open" : ""}`} aria-label="현재 화면 도구" ref={sidebarRef}>
        <div className="workspace-identity">
          <NavLink className="brand" to="/" aria-label="알플레이 캔버스툴 홈">
            <span className="brand-mark" aria-hidden="true">R</span>
            <span className="brand-copy">
              <strong>알플레이 캔버스툴</strong>
              <small>캔버스 구성과 프롬프트</small>
            </span>
          </NavLink>
        </div>
        <div className="workspace-sidebar-content">
          {sidebarOrders.filter((order) => order >= 10 && order !== 30 && !rightSidebarOrders.includes(order)).map((order) => (
            <div className="workspace-sidebar-slot" key={order} ref={sidebarRefs[order]} />
          ))}
        </div>
      </aside>
      <header className="app-header" ref={headerRef}>
        <div className="tool-nav-stack">
          {toolNavigationRows.map((groups) => (
            <nav
              className="tool-nav"
              aria-label="캔버스 구성 도구"
              key={groups.join("-")}
            >
              {groups.map((group) => (
                <div className="tool-nav-group" key={group}>
                  <strong className="tool-nav-group-label">{group}</strong>
                  {tools
                    .filter((tool) => tool.group === group)
                    .map((tool) => (
                      <NavLink
                        key={tool.id}
                        to={`/${tool.path}`}
                        className={({ isActive }) => isActive ? "tool-nav-link is-active" : "tool-nav-link"}
                      >
                        <span aria-hidden="true"><ToolIcon id={tool.id} /></span>
                        {tool.label}
                      </NavLink>
                    ))}
                </div>
              ))}
            </nav>
          ))}
        </div>
        <div className="work-control">
          <span className="work-label">작품</span>
          <button
            className="work-picker-trigger"
            aria-haspopup="dialog"
            aria-expanded={showWorkPicker}
            onClick={() => setShowWorkPicker(true)}
            type="button"
            disabled={status === "loading"}
          >
            <span>
              <small>현재 작품</small>
              <strong>{activeWork?.name ?? "작품 선택"}</strong>
            </span>
            <span aria-hidden="true">⌄</span>
          </button>

          <span className="work-label">{activePlatformId} 전용</span>

          <span className={`connection-status connection-status--${status}`}>
            <span aria-hidden="true" />
            {connectionLabel(status)}
          </span>
        </div>
      </header>
      <aside className="workspace-sidebar workspace-action-sidebar" aria-label="현재 화면 작업 버튼" ref={actionSidebarRef}>
        <div className="workspace-sidebar-top" ref={sidebarRefs[3]} />
        <div className="workspace-toolbar" role="region" aria-label="현재 화면 주요 작업">
          <button className="workspace-sidebar-toggle" type="button" aria-expanded={sidebarOpen}
            aria-controls="workspace-tools" onClick={() => setSidebarOpen((open) => !open)}>설정·필터</button>
          <div className="workspace-toolbar-status" role="status" ref={sidebarRefs[1]} />
          <div className="workspace-toolbar-save" ref={sidebarRefs[2]} />
          <div className="workspace-toolbar-actions" ref={sidebarRefs[0]} />
        </div>
        <section className="workspace-management" aria-label="관리">
          <h2>관리</h2>
          <DataDirectorySettings />
          <div className="workspace-sidebar-slot" ref={sidebarRefs[30]} />
        </section>
        <div className="workspace-sidebar-content">
          {rightSidebarOrders.map((order) => (
            <div className="workspace-sidebar-slot" key={order} ref={sidebarRefs[order]} />
          ))}
        </div>
      </aside>

      {showWorkPicker ? (
        <div
          className="work-picker-overlay"
          role="presentation"
          onMouseDown={() => setShowWorkPicker(false)}
          onKeyDown={(event) => {
            if (event.key === "Escape") setShowWorkPicker(false);
          }}
        >
          <section
            className="work-picker-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="work-picker-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <span>
                <small>작품 관리</small>
                <strong id="work-picker-title">작품 선택</strong>
              </span>
              <button
                className="work-picker-close"
                type="button"
                aria-label="작품 선택 닫기"
                onClick={() => setShowWorkPicker(false)}
              >
                ×
              </button>
            </header>

            <div className="work-picker-search">
              <input
                aria-label="작품 이름 또는 폴더명 검색"
                placeholder="작품 이름 또는 폴더명 검색"
                type="search"
                value={workQuery}
                onChange={(event) => setWorkQuery(event.target.value)}
                autoFocus
              />
              <span>{filteredWorks.length}개 작품</span>
            </div>

            <div className="work-picker-initials" aria-label="작품명 초성 선택">
              {["전체", ...workInitials, "A–Z", "#"].map((initial) => (
                <button
                  className={workInitialFilter === initial ? "is-active" : ""}
                  type="button"
                  key={initial}
                  disabled={initial !== "전체" && !availableInitials.has(initial)}
                  aria-pressed={workInitialFilter === initial}
                  onClick={() => setWorkInitialFilter(initial)}
                >
                  {initial}
                </button>
              ))}
            </div>

            {showEditWork && editingWorkTarget ? (
              <div className="work-picker-editor">
                <div>
                  <small>작품 정보 수정</small>
                  <strong>{editingWorkTarget.name}</strong>
                </div>
                <label>
                  <span>화면에 보이는 작품명</span>
                  <input
                    aria-label="표시 작품명 수정"
                    disabled={editingWork}
                    value={editWorkNameInput}
                    onChange={(event) => setEditWorkNameInput(event.target.value)}
                  />
                </label>
                <label>
                  <span>실제 작품 폴더명</span>
                  <input
                    aria-label="실제 작품 폴더명 수정"
                    disabled={editingWork}
                    value={editWorkFolderInput}
                    onChange={(event) => setEditWorkFolderInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") void handleEditWork();
                    }}
                  />
                </label>
                <p>폴더명을 바꾸면 실제 작품 폴더도 함께 이동합니다.</p>
                <div>
                  <button
                    type="button"
                    disabled={editingWork}
                    onClick={() => {
                      setEditingWorkId("");
                      setShowEditWork(false);
                    }}
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    disabled={editingWork || !editWorkNameInput.trim()
                      || !editWorkFolderInput.trim()}
                    onClick={() => void handleEditWork()}
                  >
                    {editingWork ? "변경 중…" : "이름과 폴더 변경"}
                  </button>
                </div>
              </div>
            ) : showAddWork ? (
              <div className="work-picker-add">
                <label>
                  <span>새 작품명</span>
                  <input
                    type="text"
                    aria-label="새 작품명"
                    placeholder="새 작품명을 입력하세요"
                    value={newWorkInput}
                    onChange={(event) => setNewWorkInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") void handleAddWork();
                    }}
                    disabled={addingWork}
                    autoFocus
                  />
                </label>
                <div>
                  <button type="button" onClick={() => setShowAddWork(false)} disabled={addingWork}>
                    취소
                  </button>
                  <button type="button" onClick={() => void handleAddWork()} disabled={addingWork || !newWorkInput.trim()}>
                    {addingWork ? "추가 중…" : "작품 추가"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="work-picker-list" role="listbox" aria-label="작품 목록">
                {filteredWorks.length ? filteredWorks.map((work) => {
                  const isActive = work.id === activeWorkId;
                  return (
                    <div className={`work-picker-item${isActive ? " is-active" : ""}`} key={work.id}>
                      <button
                        className="work-picker-item-main"
                        type="button"
                        role="option"
                        aria-selected={isActive}
                        onClick={() => {
                          setActiveWorkId(work.id);
                          setShowWorkPicker(false);
                          setWorkQuery("");
                          setWorkInitialFilter("전체");
                        }}
                      >
                        <span>
                          <strong>{work.name}</strong>
                          <small>폴더 · {work.id}</small>
                        </span>
                        <span className="work-picker-platforms">
                          {work.platforms.map((platform) => (
                            <small key={platform}>{platform}</small>
                          ))}
                        </span>
                      </button>
                      <button
                        className="work-picker-item-edit"
                        type="button"
                        onClick={() => openEditWork(work)}
                      >
                        이름 변경
                      </button>
                    </div>
                  );
                }) : (
                  <div className="work-picker-empty">
                    <strong>검색 결과가 없습니다.</strong>
                    <span>다른 작품명이나 폴더명으로 검색해 보세요.</span>
                  </div>
                )}
              </div>
            )}

            {!showEditWork && !showAddWork ? (
              <footer>
                <button
                  type="button"
                  onClick={() => {
                    setShowEditWork(false);
                    setShowAddWork(true);
                  }}
                >
                  새 작품 추가
                </button>
              </footer>
            ) : null}
          </section>
        </div>
      ) : null}

      <div className="workspace-layout">
        <main className="app-main" id="workspace-content" ref={mainRef}>
          <Outlet />
        </main>
      </div>
    </div>
    </WorkspaceSidebarContext>
  );
}
