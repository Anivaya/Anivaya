import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { testEnvironment } from './test-environment.ts';
import { fileURLToPath } from 'node:url';
const child = spawn(process.execPath, ['--test', ...process.argv.slice(2), 'back/tests/*.test.ts'], { stdio:'inherit',env:testEnvironment(),cwd:fileURLToPath(new URL('..',import.meta.url)) });
const [code] = await once(child,'exit');
process.exitCode = code ?? 1;
