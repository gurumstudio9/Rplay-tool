import { useEffect, useState } from "react";

interface PromptTokenUsageProps {
  text: string;
  combinedText?: string;
  storageKey: string;
  defaultLimit?: number;
}

type TokenResult = {
  text: string;
  combinedText?: string;
  current: number;
  total: number;
};

export function PromptTokenUsage({
  text,
  combinedText,
  storageKey,
  defaultLimit
}: PromptTokenUsageProps) {
  const [limitInput, setLimitInput] = useState(() => {
    try {
      return localStorage.getItem(storageKey) ?? String(defaultLimit ?? "");
    } catch {
      return String(defaultLimit ?? "");
    }
  });
  const [result, setResult] = useState<TokenResult | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    const timer = window.setTimeout(() => {
      void import("gpt-tokenizer/encoding/o200k_base").then(({ countTokens }) => {
        if (cancelled) return;
        const options = { disallowedSpecial: new Set<string>() };
        const current = countTokens(text, options);
        const total = combinedText === undefined ? current : countTokens(combinedText, options);
        setResult({ text, combinedText, current, total });
      }).catch(() => {
        if (!cancelled) setFailed(true);
      });
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [text, combinedText]);

  const ready = result?.text === text && result?.combinedText === combinedText;
  const limit = Number(limitInput);
  const hasLimit = Number.isSafeInteger(limit) && limit > 0;
  const total = ready ? result.total : null;
  const exceeded = total !== null && hasLimit && total > limit;
  const percentage = total !== null && hasLimit ? total / limit * 100 : null;
  const format = (value: number) => value.toLocaleString("ko-KR");

  function changeLimit(value: string) {
    setLimitInput(value);
    try {
      localStorage.setItem(storageKey, value);
    } catch {
      // The current limit remains usable when browser storage is unavailable.
    }
  }

  return (
    <section className={`prompt-token-usage${exceeded ? " is-over-limit" : ""}`} aria-label="알플레이 토큰 사용량">
      <div className="prompt-token-summary" aria-live="polite">
        <strong>{failed ? "토큰 계산 실패" : ready ? `현재 본문 ${format(result.current)}토큰` : "토큰 계산 중…"}</strong>
        {ready && combinedText !== undefined ? <span>각 노드의 메인 + 에디셔널 {format(result.total)}토큰</span> : null}
        <small>o200k_base · 변수 치환 전</small>
      </div>
      <label className="prompt-token-limit">
        기준 한도
        <input
          type="number"
          min="1"
          step="1"
          aria-label="토큰 기준 한도"
          placeholder="미설정"
          value={limitInput}
          onChange={event => changeLimit(event.target.value)}
        />
        토큰
      </label>
      {percentage !== null && total !== null ? (
        <div className="prompt-token-budget">
          <progress aria-label="토큰 한도 사용률" value={Math.min(total, limit)} max={limit} />
          <span>{percentage.toLocaleString("ko-KR", { maximumFractionDigits: 1 })}% · {format(Math.abs(limit - total))}토큰 {exceeded ? "초과" : "남음"}</span>
        </div>
      ) : null}
      {failed ? <span role="alert">새로고침 후 다시 확인해 주세요.</span> : null}
    </section>
  );
}
