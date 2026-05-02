import EmptyState from "./EmptyState";

export default function Table({ columns, data, keyField = "id", emptyTitle, emptyMessage, summary }) {
  if (!data?.length) {
    return <EmptyState title={emptyTitle} message={emptyMessage} />;
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-2.5">
        <p className="text-xs font-medium text-slate-500">Total baris: {data.length}</p>
        {summary ? <p className="text-xs font-medium text-slate-500">{summary}</p> : null}
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
              >
                {column.header}
              </th>
            ))}
          </tr>
          </thead>
          <tbody>
            {data.map((row, rowIndex) => (
              <tr
                key={row[keyField] ?? `${rowIndex}-${row.sku || "row"}`}
                className="border-t border-slate-100 transition hover:bg-blue-50/40"
              >
                {columns.map((column) => (
                  <td key={`${column.key}-${rowIndex}`} className="px-4 py-3 text-slate-700">
                    {column.render ? column.render(row, rowIndex) : row[column.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
