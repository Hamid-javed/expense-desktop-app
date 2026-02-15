const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const http = require('http');

const isDev = process.env.NODE_ENV !== 'production';
const PORT = parseInt(process.env.PORT || '3100', 10);
const NEXT_URL = `http://127.0.0.1:${PORT}`;

let mainWindow = null;
let nextProcess = null;

const appRoot = path.join(__dirname, '..');

function loadEnv() {
  const envPath = path.join(appRoot, '.env');
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq > 0) {
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim();
      if (key && !process.env[key]) {
        process.env[key] = val.replace(/^["']|["']$/g, '');
      }
    }
  }
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
        reject(new Error('Next.js server failed to start within timeout'));
        return;
      }
      setTimeout(tryRequest, 300);
    }
    tryRequest();
  });
}

function startNextServer() {
  const env = { ...process.env, PORT: String(PORT), HOSTNAME: '127.0.0.1' };

  if (isDev) {
    nextProcess = spawn('npm', ['run', 'dev', '--', '-p', String(PORT)], {
      cwd: appRoot,
      env,
      stdio: 'inherit',
      shell: true,
    });
  } else {
    const standaloneDir = path.join(appRoot, '.next', 'standalone');
    const serverPath = path.join(standaloneDir, 'server.js');
    if (!fs.existsSync(serverPath)) {
      console.error('Standalone server not found. Run: npm run build && node scripts/copy-standalone-assets.cjs');
      app.quit();
      return;
    }
    nextProcess = spawn('node', [serverPath], {
      cwd: standaloneDir,
      env,
      stdio: 'inherit',
      shell: true,
    });
  }

  nextProcess.on('error', (err) => {
    console.error('Failed to start Next server:', err);
    app.quit();
  });
  nextProcess.on('exit', (code, signal) => {
    if (code !== null && code !== 0 && code !== 143) {
      console.error('Next server exited with code', code, 'signal', signal);
    }
    nextProcess = null;
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'Expense & Sales Manager',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    show: false,
  });

  mainWindow.loadURL(NEXT_URL);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (nextProcess) {
      nextProcess.kill();
      nextProcess = null;
    }
    app.quit();
  });
}

function run() {
  loadEnv();
  startNextServer();
  waitForServer(NEXT_URL)
    .then(() => {
      createWindow();
    })
    .catch((err) => {
      console.error(err);
      app.quit();
    });
}

app.whenReady().then(() => {
  const gotLock = app.requestSingleInstanceLock();
  if (!gotLock) {
    app.quit();
    return;
  }
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
  Menu.setApplicationMenu(null);
  run();
});

app.on('window-all-closed', () => {
  if (nextProcess) {
    nextProcess.kill();
    nextProcess = null;
  }
  app.quit();
});
