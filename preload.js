const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
    // Add any IPC bridges here if needed
    platform: process.platform,
});
