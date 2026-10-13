export function cleanText(value) {
    return (value ?? "").replace(/\s+/g, " ").trim();
}
export function fallbackTable(columns, emptyMessage) {
    return {
        columns,
        rows: [],
        emptyMessage
    };
}
