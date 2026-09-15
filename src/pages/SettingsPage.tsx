import { ToolbarSlot } from "../features/workspace/WorkspaceSidebar";
import { useLayoutEffect, useRef, useState } from "react";
﻿import { CharacterEditor } from "../features/settings/CharacterEditor";
import { CharacterRoster } from "../features/settings/CharacterRoster";
import { CharacterSummary } from "../features/settings/CharacterSummary";
import { formatCharacterSummary } from "../features/settings/model";
import { SettingsCommandBar } from "../features/settings/SettingsCommandBar";
import { SettingsFilters } from "../features/settings/SettingsFilters";
import { useCharacterSettings } from "../features/settings/useCharacterSettings";
import { useWorks } from "../features/works/WorkContext";
import "../styles/settings.css";

export function SettingsPage() {
  const { activeWorkId, activePlatformId, activeWork } = useWorks();
  const workKey = `${activeWorkId}::${activePlatformId}`;
  const settings = useCharacterSettings(workKey);
  const [editing, setEditing] = useState(false);
  const pageRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const page = pageRef.current;
    page?.closest("main")?.scrollTo(0, 0);
    if (editing) page?.querySelector<HTMLElement>(".settings-editor-panel")?.focus({ preventScroll: true });
    else page?.querySelector<HTMLElement>('.settings-character-link[aria-pressed="true"]')?.focus({ preventScroll: true });
  }, [editing]);
  useLayoutEffect(() => { setEditing(false); }, [workKey]);

  if (settings.saveState === "loading") {
    return (
      <section className="settings-loading">
        <span />
        <strong>캐릭터 설정을 불러오는 중입니다</strong>
        <p>{activeWork?.name ?? "현재 작품"}의 캐릭터 파일을 읽고 있습니다.</p>
      </section>
    );
  }

  return (
    <div className={`settings-page${editing ? " is-editing" : ""}`} ref={pageRef}>
      {editing && <ToolbarSlot><button type="button" onClick={() => setEditing(false)}>캐릭터 목록</button></ToolbarSlot>}
      <SettingsCommandBar
        saveState={settings.saveState}
        statusMessage={settings.statusMessage}
        onCreate={() => { settings.createCharacter(); setEditing(true); }}
        onCopySummary={() =>
          void settings.copyWithStatus(settings.summaryText, "선택 캐릭터 요약 복사됨")
        }
        onCopyList={() => {
          const value = settings.filtered
            .map(formatCharacterSummary)
            .join("\n\n---\n\n");
          if (value) {
            void settings.copyWithStatus(
              value,
              `목록 복사됨 (${settings.filtered.length}명)`
            );
          }
        }}
        onExport={settings.exportJson}
        onImport={(event) => void settings.importJson(event)}
      />

      <SettingsFilters
        query={settings.query}
        group={settings.groupFilter}
        gender={settings.genderFilter}
        filteredCount={settings.filtered.length}
        totalCount={settings.characters.length}
        onQueryChange={settings.setQuery}
        onGroupChange={settings.setGroupFilter}
        onGenderChange={settings.setGenderFilter}
        onReset={() => {
          settings.setQuery("");
          settings.setGroupFilter("all");
          settings.setGenderFilter("all");
        }}
      />

      <div className="settings-workspace">
        <CharacterRoster
          characters={settings.filtered}
          selectedId={settings.selectedId}
          draftMode={settings.draftMode}
          onSelect={(id) => { settings.selectCharacter(id); setEditing(true); }}
          onCopy={(value, message) => void settings.copyWithStatus(value, message)}
        />

        <CharacterEditor
          form={settings.form}
          draftMode={settings.draftMode}
          onUpdate={settings.updateFormField}
          onDuplicate={settings.duplicateCharacter}
          onDelete={settings.deleteCharacter}
          onSubmit={settings.submitForm}
          onBlur={settings.flushPendingSave}
        />

        <CharacterSummary
          value={settings.summaryText}
          hasCharacter={Boolean(settings.summaryCharacter)}
        />
      </div>

    </div>
  );
}
