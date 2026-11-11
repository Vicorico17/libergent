import { readFile } from "node:fs/promises";
import { triageFeedback, evaluateFeedbackCases } from "../src/feedback-learning.js";

const [command, filename, ...extra] = process.argv.slice(2);
try {
  if (!["triage", "evaluate"].includes(command) || !filename || extra.length) {
    throw new Error("Usage: node scripts/feedback-loop.js <triage|evaluate> <file.json>");
  }
  const input = JSON.parse(await readFile(filename, "utf8"));
  const report = command === "triage" ? triageFeedback(input) : evaluateFeedbackCases(input);
  console.log(JSON.stringify(report, null, 2));
  if (command === "evaluate" && report.passed !== report.total) process.exitCode = 1;
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
