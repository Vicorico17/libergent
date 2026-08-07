import fs from "node:fs";
import path from "node:path";

const uiOutput = path.resolve(process.cwd(), "ui", "out");
const supabaseUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
const publishableKey = String(
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    || ""
).trim();

if (!supabaseUrl || !publishableKey) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY for the production UI build.");
}

function listJavaScriptFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return listJavaScriptFiles(entryPath);
    return entry.isFile() && entry.name.endsWith(".js") ? [entryPath] : [];
  });
}

const files = listJavaScriptFiles(path.join(uiOutput, "_next", "static", "chunks"));
let urlFound = false;
let keyFound = false;

for (const file of files) {
  const source = fs.readFileSync(file, "utf8");
  if (source.includes(supabaseUrl)) urlFound = true;
  if (source.includes(publishableKey)) keyFound = true;
  if (urlFound && keyFound) break;
}

if (!urlFound || !keyFound) {
  throw new Error("The production UI was built without its public Supabase authentication configuration.");
}

console.log("Verified public Supabase authentication configuration in the production UI.");
