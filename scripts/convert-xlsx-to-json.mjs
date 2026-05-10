// Build-time script: converts public/alphatrace_data.xlsx → public/alphatrace_data.json
// Run automatically as `prebuild` and `predev`. Re-run manually with `pnpm run convert-data`.
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import XLSX from "xlsx";

const __dirname = dirname(fileURLToPath(import.meta.url));
const inputPath = join(__dirname, "../public/alphatrace_data.xlsx");
const outputPath = join(__dirname, "../public/alphatrace_data.json");

function toMonthStr(v) {
    if (typeof v === "string" && /^\d{4}-\d{1,2}(?:-\d{1,2})?/.test(v)) {
        const parts = v.split("-");
        return `${parts[0]}-${parts[1].padStart(2, "0")}-01`;
    }
    const dt = new Date(v);
    const y = dt.getFullYear();
    const m = (dt.getMonth() + 1).toString().padStart(2, "0");
    return `${y}-${m}-01`;
}

const buffer = readFileSync(inputPath);
const wb = XLSX.read(buffer, { type: "buffer" });
const ws = wb.Sheets[wb.SheetNames[0]];
const json = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true });

if (!json.length) { console.error("No data in XLSX"); process.exit(1); }

const headers = json[0].map(h => String(h).trim());
let dateIdx = headers.findIndex(h => h.toLowerCase() === "date");
if (dateIdx === -1) dateIdx = 0;

const body = json.slice(1).filter(r => Array.isArray(r) && r.some(x => x != null && x !== ""));
const rows = body.map(arr => {
    const obj = {};
    headers.forEach((h, i) => {
        if (!h) return;
        const v = arr[i];
        if (i === dateIdx) {
            if (typeof v === "number") {
                const dc = XLSX.SSF.parse_date_code(v);
                const d = new Date(dc.y, dc.m - 1, dc.d);
                obj["Date"] = toMonthStr(d);
            } else {
                obj["Date"] = toMonthStr(v);
            }
        } else {
            obj[h] = (v === null || v === undefined || v === "") ? null : Number(v);
        }
    });
    return obj;
});

// Columnar format: { headers, rows } — eliminates 55-key repetition across 1337 rows
const colHeaders = Object.keys(rows[0] || {});
const colRows = rows.map(r => colHeaders.map(h => r[h] ?? null));

writeFileSync(outputPath, JSON.stringify({ headers: colHeaders, rows: colRows }));
console.log(`✓ Converted ${rows.length} rows, ${colHeaders.length} cols → public/alphatrace_data.json`);
