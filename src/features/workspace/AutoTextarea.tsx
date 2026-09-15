import { forwardRef, useCallback, useLayoutEffect, useRef, type TextareaHTMLAttributes } from "react";

/** Grow with loaded text, edits and available width; only the page needs to scroll. */
export const AutoTextarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function AutoTextarea({ onChange, style, ...props }, forwardedRef) {
    const elementRef = useRef<HTMLTextAreaElement | null>(null);
    const resize = useCallback(() => {
      const element = elementRef.current;
      if (!element || !element.getClientRects().length) return;
      const computed = getComputedStyle(element);
      const border = parseFloat(computed.borderTopWidth) + parseFloat(computed.borderBottomWidth);
      element.style.height = "0px";
      element.style.height = `${element.scrollHeight + border}px`;
    }, []);

    useLayoutEffect(resize, [resize, props.value, props.defaultValue]);
    useLayoutEffect(() => {
      const element = elementRef.current;
      if (!element) return;
      let lastWidth = -1;
      const observer = new ResizeObserver(([entry]) => {
        if (entry.contentRect.width === lastWidth) return;
        lastWidth = entry.contentRect.width;
        resize();
      });
      observer.observe(element);
      return () => observer.disconnect();
    }, [resize]);

    return <textarea
      {...props}
      ref={(element) => {
        elementRef.current = element;
        if (typeof forwardedRef === "function") forwardedRef(element);
        else if (forwardedRef) forwardedRef.current = element;
      }}
      data-auto-textarea
      style={{ ...style, overflow: "hidden", resize: "none", maxHeight: "none" }}
      onChange={(event) => {
        resize();
        onChange?.(event);
      }}
    />;
  }
);
