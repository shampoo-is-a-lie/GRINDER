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
    deleteGame:          (id)     => ipcRenderer.invoke('delete-game', id),
    uninstallGameFiles:  (id)     => ipcRenderer.invoke('uninstall-game-files', id),
    launchGame: (id)     => ipcRenderer.invoke('launch-game', id),

    // Settings
    getSetting: (k)    => ipcRenderer.invoke('get-setting', k),
    setSetting: (k, v) => ipcRenderer.invoke('set-setting', k, v),

    // Disk size (installed game)
    getDiskSize:      (p)              => ipcRenderer.invoke('get-disk-size', p),
    verifyInstalls:   ()               => ipcRenderer.invoke('verify-installs'),
    // Pre-install size info
    gogInstallInfo:   (id, platform)   => ipcRenderer.invoke('gog-install-info', id, platform),
    epicInstallInfo:  (appName)        => ipcRenderer.invoke('epic-install-info', appName),
    getDiskSpace:     (path)           => ipcRenderer.invoke('get-disk-space', path),

    // Environment
    checkTools:   () => ipcRenderer.invoke('check-tools'),
    openPath:     (p) => ipcRenderer.invoke('open-path', p),
    getConfigDir: () => ipcRenderer.invoke('get-config-dir'),
    scanProton:   () => ipcRenderer.invoke('scan-proton'),
    installUmu:   () => ipcRenderer.invoke('install-umu'),
    onUmuInstallProgress: (cb) => ipcRenderer.on('umu-install-progress', (_, data) => cb(data)),

    // GOG
    gogStatus:          ()                    => ipcRenderer.invoke('gog-status'),
    gogLogin:           ()                    => ipcRenderer.invoke('gog-login'),
    gogLogout:          ()                    => ipcRenderer.invoke('gog-logout'),
    gogListOwned:       ()                    => ipcRenderer.invoke('gog-list-owned'),
    gogImport:          (games)               => ipcRenderer.invoke('gog-import', games),
    gogSyncPlatforms:   (games)               => ipcRenderer.invoke('gog-sync-platforms', games),
    gogInstall:         (id, platform, dir)   => ipcRenderer.invoke('gogdl-install', id, platform, dir),
    gogCancelInstall:   ()                    => ipcRenderer.invoke('gogdl-cancel-install'),
    onGogLoginProgress:   (cb) => ipcRenderer.on('gog-login-progress',   (_, d) => cb(d)),
    onGogInstallProgress: (cb) => ipcRenderer.on('gog-install-progress', (_, d) => cb(d)),
    onCliSearch:          (cb) => ipcRenderer.on('cli-search', (_, term) => cb(term)),

    // Legendary / Epic
    legendaryStatus:       () => ipcRenderer.invoke('legendary-status'),
    legendaryLogin:        () => ipcRenderer.invoke('legendary-login'),
    legendaryListOwned:    () => ipcRenderer.invoke('legendary-list-owned'),
    legendaryListInstalled:() => ipcRenderer.invoke('legendary-list-installed'),
    legendaryImport:       (games) => ipcRenderer.invoke('legendary-import', games),
    onLegendaryLoginProgress: (cb) => ipcRenderer.on('legendary-login-progress', (_, d) => cb(d)),

    // Installation
    selectDirectory:      ()             => ipcRenderer.invoke('select-directory'),
    installGame:          (id, dir)      => ipcRenderer.invoke('legendary-install', id, dir),
    cancelInstall:        ()             => ipcRenderer.invoke('legendary-cancel-install'),
    getInstallInfo:       (id)           => ipcRenderer.invoke('legendary-install-info', id),
    uninstallGame:        (id)           => ipcRenderer.invoke('legendary-uninstall', id),
    onInstallProgress:    (cb)           => ipcRenderer.on('install-progress', (_, d) => cb(d)),
});
