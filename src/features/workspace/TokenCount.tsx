import { useEffect, useState } from "react";
import { useWorks } from "../works/WorkContext";

export function TokenCount({ text, limit }: { text: string; limit?: number }) {
  const { activePlatformId } = useWorks();
  const enabled = activePlatformId === "알플레이";
  const [result, setResult] = useState<{ text: string; count: number | null } | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void import("gpt-tokenizer/encoding/o200k_base").then(({ countTokens }) => {
        if (cancelled) return;
        setResult({ text, count: countTokens(text, { disallowedSpecial: new Set<string>() }) });
      }).catch(() => {
        if (!cancelled) setResult({ text, count: null });
      });
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [text, enabled]);

  if (!enabled) return null;
  const label = result?.text !== text
    ? "토큰 계산 중…"
    : result.count === null
      ? "토큰 계산 실패"
      : `${result.count.toLocaleString("ko-KR")}${limit ? ` / ${limit.toLocaleString("ko-KR")}` : ""}토큰`;

  return <span className={`inline-token-count${limit && result?.text === text && result.count !== null && result.count > limit ? " is-warning" : ""}`} title="o200k_base · 변수 치환 전" aria-live="polite"> · {label}</span>;
}
