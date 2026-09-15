import { SidebarSection } from "../workspace/WorkspaceSidebar";
import { useEffect, useState } from "react";
import { loadRplayAchievements, loadRplayVariables, saveRplayAchievements } from "./api";
import type { RplayAchievement, RplayVariable } from "./model";
import "../../styles/prompts-variables.css";

export function RplayAchievementEditor({
  workKey
}: {
  workKey: string;
}) {
  const [achievements, setAchievements] = useState<RplayAchievement[]>([]);
  const [variables, setVariables] = useState<RplayVariable[]>([]);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [statusMessage, setStatusMessage] = useState<string>("");

  useEffect(() => {
    let active = true;
    async function loadData() {
      const [achvList, varData] = await Promise.all([
        loadRplayAchievements(workKey),
        loadRplayVariables(workKey)
      ]);
      if (!active) return;
      setAchievements(achvList);
      setVariables(varData.variables || []);
    }
    void loadData();
    return () => {
      active = false;
    };
  }, [workKey]);

  function addAchievement() {
    const newId = `achv-${Date.now()}`;
    const newEntry: RplayAchievement = {
      id: newId,
      achievementName: `새 업적 ${achievements.length + 1}`,
      description: "업적 달성 설명을 입력하세요.",
      targetVariable: variables[0]?.variableName || "achv",
      conditionType: "equal",
      conditionValue: "1",
      rewardCredits: 10,
      isHidden: false,
      hint: "",
      image: ""
    };
    setAchievements((prev) => [...prev, newEntry]);
    setStatusMessage("새 업적이 추가되었습니다 (저장 필요)");
  }

  function updateAchievement(id: string, patch: Partial<RplayAchievement>) {
    setAchievements((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item))
    );
  }

  function deleteAchievement(id: string) {
    setAchievements((prev) => prev.filter((item) => item.id !== id));
    setStatusMessage("업적이 삭제되었습니다 (저장 필요)");
  }

  async function handleSave() {
    setSaveState("saving");
    setStatusMessage("업적 목록 저장 중...");
    const ok = await saveRplayAchievements(workKey, achievements);
    if (ok) {
      setSaveState("saved");
      setStatusMessage("업적 목록이 성공적으로 저장되었습니다!");
      setTimeout(() => setSaveState("idle"), 2500);
    } else {
      setSaveState("error");
      setStatusMessage("저장 중 오류가 발생했습니다.");
    }
  }

  return (
    <div className="rplay-variables-container" style={{ gridTemplateColumns: "1fr" }}>
      <section className="rplay-var-left-panel" style={{ width: "100%" }}>
        <SidebarSection order={25}><header className="rplay-var-header">
          <div className="rplay-var-header-title">
            <h2>🏆 알플레이 업적 관리</h2>
            <span className="rplay-var-badge">{achievements.length}개 등록됨</span>
            {statusMessage && <span className="rplay-var-toast" style={{ marginLeft: "1rem", fontSize: "0.85rem", color: "#a5b4fc" }}>{statusMessage}</span>}
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              type="button"
              className="rplay-var-add-btn"
              onClick={addAchievement}
            >
              + 업적 추가
            </button>
            <button
              type="button"
              className="rplay-var-add-btn"
              style={{ background: "#4f46e5", borderColor: "#6366f1" }}
              onClick={handleSave}
              disabled={saveState === "saving"}
            >
              {saveState === "saving" ? "저장 중..." : "💾 업적 저장"}
            </button>
          </div>
        </header></SidebarSection>

        <div className="rplay-var-list-scroll">
          {achievements.length === 0 ? (
            <div className="rplay-var-empty">
              <p>등록된 업적이 없습니다.</p>
              <span>우측 상단의 <strong>+ 업적 추가</strong> 버튼을 눌러 새 업적과 트리거 조건을 추가하세요.</span>
            </div>
          ) : (
            <div className="rplay-var-table-wrapper">
              <table className="rplay-var-table">
                <thead>
                  <tr>
                    <th style={{ width: "40px", textAlign: "center" }}>No</th>
                    <th style={{ width: "160px" }}>업적 이름</th>
                    <th style={{ width: "130px" }}>감시 대상 변수</th>
                    <th style={{ width: "120px" }}>조건 유형</th>
                    <th style={{ width: "110px" }}>조건 값</th>
                    <th style={{ width: "80px" }}>보상(C)</th>
                    <th style={{ width: "70px", textAlign: "center" }}>히든</th>
                    <th style={{ minWidth: "220px" }}>달성 설명 & 힌트</th>
                    <th style={{ width: "50px", textAlign: "center" }}>삭제</th>
                  </tr>
                </thead>
                <tbody>
                  {achievements.map((achv, index) => (
                    <tr key={achv.id}>
                      {/* 번호 */}
                      <td style={{ textAlign: "center", color: "#94a3b8", fontWeight: 600 }}>
                        {index + 1}
                      </td>

                      {/* 1. 업적 이름 */}
                      <td>
                        <input
                          type="text"
                          className="rplay-var-input"
                          placeholder="업적 이름"
                          value={achv.achievementName}
                          onChange={(e) =>
                            updateAchievement(achv.id, { achievementName: e.target.value })
                          }
                          style={{ fontWeight: 600 }}
                        />
                      </td>

                      {/* 2. 감시 대상 변수 */}
                      <td>
                        <select
                          className="rplay-var-select"
                          value={achv.targetVariable}
                          onChange={(e) =>
                            updateAchievement(achv.id, { targetVariable: e.target.value })
                          }
                        >
                          {variables.length > 0 ? (
                            variables.map((v) => (
                              <option key={v.id} value={v.variableName}>
                                {v.variableName} ({v.title || v.variableType})
                              </option>
                            ))
                          ) : (
                            <option value="achv">achv (업적)</option>
                          )}
                          {!variables.some((v) => v.variableName === achv.targetVariable) && (
                            <option value={achv.targetVariable}>{achv.targetVariable} (직접지정)</option>
                          )}
                        </select>
                      </td>

                      {/* 3. 조건 유형 */}
                      <td>
                        <select
                          className="rplay-var-select"
                          value={achv.conditionType || "equal"}
                          onChange={(e) =>
                            updateAchievement(achv.id, {
                              conditionType: e.target.value as RplayAchievement["conditionType"]
                            })
                          }
                        >
                          <option value="equal">일치 (equal)</option>
                          <option value="above">이상/초과 (above)</option>
                          <option value="below">이하/미만 (below)</option>
                          {achv.conditionType === "not_equal" && (
                            <option value="not_equal" disabled>기존 불일치 조건 (지원되지 않음)</option>
                          )}
                        </select>
                      </td>

                      {/* 4. 조건 값 */}
                      <td>
                        <input
                          type="text"
                          className="rplay-var-input"
                          placeholder="조건 값 (예: 1, 10000)"
                          value={achv.conditionValue}
                          onChange={(e) =>
                            updateAchievement(achv.id, { conditionValue: e.target.value })
                          }
                        />
                      </td>

                      {/* 5. 보상 크레딧 */}
                      <td>
                        <input
                          type="number"
                          className="rplay-var-input"
                          placeholder="크레딧"
                          value={achv.rewardCredits || 0}
                          onChange={(e) =>
                            updateAchievement(achv.id, { rewardCredits: Number(e.target.value) || 0 })
                          }
                          style={{ textAlign: "right" }}
                        />
                      </td>

                      {/* 6. 히든 여부 */}
                      <td style={{ textAlign: "center" }}>
                        <input
                          type="checkbox"
                          checked={!!achv.isHidden}
                          onChange={(e) =>
                            updateAchievement(achv.id, { isHidden: e.target.checked })
                          }
                          style={{ width: "18px", height: "18px", cursor: "pointer" }}
                        />
                      </td>

                      {/* 7. 달성 설명 & 힌트 */}
                      <td>
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                          <input
                            type="text"
                            className="rplay-var-input"
                            placeholder="달성 시 표시될 상세 설명"
                            value={achv.description}
                            onChange={(e) =>
                              updateAchievement(achv.id, { description: e.target.value })
                            }
                          />
                          <input
                            type="text"
                            className="rplay-var-input"
                            placeholder="미달성 힌트 (선택사항)"
                            value={achv.hint || ""}
                            onChange={(e) =>
                              updateAchievement(achv.id, { hint: e.target.value })
                            }
                            style={{ fontSize: "0.8rem", color: "#94a3b8" }}
                          />
                        </div>
                      </td>

                      {/* 8. 삭제 */}
                      <td style={{ textAlign: "center" }}>
                        <button
                          type="button"
                          className="rplay-var-del-btn"
                          onClick={() => deleteAchievement(achv.id)}
                          title="업적 삭제"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
