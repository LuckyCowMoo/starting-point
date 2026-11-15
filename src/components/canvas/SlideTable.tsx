import React from 'react';
import { Plus, Minus, Table as TableIcon } from 'lucide-react';
import { PhasePalette, SlideTableData } from '../../types/curriculum';

interface SlideTableProps {
  tableData: SlideTableData;
  onDark?: boolean;
  neutralBorder: string;
  neutralAccent: string;
  neutralDark: string;
  palette: PhasePalette;
  editable?: boolean;
  isThumbnail?: boolean;
  onUpdateTable: (next: SlideTableData) => void;
  heading?: string;
  onUpdateHeading?: (next: string) => void;
  InlineEditable: React.FC<{
    value: string;
    placeholder?: string;
    editable?: boolean;
    multiline?: boolean;
    className?: string;
    style?: React.CSSProperties;
    onCommit: (val: string) => void;
  }>;
}

export const SlideTable: React.FC<SlideTableProps> = ({
  tableData,
  onDark = false,
  neutralBorder,
  neutralAccent,
  neutralDark,
  palette,
  editable = false,
  isThumbnail = false,
  onUpdateTable,
  heading,
  onUpdateHeading,
  InlineEditable,
}) => {
  const rows = Math.max(1, tableData.rows || tableData.cells?.length || 1);
  const cols = Math.max(
    1,
    tableData.cols || tableData.headers?.length || tableData.cells?.[0]?.length || 1
  );

  // Normalise 2D cells array to exact rows x cols
  const cells: string[][] = [];
  for (let r = 0; r < rows; r++) {
    const row = tableData.cells?.[r] || [];
    const normalizedRow: string[] = [];
    for (let c = 0; c < cols; c++) {
      normalizedRow.push(row[c] !== undefined ? row[c] : '');
    }
    cells.push(normalizedRow);
  }

  const headers = tableData.headers
    ? Array.from({ length: cols }, (_, i) => tableData.headers?.[i] ?? `Column ${i + 1}`)
    : undefined;

  const updateCell = (r: number, c: number, val: string) => {
    const nextCells = cells.map((rowArr, rowIdx) =>
      rowIdx === r ? rowArr.map((cellVal, colIdx) => (colIdx === c ? val : cellVal)) : rowArr
    );
    onUpdateTable({
      ...tableData,
      rows,
      cols,
      headers,
      cells: nextCells,
    });
  };

  const updateHeader = (c: number, val: string) => {
    if (!headers) return;
    const nextHeaders = headers.map((h, idx) => (idx === c ? val : h));
    onUpdateTable({
      ...tableData,
      rows,
      cols,
      headers: nextHeaders,
      cells,
    });
  };

  const addRow = () => {
    const nextCells = [...cells, new Array(cols).fill('')];
    onUpdateTable({
      ...tableData,
      rows: rows + 1,
      cols,
      headers,
      cells: nextCells,
    });
  };

  const removeRow = () => {
    if (rows <= 1) return;
    onUpdateTable({
      ...tableData,
      rows: rows - 1,
      cols,
      headers,
      cells: cells.slice(0, -1),
    });
  };

  const addCol = () => {
    const nextHeaders = headers ? [...headers, `Column ${cols + 1}`] : undefined;
    const nextCells = cells.map((row) => [...row, '']);
    onUpdateTable({
      ...tableData,
      rows,
      cols: cols + 1,
      headers: nextHeaders,
      cells: nextCells,
    });
  };

  const removeCol = () => {
    if (cols <= 1) return;
    const nextHeaders = headers ? headers.slice(0, -1) : undefined;
    const nextCells = cells.map((row) => row.slice(0, -1));
    onUpdateTable({
      ...tableData,
      rows,
      cols: cols - 1,
      headers: nextHeaders,
      cells: nextCells,
    });
  };

  const toggleHeaderRow = () => {
    if (headers) {
      onUpdateTable({
        ...tableData,
        rows,
        cols,
        headers: undefined,
        cells,
      });
    } else {
      const defaultHeaders = Array.from({ length: cols }, (_, i) => `Column ${i + 1}`);
      onUpdateTable({
        ...tableData,
        rows,
        cols,
        headers: defaultHeaders,
        cells,
      });
    }
  };

  return (
    <div
      className={`w-full h-full flex flex-col justify-between rounded-3xl border-2 p-6 shadow-lg overflow-hidden transition ${
        onDark
          ? 'bg-white/14 backdrop-blur-md border-white/30 text-white'
          : 'bg-white/95 backdrop-blur-xs text-zinc-900'
      }`}
      style={{
        borderColor: onDark ? 'rgba(255,255,255,0.28)' : neutralBorder,
        borderTopColor: onDark ? 'rgba(255,255,255,0.28)' : neutralBorder,
        borderRightColor: onDark ? 'rgba(255,255,255,0.28)' : neutralBorder,
        borderBottomColor: onDark ? 'rgba(255,255,255,0.28)' : neutralBorder,
        borderLeftColor: onDark ? 'rgba(255,255,255,0.28)' : neutralBorder,
      }}
    >
      {/* Table Header / Toolbar */}
      <div className="flex items-center justify-between gap-4 mb-3 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{
              backgroundColor: onDark ? 'rgba(255,255,255,0.2)' : `${neutralAccent}20`,
              color: onDark ? '#FFFFFF' : neutralAccent,
            }}
          >
            <TableIcon size={20} />
          </div>
          {(heading || editable) && (
            <h3
              className="text-[28px] font-extrabold leading-tight tracking-tight flex-1"
              style={{ color: onDark ? '#FFFFFF' : neutralAccent }}
            >
              <InlineEditable
                value={heading || ''}
                placeholder="Table title (optional)..."
                editable={editable && !isThumbnail}
                onCommit={(next) => onUpdateHeading?.(next)}
              />
            </h3>
          )}
        </div>

        {editable && !isThumbnail && (
          <div
            className="flex items-center gap-1.5 shrink-0 bg-zinc-100/90 p-1.5 rounded-2xl border border-zinc-200 text-zinc-700 text-[13px] font-bold"
            data-no-drag="true"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-1 px-1.5 border-r border-zinc-300">
              <span className="text-zinc-500 font-semibold text-[11px] uppercase mr-0.5">Rows:</span>
              <button
                type="button"
                onClick={removeRow}
                disabled={rows <= 1}
                className="w-6 h-6 rounded-lg bg-white border border-zinc-300 flex items-center justify-center hover:bg-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed"
                title="Remove Row"
              >
                <Minus size={13} />
              </button>
              <span className="w-5 text-center font-mono">{rows}</span>
              <button
                type="button"
                onClick={addRow}
                className="w-6 h-6 rounded-lg bg-white border border-zinc-300 flex items-center justify-center hover:bg-zinc-200"
                title="Add Row"
              >
                <Plus size={13} />
              </button>
            </div>

            <div className="flex items-center gap-1 px-1.5 border-r border-zinc-300">
              <span className="text-zinc-500 font-semibold text-[11px] uppercase mr-0.5">Cols:</span>
              <button
                type="button"
                onClick={removeCol}
                disabled={cols <= 1}
                className="w-6 h-6 rounded-lg bg-white border border-zinc-300 flex items-center justify-center hover:bg-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed"
                title="Remove Column"
              >
                <Minus size={13} />
              </button>
              <span className="w-5 text-center font-mono">{cols}</span>
              <button
                type="button"
                onClick={addCol}
                className="w-6 h-6 rounded-lg bg-white border border-zinc-300 flex items-center justify-center hover:bg-zinc-200"
                title="Add Column"
              >
                <Plus size={13} />
              </button>
            </div>

            <button
              type="button"
              onClick={toggleHeaderRow}
              className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition ${
                headers
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-white border border-zinc-300 text-zinc-600 hover:bg-zinc-200'
              }`}
            >
              {headers ? 'Header: On' : 'Header: Off'}
            </button>
          </div>
        )}
      </div>

      {/* Main Table View */}
      <div className="flex-1 min-h-0 overflow-auto rounded-2xl border border-zinc-200/80 bg-white/70">
        <table className="w-full h-full border-collapse table-fixed text-center">
          {headers && (
            <thead>
              <tr
                style={{
                  backgroundColor: onDark ? 'rgba(255,255,255,0.22)' : `${palette.layers[2]}25`,
                  borderColor: neutralBorder,
                }}
              >
                {headers.map((h, cIdx) => (
                  <th
                    key={cIdx}
                    className="p-3.5 border-b-2 border-r last:border-r-0 font-extrabold text-[23px] tracking-wide"
                    style={{
                      borderColor: onDark ? 'rgba(255,255,255,0.3)' : neutralBorder,
                      color: onDark ? '#FFFFFF' : neutralAccent,
                    }}
                  >
                    <InlineEditable
                      value={h}
                      placeholder={`Header ${cIdx + 1}`}
                      editable={editable && !isThumbnail}
                      onCommit={(next) => updateHeader(cIdx, next)}
                    />
                  </th>
                ))}
              </tr>
            </thead>
          )}
          <tbody>
            {cells.map((row, rIdx) => (
              <tr
                key={rIdx}
                className="transition-colors hover:bg-sky-50/20"
                style={{
                  backgroundColor:
                    rIdx % 2 === 1
                      ? onDark
                        ? 'rgba(255,255,255,0.06)'
                        : 'rgba(0,0,0,0.02)'
                      : 'transparent',
                }}
              >
                {row.map((cellVal, cIdx) => (
                  <td
                    key={cIdx}
                    className="p-3 border-b border-r last:border-r-0 font-medium text-[21px] leading-snug align-middle"
                    style={{
                      borderColor: onDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.08)',
                      color: onDark ? '#FFFFFF' : neutralDark,
                    }}
                  >
                    <InlineEditable
                      value={cellVal}
                      placeholder="—"
                      editable={editable && !isThumbnail}
                      multiline
                      onCommit={(next) => updateCell(rIdx, cIdx, next)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
