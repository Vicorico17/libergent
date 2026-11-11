import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { parseArgs } from 'node:util';
import { randomUUID } from 'node:crypto';
import { loadEnv } from '../src/env.js';
import { buildFacebookSearchUrl, runFacebookDiagnostic } from '../src/facebook-diagnostic.js';

loadEnv();
const exec = promisify(execFile);
try {
  const { values } = parseArgs({ options: {
    mode: { type: 'string', default: 'remote' },
    location: { type: 'string' }, query: { type: 'string', default: 'iphone 15' },
    help: { type: 'boolean' },
  } });
  if (values.help) {
    console.log('node scripts/check-facebook.js --location <candidate-slug-or-id> [--query "iphone 15"] [--mode remote|local]\nRemote requires BROWSERBASE_API_KEY and Verified/proxy access. Local is a separate, unauthenticated smoke test. Location is unverified until compared with Facebook.');
  } else {
    const requestedUrl = buildFacebookSearchUrl(values);
    if (!['remote', 'local'].includes(values.mode)) throw new Error('Mode must be remote or local.');
    if (values.mode === 'remote' && !process.env.BROWSERBASE_API_KEY) {
      console.log(JSON.stringify({ status: 'configuration_required', missing: ['BROWSERBASE_API_KEY'],
        action: 'Set the key in .env.local (never in chat). Use an account with Verified browser and proxy access.' }, null, 2));
      process.exitCode = 2;
    } else {
      const report = await runFacebookDiagnostic({ requestedUrl, mode: values.mode,
        session: `libergent-facebook-${randomUUID()}`,
        run: async (args, timeout) => (await exec('browse', args, { timeout, maxBuffer: 1024 * 1024, env: process.env })).stdout,
      });
      console.log(JSON.stringify({ requestedUrl, ...report }, null, 2));
      if (report.status !== 'extracted_unverified_location' || report.cleanup !== 'completed') process.exitCode = 1;
    }
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 2;
}
