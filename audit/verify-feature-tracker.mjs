import fs from "node:fs/promises";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const path = "/Users/vicorico/code/libergent/docs/libergent-feature-tracker.xlsx";
const wb = await SpreadsheetFile.importXlsx(await FileBlob.load(path));
console.log((await wb.inspect({ kind: "sheet", include: "id,name" })).ndjson);
console.log((await wb.inspect({ kind: "table", range: "Summary!A1:H12", include: "values,formulas", tableMaxRows: 15, tableMaxCols: 10 })).ndjson);
console.log((await wb.inspect({ kind: "match", searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A", options: { useRegex: true, maxResults: 100 }, summary: "formula error scan" })).ndjson);
const preview = await wb.render({ sheetName: "Summary", range: "A1:H12", scale: 1, format: "png" });
await fs.writeFile("/tmp/libergent-feature-tracker-summary.png", new Uint8Array(await preview.arrayBuffer()));
console.log("rendered /tmp/libergent-feature-tracker-summary.png");
