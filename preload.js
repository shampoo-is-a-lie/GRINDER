const { contextBridge, ipcRenderer, webFrame } = require('electron');

contextBridge.exposeInMainWorld('api', {
    // Window controls
    minimize:    () => ipcRenderer.send('window-minimize'),
    maximize:    () => ipcRenderer.send('window-maximize'),
    close:       () => ipcRenderer.send('window-close'),
    signalReady: () => ipcRenderer.send('renderer-ready'),

    // UI scale
    setZoom: (f) => webFrame.setZoomFactor(f),

    // Games
    getGames:   ()       => ipcRenderer.invoke('get-games'),
    addGame:    (data)   => ipcRenderer.invoke('add-game', data),
    updateGame: (id, d)  => ipcRenderer.invoke('update-game', id, d),
    deleteGame: (id)     => ipcRenderer.invoke('delete-game', id),
    launchGame: (id)     => ipcRenderer.invoke('launch-game', id),

    // Settings
    getSetting: (k)    => ipcRenderer.invoke('get-setting', k),
    setSetting: (k, v) => ipcRenderer.invoke('set-setting', k, v),

    // Environment
    checkTools:   () => ipcRenderer.invoke('check-tools'),
    openPath:     (p) => ipcRenderer.invoke('open-path', p),
    getConfigDir: () => ipcRenderer.invoke('get-config-dir'),
    scanProton:   () => ipcRenderer.invoke('scan-proton'),
});
