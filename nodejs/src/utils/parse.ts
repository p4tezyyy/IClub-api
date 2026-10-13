export function cleanText(value?: string | null) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

export function fallbackTable(columns: string[], emptyMessage: string) {
  return {
    columns,
    rows: [],
    emptyMessage
  };
}
