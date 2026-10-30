// Supply credentials through the local environment, never argv or committed files.
import { AcceptanceError, checkDeveloperAcceptance } from '../src/developer-acceptance.js';
const argument = process.argv[2];
if (!argument || argument === '--help') {
  console.log('Usage: npm run check:developer-api -- https://YOUR-STAGING-HOST');
  console.log('Set LIBERGENT_ACCEPTANCE_SESSION_TOKEN locally for a verified test account.');
  console.log('Set LIBERGENT_ACCEPTANCE_SECOND_SESSION_TOKEN for a second account to test isolation.');
  console.log('Creates and revokes one test key. No marketplace searches or database migrations.');
  process.exit(argument === '--help' ? 0 : 1);
}
try {
  const result = await checkDeveloperAcceptance({
    origin: argument,
    sessionToken: process.env.LIBERGENT_ACCEPTANCE_SESSION_TOKEN,
    secondSessionToken: process.env.LIBERGENT_ACCEPTANCE_SECOND_SESSION_TOKEN
  });
  for (const check of result.passed) console.log(`PASS: ${check}`);
  console.log(`Account isolation: ${result.accountIsolation}`);
} catch (error) {
  console.error(`FAIL: ${error instanceof AcceptanceError ? error.message : 'Unexpected acceptance error.'}`);
  process.exitCode = 1;
}
