import {
  useCallback,
  useEffect,
  useRef,
  useState
} from "react";
import type { SaveState } from "../settings/SettingsCommandBar";
import {
  loadRplayUpdateRules,
  loadRplayVariables,
  saveRplayUpdateRules,
  saveRplayVariables
} from "./api";
import type {
  RplayUpdateRule,
  RplayVariable
} from "./model";

type RplayVariableEditorData = {
  variables: RplayVariable[];
  updateRules: RplayUpdateRule[];
};

const emptyData: RplayVariableEditorData = {
  variables: [],
  updateRules: []
};

function generateVarId(): string {
  return `var-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function generateRuleId(): string {
  return `rule-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function useRplayVariables(workKey: string) {
  const [data, setData] = useState<RplayVariableEditorData>(emptyData);
  const [saveState, setSaveState] = useState<SaveState>("loading");
  const [statusMessage, setStatusMessage] = useState("");
  const workKeyRef = useRef(workKey);
  const variableSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ruleSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const saveSeqRef = useRef(0);

  useEffect(() => {
    if (variableSaveTimerRef.current) clearTimeout(variableSaveTimerRef.current);
    if (ruleSaveTimerRef.current) clearTimeout(ruleSaveTimerRef.current);
    const controller = new AbortController();
    workKeyRef.current = workKey;
    setSaveState("loading");
    setStatusMessage("");

    void Promise.all([
      loadRplayVariables(workKey, controller.signal),
      loadRplayUpdateRules(workKey, controller.signal)
    ])
      .then(([variableData, updateRules]) => {
        if (controller.signal.aborted) return;
        setData({ variables: variableData.variables, updateRules });
        setSaveState("idle");
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setSaveState("error");
        setStatusMessage(
          error instanceof Error
            ? error.message
            : "알플레이 변수 또는 업데이트 규칙을 불러오지 못했습니다."
        );
      });

    return () => controller.abort();
  }, [workKey]);

  const enqueueSave = useCallback((
    targetWorkKey: string,
    save: () => Promise<void>
  ) => {
    const seq = ++saveSeqRef.current;
    setSaveState("saving");
    setStatusMessage("");

    const operation = saveQueueRef.current
      .catch(() => undefined)
      .then(save);

    saveQueueRef.current = operation;

    void operation
      .then(() => {
        if (seq === saveSeqRef.current && workKeyRef.current === targetWorkKey) {
          setSaveState("saved");
        }
      })
      .catch((error: unknown) => {
        if (seq === saveSeqRef.current && workKeyRef.current === targetWorkKey) {
          setSaveState("error");
          setStatusMessage(
            error instanceof Error
              ? error.message
              : "알플레이 데이터를 저장하지 못했습니다."
          );
        }
      });
  }, []);

  const replaceVariables = useCallback((
    variables: RplayVariable[],
    immediate = false
  ) => {
    setData((current) => ({ ...current, variables }));
    if (variableSaveTimerRef.current) clearTimeout(variableSaveTimerRef.current);
    const targetWorkKey = workKeyRef.current;
    const save = () => saveRplayVariables(targetWorkKey, { variables });
    if (immediate) {
      variableSaveTimerRef.current = null;
      enqueueSave(targetWorkKey, save);
      return;
    }
    setSaveState("saving");
    variableSaveTimerRef.current = setTimeout(() => {
      variableSaveTimerRef.current = null;
      enqueueSave(targetWorkKey, save);
    }, 600);
  }, [enqueueSave]);

  const replaceUpdateRules = useCallback((
    updateRules: RplayUpdateRule[],
    immediate = false
  ) => {
    setData((current) => ({ ...current, updateRules }));
    if (ruleSaveTimerRef.current) clearTimeout(ruleSaveTimerRef.current);
    const targetWorkKey = workKeyRef.current;
    const save = () => saveRplayUpdateRules(targetWorkKey, updateRules);
    if (immediate) {
      ruleSaveTimerRef.current = null;
      enqueueSave(targetWorkKey, save);
      return;
    }
    setSaveState("saving");
    ruleSaveTimerRef.current = setTimeout(() => {
      ruleSaveTimerRef.current = null;
      enqueueSave(targetWorkKey, save);
    }, 600);
  }, [enqueueSave]);

  function addVariable() {
    const newVar: RplayVariable = {
      id: generateVarId(),
      type: "variable",
      title: `변수 ${data.variables.length + 1}`,
      variableName: `var_${data.variables.length + 1}`,
      variableType: "string",
      initValue: ""
    };
    replaceVariables([...data.variables, newVar], true);
  }

  function updateVariable(
    id: string,
    patch: Partial<RplayVariable>
  ) {
    const currentVariable = data.variables.find((variable) => variable.id === id);
    if (!currentVariable) return;
    const updated = data.variables.map((variable) => {
      if (variable.id !== id) return variable;
      const next = { ...variable, ...patch };
      if (patch.variableType && patch.variableType !== variable.variableType) {
        if (patch.variableType === "boolean") {
          next.initValue = false;
        } else if (patch.variableType === "number") {
          next.initValue = typeof variable.initValue === "number" ? variable.initValue : 0;
        } else {
          next.initValue = String(variable.initValue ?? "");
        }
      }
      return next;
    });
    replaceVariables(updated);

    if (typeof patch.variableName === "string" && patch.variableName !== currentVariable.variableName) {
      replaceUpdateRules(data.updateRules.map((rule) => ({
        ...rule,
        variables: [...new Set(rule.variables.map((variableName) =>
          variableName === currentVariable.variableName ? patch.variableName! : variableName
        ))]
      })));
    }
  }

  function deleteVariable(id: string) {
    const deletedVariable = data.variables.find((variable) => variable.id === id);
    if (!deletedVariable) return;
    replaceVariables(data.variables.filter((variable) => variable.id !== id), true);
    replaceUpdateRules(data.updateRules.map((rule) => ({
      ...rule,
      variables: rule.variables.filter((variableName) => variableName !== deletedVariable.variableName)
    })), true);
  }

  function addRule() {
    const newRule: RplayUpdateRule = {
      id: generateRuleId(),
      type: "updateRule",
      title: `규칙 ${data.updateRules.length + 1}`,
      text: "",
      variables: []
    };
    replaceUpdateRules([...data.updateRules, newRule], true);
  }

  function updateRule(id: string, patch: Partial<RplayUpdateRule>) {
    if (!data.updateRules.some((rule) => rule.id === id)) return;
    const updatedRules = data.updateRules.map((rule) =>
      rule.id === id ? { ...rule, ...patch } : rule
    );
    replaceUpdateRules(updatedRules);
  }

  function deleteRule(id: string) {
    if (!data.updateRules.some((rule) => rule.id === id)) return;
    replaceUpdateRules(data.updateRules.filter((rule) => rule.id !== id), true);
  }

  return {
    data,
    saveState,
    statusMessage,
    addVariable,
    updateVariable,
    deleteVariable,
    addRule,
    updateRule,
    deleteRule
  };
}
