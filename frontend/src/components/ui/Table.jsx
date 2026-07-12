import { useState } from 'react';
import './Table.css';

export default function Table({
  columns,
  data = [],
  onRowClick,
  emptyMessage = 'No data found',
  sortable = true,
  className = '',
}) {
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState('asc');

  function handleSort(colKey) {
    if (!sortable) return;
    if (sortCol === colKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortCol(colKey);
      setSortDir('asc');
    }
  }

  const sortedData = sortCol
    ? [...data].sort((a, b) => {
        const aVal = a[sortCol] ?? '';
        const bVal = b[sortCol] ?? '';
        const cmp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true });
        return sortDir === 'asc' ? cmp : -cmp;
      })
    : data;

  return (
    <div className={`af-table-wrapper ${className}`}>
      <table className="af-table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className={`af-table__th ${sortable && col.sortable !== false ? 'af-table__th--sortable' : ''}`}
                style={{ width: col.width, minWidth: col.minWidth }}
                onClick={() => col.sortable !== false && handleSort(col.key)}
              >
                <span className="af-table__th-content">
                  {col.label}
                  {sortCol === col.key && (
                    <span className="af-table__sort-icon">
                      {sortDir === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedData.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="af-table__empty">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            sortedData.map((row, i) => (
              <tr
                key={row.id ?? i}
                className={`af-table__row ${onRowClick ? 'af-table__row--clickable' : ''}`}
                onClick={() => onRowClick?.(row)}
              >
                {columns.map((col) => (
                  <td key={col.key} className="af-table__td">
                    {col.render ? col.render(row[col.key], row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
