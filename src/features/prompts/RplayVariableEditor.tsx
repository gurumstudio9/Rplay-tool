import { SidebarSection } from "../workspace/WorkspaceSidebar";
import { AutoTextarea } from "../workspace/AutoTextarea";
import { useRplayVariables } from "./useRplayVariables";
import type { RplayVariableType } from "./model";
import "../../styles/prompts-variables.css";

export function RplayVariableEditor({
  workKey
}: {
  workKey: string;
}) {
  const {
    data,
    saveState,
    statusMessage,
    addVariable,
    updateVariable,
    deleteVariable,
    addRule,
    updateRule,
    deleteRule
  } = useRplayVariables(workKey);
  const variableNames = [...new Set(
    data.variables
      .map((variable) => variable.variableName.trim())
      .filter(Boolean)
  )];

  return (
    <div className="rplay-variables-container">
      {/* 트랙 1: 변수 목록 패널 */}
      <section className="rplay-var-left-panel">
        <SidebarSection order={25}><header className="rplay-var-header">
          <div className="rplay-var-header-title">
            <h2>변수 목록</h2>
            <span className="rplay-var-badge">{data.variables.length}개</span>
          </div>
          <button
            type="button"
            className="rplay-var-add-btn"
            onClick={addVariable}
          >
            + 변수 추가
          </button>
        </header></SidebarSection>

        <div className="rplay-var-list-scroll">
          {data.variables.length === 0 ? (
            <div className="rplay-var-empty">
              <p>등록된 변수가 없습니다.</p>
              <span>우측 상단의 <strong>+ 변수 추가</strong> 버튼을 눌러 새 변수를 추가하세요.</span>
            </div>
          ) : (
            <div className="rplay-var-table-wrapper">
              <table className="rplay-var-table">
                <thead>
                  <tr>
                    <th style={{ width: "110px" }}>타입</th>
                    <th style={{ width: "140px" }}>제목 (라벨)</th>
                    <th style={{ width: "140px" }}>이름 (식별자)</th>
                    <th style={{ minWidth: "120px" }}>초기값</th>
                    <th style={{ width: "50px", textAlign: "center" }}>삭제</th>
                  </tr>
                </thead>
                <tbody>
                  {data.variables.map((v) => (
                    <tr key={v.id}>
                      {/* 1. 타입 */}
                      <td>
                        <select
                          className="rplay-var-select"
                          value={v.variableType}
                          onChange={(e) =>
                            updateVariable(v.id, {
                              variableType: e.target.value as RplayVariableType
                            })
                          }
                        >
                          <option value="string">문자열 (string)</option>
                          <option value="number">숫자 (number)</option>
                          <option value="boolean">불리안 (boolean)</option>
                        </select>
                      </td>

                      {/* 2. 제목 */}
                      <td>
                        <input
                          type="text"
                          className="rplay-var-input"
                          placeholder="라벨 (예: 소지금)"
                          value={v.title}
                          onChange={(e) => updateVariable(v.id, { title: e.target.value })}
                        />
                      </td>

                      {/* 3. 이름 */}
                      <td>
                        <input
                          type="text"
                          className="rplay-var-input"
                          placeholder="식별자 (예: gold)"
                          value={v.variableName}
                          onChange={(e) => updateVariable(v.id, { variableName: e.target.value })}
                        />
                      </td>

                      {/* 4. 초기값 */}
                      <td>
                        {v.variableType === "boolean" ? (
                          <div className="rplay-var-bool-toggle">
                            <button
                              type="button"
                              className={`rplay-var-bool-btn ${v.initValue === true ? "is-true" : ""}`}
                              onClick={() => updateVariable(v.id, { initValue: true })}
                            >
                              True
                            </button>
                            <button
                              type="button"
                              className={`rplay-var-bool-btn ${v.initValue === false ? "is-false" : ""}`}
                              onClick={() => updateVariable(v.id, { initValue: false })}
                            >
                              False
                            </button>
                          </div>
                        ) : v.variableType === "number" ? (
                          <input
                            type="number"
                            className="rplay-var-input"
                            placeholder="0"
                            value={typeof v.initValue === "number" ? v.initValue : Number(v.initValue) || 0}
                            onChange={(e) =>
                              updateVariable(v.id, {
                                initValue: Number(e.target.value) || 0
                              })
                            }
                          />
                        ) : (
                          <input
                            type="text"
                            className="rplay-var-input"
                            placeholder="기본 텍스트"
                            value={String(v.initValue ?? "")}
                            onChange={(e) => updateVariable(v.id, { initValue: e.target.value })}
                          />
                        )}
                      </td>

                      {/* 5. 삭제 */}
                      <td style={{ textAlign: "center" }}>
                        <button
                          type="button"
                          className="rplay-var-del-btn"
                          title="변수 삭제"
                          onClick={() => deleteVariable(v.id)}
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <SidebarSection order={25}><footer className="rplay-var-footer-status">
          <span>
            {saveState === "saving" ? "저장 중..." : saveState === "saved" ? "모든 변경사항 저장됨" : statusMessage || "알플레이 변수 목록"}
          </span>
          <span className="rplay-var-hint">
            변수 호출: <code>&#123;&#123;var_변수명&#125;&#125;</code>
          </span>
        </footer></SidebarSection>
      </section>

      {/* 트랙 2: 제목별 업데이트 규칙 Markdown 패널 */}
      <section className="rplay-var-right-panel">
        <SidebarSection order={25}><header className="rplay-var-header">
          <div className="rplay-var-header-title">
            <h2>업데이트 규칙 (Markdown)</h2>
            <span className="rplay-var-badge">{data.updateRules.length}개</span>
          </div>
          <button type="button" className="rplay-var-add-btn" onClick={addRule}>
            + 규칙 추가
          </button>
        </header></SidebarSection>

        <div className="rplay-var-list-scroll">
          {data.updateRules.length === 0 ? (
            <div className="rplay-var-empty">
              <p>등록된 업데이트 규칙이 없습니다.</p>
              <span><strong>+ 규칙 추가</strong> 버튼으로 제목별 MD를 만드세요.</span>
            </div>
          ) : (
            <div className="rplay-rules-list">
              {data.updateRules.map((rule) => {
                const tokenCount = Math.ceil(rule.text.length / 1.5);
                const connectedVariables = new Set(rule.variables);
                const unconnectedVariables = variableNames.filter(
                  (variableName) => !connectedVariables.has(variableName)
                );
                return (
                  <div key={rule.id} className="rplay-rule-card">
                    <div className="rplay-rule-card-header">
                      <input
                        type="text"
                        className="rplay-rule-title-input"
                        placeholder="규칙 제목"
                        value={rule.title}
                        onChange={(e) => updateRule(rule.id, { title: e.target.value })}
                      />
                      <div className="rplay-rule-card-tools">
                        <span className="rplay-rule-counter">
                          {rule.text.length}자 · 약 {tokenCount}토큰
                        </span>
                        <button
                          type="button"
                          className="rplay-var-del-btn"
                          title="규칙 MD 삭제"
                          onClick={() => deleteRule(rule.id)}
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                    <div className="rplay-rule-variable-row">
                      <div className="rplay-rule-variable-heading">
                        <strong>연결 변수</strong>
                        <span><b>+</b> 연결 · <b>−</b> 해제</span>
                      </div>
                      <div className="rplay-rule-variable-transfer">
                        <section aria-label={`${rule.title} 연결 안 된 변수`}>
                          <header>
                            <span>A</span>
                            <strong>연결 안 됨</strong>
                            <small>{unconnectedVariables.length}</small>
                          </header>
                          <div className="rplay-rule-variable-list">
                            {unconnectedVariables.length ? unconnectedVariables.map((variableName) => (
                              <button
                                type="button"
                                key={variableName}
                                aria-label={`${variableName} 연결`}
                                onClick={() => updateRule(rule.id, {
                                  variables: [...rule.variables, variableName]
                                })}
                              >
                                <span>{variableName}</span>
                                <b aria-hidden="true">+</b>
                              </button>
                            )) : (
                              <p>연결할 변수가 없습니다.</p>
                            )}
                          </div>
                        </section>

                        <section aria-label={`${rule.title} 연결된 변수`}>
                          <header>
                            <span>B</span>
                            <strong>연결됨</strong>
                            <small>{rule.variables.length}</small>
                          </header>
                          <div className="rplay-rule-variable-list is-connected">
                            {rule.variables.length ? rule.variables.map((variableName) => (
                              <button
                                type="button"
                                key={variableName}
                                aria-label={`${variableName} 연결 해제`}
                                onClick={() => updateRule(rule.id, {
                                  variables: rule.variables.filter((name) => name !== variableName)
                                })}
                              >
                                <span>{variableName}</span>
                                <b aria-hidden="true">−</b>
                              </button>
                            )) : (
                              <p>연결된 변수가 없습니다.</p>
                            )}
                          </div>
                        </section>
                      </div>
                    </div>
                    <AutoTextarea
                      className="rplay-rule-textarea"
                      placeholder="이 규칙의 Markdown 본문을 작성하세요..."
                      value={rule.text}
                      onChange={(e) => updateRule(rule.id, { text: e.target.value })}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <footer className="rplay-var-rules-footer">
          <p>
            💡 <strong>+</strong>로 연결하고 <strong>−</strong>로 해제합니다. 연결 정보는 <code>prompts/updateRules/규칙 제목.md</code>에 함께 저장됩니다.
          </p>
        </footer>
      </section>
    </div>
  );
}
