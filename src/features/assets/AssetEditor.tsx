import { AutoTextarea } from "../workspace/AutoTextarea";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  compileAssetPreview,
  type AssetPreviewMode,
  type AssetPreviewValue,
  type AssetPreviewVariable
} from "./model";
import { AssetVariables } from "./AssetVariables";

type AssetEditorProps = {
  name: string;
  content: string;
  variables: AssetPreviewVariable[];
  mockData: Record<string, AssetPreviewValue>;
  previewMode: AssetPreviewMode;
  variableStatus: "idle" | "loading" | "error";
  variableMessage: string;
  disabled: boolean;
  onContentChange: (content: string) => void;
  onMockChange: (variable: string, value: AssetPreviewValue) => void;
  onMockReset: () => void;
};

export function AssetEditor({
  name,
  content,
  variables,
  mockData,
  previewMode,
  variableStatus,
  variableMessage,
  disabled,
  onContentChange,
  onMockChange,
  onMockReset
}: AssetEditorProps) {
  const [previewHeight, setPreviewHeight] = useState(420);
  const [previewRevision, setPreviewRevision] = useState(0);
  const previewFrameRef = useRef<HTMLIFrameElement>(null);
  const previousMockDataRef = useRef(mockData);
  const isRplay = previewMode === "rplay";
  const preview = useMemo(
    () => isRplay ? content : compileAssetPreview(content, mockData),
    [content, isRplay, mockData]
  );

  function injectRplayVariables() {
    if (!isRplay) return;
    const target = previewFrameRef.current?.contentWindow;
    if (!target) return;
    target.postMessage({ type: "update_variables", variables: mockData }, "*");
    target.postMessage({
      type: "onUpdateData",
      statusViewData: mockData,
      data: mockData
    }, "*");
  }

  useEffect(() => {
    const previous = previousMockDataRef.current;
    const clearedRuntimeValue = isRplay && Object.entries(mockData).some(
      ([name, value]) => value === ""
        && previous[name] !== undefined
        && previous[name] !== ""
    );
    previousMockDataRef.current = mockData;
    if (clearedRuntimeValue) {
      setPreviewRevision((current) => current + 1);
      return;
    }
    injectRplayVariables();
  }, [isRplay, mockData]);

  if (!name) {
    return (
      <section className="asset-empty-editor">
        <span>HTML</span>
        <strong>편집할 에셋을 선택하세요</strong>
        <p>오른쪽 사이드바의 파일 목록에서 템플릿을 고르면 코드, 변수, 결과 미리보기가 열립니다.</p>
      </section>
    );
  }

  return (
    <div className="asset-editor-stack">
      <AssetVariables
        message={variableMessage}
        mode={previewMode}
        status={variableStatus}
        variables={variables}
        values={mockData}
        onChange={onMockChange}
        onReset={onMockReset}
      />

      <section className="asset-preview-panel">
        <div className="asset-panel-heading">
          <div>
            <span>LIVE PREVIEW</span>
            <strong>렌더링 결과</strong>
          </div>
          <small>{isRplay ? "알플레이 런타임 변수 주입" : "스크립트 실행 차단"}</small>
        </div>
        <div className="asset-preview-canvas">
          <iframe
            key={previewRevision}
            ref={previewFrameRef}
            height={isRplay ? 720 : previewHeight}
            onLoad={(event) => {
              if (isRplay) {
                injectRplayVariables();
                return;
              }
              try {
                const document = event.currentTarget.contentDocument;
                if (!document) return;
                const nextHeight = Math.max(
                  document.body?.scrollHeight ?? 0,
                  document.documentElement?.scrollHeight ?? 0,
                  380
                );
                setPreviewHeight(Math.min(nextHeight + 24, 900));
              } catch {
                setPreviewHeight(420);
              }
            }}
            sandbox={isRplay ? "allow-scripts" : "allow-same-origin"}
            srcDoc={preview}
            title={`${name} 미리보기`}
          />
        </div>
      </section>

      <section className="asset-code-panel">
        <div className="asset-panel-heading">
          <div>
            <span>HTML SOURCE</span>
            <strong>{name}</strong>
          </div>
          <small>{content.length.toLocaleString("ko-KR")}자</small>
        </div>
        <AutoTextarea
          aria-label={`${name} HTML 코드`}
          disabled={disabled}
          spellCheck={false}
          value={content}
          onChange={(event) => onContentChange(event.target.value)}
        />
      </section>
    </div>
  );
}
