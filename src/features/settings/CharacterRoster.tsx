import {
  formatCharacterSummary,
  genderLabels,
  groupLabels,
  normalizeList,
  type CharacterRecord
} from "./model";
import { useTableCellSelection } from "../table/useTableCellSelection";

interface CharacterRosterProps {
  characters: CharacterRecord[];
  selectedId: string;
  draftMode: boolean;
  onSelect: (id: string) => void;
  onCopy: (value: string, message: string) => void;
}

export function CharacterRoster({
  characters,
  selectedId,
  draftMode,
  onSelect,
  onCopy
}: CharacterRosterProps) {
  const tableRef = useTableCellSelection();

  return (
    <section className="settings-panel settings-roster-panel">
      <header className="settings-panel-header">
        <div>
          <span>ROSTER</span>
          <strong>캐릭터 목록</strong>
        </div>
        <span>{characters.length}명 표시</span>
      </header>
      <div className="settings-table-wrap">
        {characters.length ? (
          <table className="settings-table" ref={tableRef}>
            <thead>
              <tr>
                <th>캐릭터</th>
                <th>소속</th>
                <th>성별</th>
                <th>분류</th>
                <th>역할/신분</th>
                <th>별칭</th>
                <th data-no-cell-select><span className="sr-only">복사</span></th>
              </tr>
            </thead>
            <tbody>
              {characters.map((character) => {
                const aliases = normalizeList(character.aliases)
                  .filter((alias) => alias !== character.id && alias !== character.name)
                  .slice(0, 3)
                  .join(", ");
                return (
                  <tr
                    className={!draftMode && character.id === selectedId ? "is-selected" : ""}
                    key={character.id}
                    onClick={() => onSelect(character.id)}
                  >
                    <td data-no-cell-select>
                      <button className="settings-character-link" type="button" aria-pressed={!draftMode && character.id === selectedId}
                        onClick={(event) => { event.stopPropagation(); onSelect(character.id); }}>{character.name}</button>
                      <span>{character.id}</span>
                    </td>
                    <td>{character.faction || "-"}</td>
                    <td>{genderLabels[character.gender]}</td>
                    <td>
                      <span className={`settings-pill settings-pill--${character.group}`}>
                        {groupLabels[character.group]}
                      </span>
                    </td>
                    <td className="settings-concept-cell">
                      {character.role || "-"}
                    </td>
                    <td>{aliases || "-"}</td>
                    <td>
                      <button
                        className="settings-row-copy"
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onCopy(formatCharacterSummary(character), `${character.name} 복사됨`);
                        }}
                      >
                        복사
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="settings-empty">
            <strong>조건에 맞는 캐릭터가 없습니다</strong>
            <p>검색어나 필터를 바꾸거나 새 캐릭터를 추가하세요.</p>
          </div>
        )}
      </div>
    </section>
  );
}
