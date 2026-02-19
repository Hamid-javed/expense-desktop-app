const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

const isDev = !app.isPackaged;
const PORT = 3100;

// #region agent log
function debugLog(message, data = {}) {
  const payload = {
    sessionId: '3d36c5',
    timestamp: Date.now(),
    location: 'main.js',
    message,
    data: { ...data, isPackaged: app.isPackaged },
    runId: data.runId || 'run1',
    hypothesisId: data.hypothesisId || 'A',
  };
  const line = JSON.stringify(payload) + '\n';
  try {
    const logPath = isDev ? path.join(__dirname, 'debug-3d36c5.log') : path.join(app.getPath('userData'), 'debug-3d36c5.log');
    fs.appendFileSync(logPath, line);
  } catch (_) {}
  fetch('http://127.0.0.1:7749/ingest/5c0505c4-58d9-4bfe-ba64-a4068cca1bec', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '3d36c5' }, body: JSON.stringify({ ...payload, sessionId: '3d36c5' }) }).catch(() => {});
}
// #endregion
const START_URL = `http://127.0.0.1:${PORT}`;

let mainWindow;
let nextProcess;

function loadEnv() {
  const envPath = isDev ? path.join(__dirname, '.env') : path.join(path.dirname(app.getPath('exe')), '.env');
  if (!fs.existsSync(envPath)) return {};
  const content = fs.readFileSync(envPath, 'utf8');
  const env = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq > 0) {
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      if (key) env[key] = val;
    }
  }
  return env;
}

function waitForServer(url, timeoutMs = 60000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    function tryRequest() {
      const req = http.get(url, (res) => {
        if (res.statusCode === 200 || res.statusCode < 400) {
          resolve();
          return;
        }
        schedule();
      });
      req.on('error', () => schedule());
      req.end();
    }
    function schedule() {
      if (Date.now() - start > timeoutMs) {
        reject(new Error('Server failed to start within timeout'));
        return;
      }
      setTimeout(tryRequest, 300);
    }
    tryRequest();
  });
}

function createWindow() {
  const preloadPath = path.join(__dirname, 'preload.js');
  // Try icon.ico first, fallback to logo.png if not found
  let iconPath;
  if (isDev) {
    iconPath = path.join(__dirname, 'build', 'icon.ico');
    if (!fs.existsSync(iconPath)) {
      iconPath = path.join(__dirname, 'public', 'logo.png');
    }
  } else {
    iconPath = path.join(process.resourcesPath, 'icon.ico');
    if (!fs.existsSync(iconPath)) {
      iconPath = path.join(process.resourcesPath, 'logo.png');
    }
  }
  const icon = fs.existsSync(iconPath) ? iconPath : undefined;
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    icon,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: fs.existsSync(preloadPath) ? preloadPath : undefined,
    },
    show: false,
  });

  mainWindow.loadURL(START_URL);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function startNextServerDev() {
  const command = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  nextProcess = spawn(command, ['run', 'dev', '--', '-p', String(PORT)], {
    cwd: __dirname,
    shell: true,
    env: { ...process.env, ...loadEnv(), PORT: String(PORT) },
    stdio: 'inherit',
  });
  nextProcess.on('error', (err) => {
    console.error('Failed to start Next server:', err);
    app.quit();
  });
}

function startNextServerPackaged() {
  const standaloneDir = path.join(process.resourcesPath, 'standalone');
  const serverPath = path.join(standaloneDir, 'server.js');
  const bundledNodePath = path.join(process.resourcesPath, 'node-runtime', 'node.exe');
  const serverExists = fs.existsSync(serverPath);
  const nodeExists = fs.existsSync(bundledNodePath);
  // #region agent log
  debugLog('startNextServerPackaged paths', { hypothesisId: 'A', resourcesPath: process.resourcesPath, standaloneDir, serverPath, serverExists, bundledNodePath, nodeExists });
  // #endregion
  if (!serverExists) {
    debugLog('quit: standalone server not found', { hypothesisId: 'B', serverPath });
    console.error('Standalone server not found at', serverPath);
    app.quit();
    return;
  }
  
  const nodeExecutable = nodeExists ? bundledNodePath : 'node';
  debugLog('spawning Next server', { hypothesisId: 'A', nodeExecutable });
  
  let stdoutChunks = [];
  let stderrChunks = [];
  
  // Use shell: false to properly handle paths with spaces on Windows
  // When using bundled node, we have a full path, so shell: false works fine
  // When falling back to system 'node', it will still work if node is in PATH
  nextProcess = spawn(nodeExecutable, [serverPath], {
    cwd: standaloneDir,
    shell: false,
    env: {
      ...process.env,
      ...loadEnv(),
      PORT: String(PORT),
      HOSTNAME: '127.0.0.1',
      NODE_ENV: 'production',
      ELECTRON_USER_DATA: app.getPath('userData'),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  
  nextProcess.stdout.on('data', (chunk) => {
    stdoutChunks.push(chunk);
  });
  
  nextProcess.stderr.on('data', (chunk) => {
    stderrChunks.push(chunk);
  });
  
  nextProcess.on('error', (err) => {
    const stdout = Buffer.concat(stdoutChunks).toString('utf8');
    const stderr = Buffer.concat(stderrChunks).toString('utf8');
    debugLog('nextProcess error', { hypothesisId: 'A', errMessage: err.message, errCode: err.code, nodeExecutable, stdout, stderr });
    console.error('Failed to start Next server:', err);
    console.error('Node executable used:', nodeExecutable);
    if (stdout) console.error('STDOUT:', stdout);
    if (stderr) console.error('STDERR:', stderr);
    app.quit();
  });
  nextProcess.on('exit', (code, signal) => {
    const stdout = Buffer.concat(stdoutChunks).toString('utf8');
    const stderr = Buffer.concat(stderrChunks).toString('utf8');
    debugLog('nextProcess exit', { hypothesisId: 'C', code, signal, stdout, stderr });
    if (code != null && code !== 0 && code !== 143) {
      console.error('Next server exited with code', code, 'signal', signal);
      if (stdout) console.error('STDOUT:', stdout);
      if (stderr) console.error('STDERR:', stderr);
    }
  });
}

function run() {
  if (isDev) {
    startNextServerDev();
    setTimeout(() => {
      waitForServer(START_URL).then(createWindow).catch((err) => {
        console.error(err);
        app.quit();
      });
    }, 1000);
  } else {
    // #region agent log
    debugLog('run() packaged branch', { hypothesisId: 'D', resourcesPath: process.resourcesPath });
    // #endregion
    startNextServerPackaged();
    waitForServer(START_URL)
      .then(() => {
        debugLog('waitForServer resolved, creating window', { hypothesisId: 'E' });
        createWindow();
      })
      .catch((err) => {
        debugLog('waitForServer rejected', { hypothesisId: 'C', errMessage: err.message });
        console.error(err);
        app.quit();
      });
  }
}

app.whenReady().then(() => {
  // #region agent log
  debugLog('app.whenReady fired', { hypothesisId: 'D' });
  // #endregion
  try {
    run();
  } catch (err) {
    debugLog('run() threw', { hypothesisId: 'D', errMessage: err.message, errStack: err.stack });
    app.quit();
  }
});
process.on('uncaughtException', (err) => {
  try {
    debugLog('uncaughtException', { hypothesisId: 'D', errMessage: err.message, errStack: err.stack });
  } catch (_) {}
  app.quit();
});

app.on('window-all-closed', () => {
  if (nextProcess) {
    nextProcess.kill();
    nextProcess = null;
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('quit', () => {
  if (nextProcess) {
    nextProcess.kill();
    nextProcess = null;
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
