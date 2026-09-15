import { useEffect, useRef } from "react";

function selectableCell(target: EventTarget | null, table: HTMLTableElement) {
  if (!(target instanceof Element)) return null;
  const cell = target.closest<HTMLTableCellElement>("td");
  if (!cell || cell.closest("table") !== table) return null;
  if (cell.dataset.noCellSelect !== undefined) return null;
  return cell;
}

function clearSelection(table: HTMLTableElement) {
  table
    .querySelectorAll(".selected-cell")
    .forEach((cell) => cell.classList.remove("selected-cell"));
}

function selectRange(
  table: HTMLTableElement,
  start: HTMLTableCellElement,
  end: HTMLTableCellElement
) {
  clearSelection(table);
  const startRow = (start.parentElement as HTMLTableRowElement).rowIndex;
  const endRow = (end.parentElement as HTMLTableRowElement).rowIndex;
  const minRow = Math.min(startRow, endRow);
  const maxRow = Math.max(startRow, endRow);
  const minColumn = Math.min(start.cellIndex, end.cellIndex);
  const maxColumn = Math.max(start.cellIndex, end.cellIndex);

  for (let rowIndex = minRow; rowIndex <= maxRow; rowIndex += 1) {
    const row = table.rows[rowIndex];
    if (!row || row.closest("thead")) continue;
    for (let columnIndex = minColumn; columnIndex <= maxColumn; columnIndex += 1) {
      const cell = row.cells[columnIndex];
      if (cell && cell.dataset.noCellSelect === undefined && cell.getClientRects().length) {
        cell.classList.add("selected-cell");
      }
    }
  }
}

function cellText(cell: HTMLTableCellElement) {
  const checkbox = cell.querySelector<HTMLInputElement>('input[type="checkbox"]');
  if (checkbox) return checkbox.checked ? "O" : "";
  const input = cell.querySelector<HTMLInputElement | HTMLTextAreaElement>(
    'input[type="text"], textarea'
  );
  return input ? input.value : cell.textContent?.trim() ?? "";
}

function escapeTsv(value: string) {
  if (!/[\t\n"]/.test(value)) return value;
  return `"${value.replace(/"/g, '""')}"`;
}

async function copySelection(table: HTMLTableElement) {
  const selected = Array.from(
    table.querySelectorAll<HTMLTableCellElement>("td.selected-cell")
  ).filter((cell) => cell.getClientRects().length);
  if (!selected.length) return 0;
  const rows = new Map<number, HTMLTableCellElement[]>();
  selected.forEach((cell) => {
    const rowIndex = (cell.parentElement as HTMLTableRowElement).rowIndex;
    const row = rows.get(rowIndex) ?? [];
    row.push(cell);
    rows.set(rowIndex, row);
  });
  const value = Array.from(rows.entries())
    .sort(([left], [right]) => left - right)
    .map(([, cells]) =>
      cells
        .sort((left, right) => left.cellIndex - right.cellIndex)
        .map((cell) => escapeTsv(cellText(cell)))
        .join("\t")
    )
    .join("\n");
  await navigator.clipboard.writeText(value);
  return selected.length;
}

export function useTableCellSelection(
  onCopied?: (selectedCellCount: number) => void
) {
  const tableRef = useRef<HTMLTableElement>(null);
  const onCopiedRef = useRef(onCopied);
  onCopiedRef.current = onCopied;

  useEffect(() => {
    const table = tableRef.current;
    if (!table) return;
    let selecting = false;
    let startCell: HTMLTableCellElement | null = null;
    let endCell: HTMLTableCellElement | null = null;
    let lastCell: HTMLTableCellElement | null = null;
    let startX = 0;
    let startY = 0;
    let dragged = false;

    const handleMouseDown = (event: MouseEvent) => {
      if (
        event.target instanceof Element &&
        event.target.closest("input, select, textarea, button, a, label")
      ) {
        return;
      }
      const cell = selectableCell(event.target, table);
      if (!cell) return;
      if (event.shiftKey && lastCell?.getClientRects().length) {
        event.preventDefault();
        selectRange(table, lastCell, cell);
        return;
      }
      selecting = true;
      startCell = cell;
      endCell = cell;
      lastCell = cell;
      startX = event.clientX;
      startY = event.clientY;
      dragged = false;
      clearSelection(table);
      cell.classList.add("selected-cell");
      table.classList.add("selecting");
    };

    const handleMouseMove = (event: MouseEvent) => {
      if (!selecting || !startCell) return;
      const cell = selectableCell(event.target, table);
      if (!cell || cell === endCell) return;
      if (Math.hypot(event.clientX - startX, event.clientY - startY) > 5) {
        dragged = true;
      }
      endCell = cell;
      selectRange(table, startCell, cell);
    };

    const handleMouseUp = () => {
      selecting = false;
      table.classList.remove("selecting");
    };

    const handleClick = (event: MouseEvent) => {
      if (!dragged) return;
      event.preventDefault();
      event.stopPropagation();
      dragged = false;
    };

    const handleOutsideMouseDown = (event: MouseEvent) => {
      if (event.target instanceof Node && !table.contains(event.target)) {
        clearSelection(table);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLocaleLowerCase() !== "c") return;
      if (
        document.activeElement instanceof HTMLInputElement ||
        document.activeElement instanceof HTMLTextAreaElement
      ) {
        return;
      }
      if (!table.querySelector(".selected-cell")) return;
      event.preventDefault();
      void copySelection(table)
        .then((count) => {
          if (count) onCopiedRef.current?.(count);
        })
        .catch(() => undefined);
    };

    table.addEventListener("mousedown", handleMouseDown);
    table.addEventListener("mousemove", handleMouseMove);
    table.addEventListener("click", handleClick, true);
    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("mousedown", handleOutsideMouseDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      table.removeEventListener("mousedown", handleMouseDown);
      table.removeEventListener("mousemove", handleMouseMove);
      table.removeEventListener("click", handleClick, true);
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("mousedown", handleOutsideMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return tableRef;
}
