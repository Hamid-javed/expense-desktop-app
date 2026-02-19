const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

const isDev = !app.isPackaged;
const PORT = 3100;
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
  if (!fs.existsSync(serverPath)) {
    console.error('Standalone server not found at', serverPath);
    app.quit();
    return;
  }
  
  // Use bundled Node.js runtime if available, otherwise fallback to system node
  const bundledNodePath = path.join(process.resourcesPath, 'node-runtime', 'node.exe');
  const nodeExecutable = fs.existsSync(bundledNodePath) ? bundledNodePath : 'node';
  
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
    stdio: 'inherit',
  });
  nextProcess.on('error', (err) => {
    console.error('Failed to start Next server:', err);
    console.error('Node executable used:', nodeExecutable);
    app.quit();
  });
  nextProcess.on('exit', (code, signal) => {
    if (code != null && code !== 0 && code !== 143) {
      console.error('Next server exited with code', code, 'signal', signal);
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
    startNextServerPackaged();
    waitForServer(START_URL)
      .then(() => {
        createWindow();
      })
      .catch((err) => {
        console.error(err);
        app.quit();
      });
  }
}

app.whenReady().then(run);

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
