// Cross-platform dev launcher for the FastAPI backend.
// Picks the local venv python if present, else falls back to system python.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';

const isWin = process.platform === 'win32';
const venvPython = isWin ? '.venv/Scripts/python.exe' : '.venv/bin/python';
const python = existsSync(venvPython) ? venvPython : isWin ? 'python' : 'python3';

const args = [
  '-m',
  'uvicorn',
  'app.main:app',
  '--reload',
  '--host',
  '0.0.0.0',
  '--port',
  '8001',
];

const child = spawn(python, args, { stdio: 'inherit', shell: false });
child.on('exit', (code) => process.exit(code ?? 0));
