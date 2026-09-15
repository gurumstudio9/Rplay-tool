import {
  multilineAssetVariables,
  type AssetPreviewMode,
  type AssetPreviewValue,
  type AssetPreviewVariable
} from "./model";

type AssetVariablesProps = {
  variables: AssetPreviewVariable[];
  values: Record<string, AssetPreviewValue>;
  mode: AssetPreviewMode;
  status: "idle" | "loading" | "error";
  message: string;
  onChange: (variable: string, value: AssetPreviewValue) => void;
  onReset: () => void;
};

export function AssetVariables({
  variables,
  values,
  mode,
  status,
  message,
  onChange,
  onReset
}: AssetVariablesProps) {
  const isRplay = mode === "rplay";

  return (
    <section className="asset-variable-panel">
      <div className="asset-variable-heading">
        <div>
          <span>{isRplay ? "RPLAY VARIABLES" : "PREVIEW VARIABLES"}</span>
          <strong>{isRplay ? "알플레이 변수값 주입" : "미리보기 샘플 값"}</strong>
        </div>
        {variables.length ? (
          <button type="button" onClick={onReset}>
            {isRplay ? "초기값 복원" : "샘플값 복원"}
          </button>
        ) : null}
      </div>
      {status === "loading" ? (
        <p>알플레이 변수 목록을 불러오는 중입니다.</p>
      ) : status === "error" ? (
        <p className="asset-variable-error">{message}</p>
      ) : variables.length ? (
        <div className="asset-variable-grid">
          {variables.map((variable) => {
            const value = values[variable.name] ?? variable.initialValue;
            const multiline = variable.type === "string" && (
              multilineAssetVariables.has(variable.name)
              || String(value).includes("\n")
              || String(value).length > 60
            );
            return (
              <label className={multiline ? "asset-variable-wide" : ""} key={variable.name}>
                <span className="asset-variable-label">
                  <code>{variable.name}</code>
                  {isRplay && variable.title !== variable.name ? <small>{variable.title}</small> : null}
                </span>
                {variable.type === "boolean" ? (
                  <select
                    value={String(value)}
                    onChange={(event) => onChange(variable.name, event.target.value === "true")}
                  >
                    <option value="true">true</option>
                    <option value="false">false</option>
                  </select>
                ) : multiline ? (
                  <textarea
                    rows={2}
                    value={String(value)}
                    onChange={(event) => onChange(variable.name, event.target.value)}
                  />
                ) : (
                  <input
                    type={variable.type === "number" ? "number" : "text"}
                    value={String(value)}
                    onChange={(event) => onChange(
                      variable.name,
                      variable.type === "number" && event.target.value !== ""
                        ? Number(event.target.value)
                        : event.target.value
                    )}
                  />
                )}
              </label>
            );
          })}
        </div>
      ) : (
        <p>
          {isRplay
            ? "대화 프롬프트의 변수 및 규칙에 등록된 알플레이 변수가 없습니다."
            : <>HTML 코드에서 {"{{변수명}}"} 형식의 변수를 찾지 못했습니다.</>}
        </p>
      )}
    </section>
  );
}
