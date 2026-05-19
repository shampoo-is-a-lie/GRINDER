'use strict';
const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const fs   = require('fs');
const os   = require('os');
const { spawn, execSync } = require('child_process');
const Database = require('better-sqlite3');

// ── Paths ─────────────────────────────────────────────────────────────────────
const configDir = app.isPackaged
    ? app.getPath('userData')          // ~/.config/grinder on Linux (Electron uses lowercase app name)
    : path.join(__dirname, 'GRINDERConfig');

const prefixesDir = path.join(configDir, 'prefixes');
const dbPath      = path.join(configDir, 'grinder.db');

let db;
let win;

// ── CLI mode detection ────────────────────────────────────────────────────────
// Called as: GRINDER.AppImage launch <game_id>
const allArgs    = process.argv;
const launchIdx  = allArgs.indexOf('launch');
const cliGameId  = launchIdx !== -1 ? allArgs[launchIdx + 1] : null;
const cliMode    = !!cliGameId;

// ── Database ──────────────────────────────────────────────────────────────────
function initDb() {
    fs.mkdirSync(configDir,  { recursive: true });
    fs.mkdirSync(prefixesDir, { recursive: true });

    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');

    db.exec(`
        CREATE TABLE IF NOT EXISTS games (
            id           TEXT PRIMARY KEY,
            title        TEXT NOT NULL,
            store        TEXT NOT NULL DEFAULT 'custom',
            app_id       TEXT,
            install_path TEXT,
            executable   TEXT,
            prefix_path  TEXT,
            proton_path  TEXT,
            installed    INTEGER DEFAULT 0,
            version      TEXT,
            notes        TEXT,
            added_at     INTEGER DEFAULT (strftime('%s','now'))
        );
        CREATE TABLE IF NOT EXISTS settings (
            key   TEXT PRIMARY KEY,
            value TEXT
        );
    `);
    // Migrations
    try { db.prepare("ALTER TABLE games ADD COLUMN platform TEXT").run(); } catch(e) {}
}

// ── Proton scanner ────────────────────────────────────────────────────────────
const HOME = os.homedir();

// All directories that may contain Proton installations
const PROTON_DIRS = [
    // Steam native (multiple common paths)
    path.join(HOME, '.steam', 'root', 'steamapps', 'common'),
    path.join(HOME, '.steam', 'steam', 'steamapps', 'common'),
    path.join(HOME, '.local', 'share', 'Steam', 'steamapps', 'common'),
    // GE-Proton and custom compatibility tools
    path.join(HOME, '.steam', 'root', 'compatibilitytools.d'),
    path.join(HOME, '.steam', 'steam', 'compatibilitytools.d'),
    path.join(HOME, '.local', 'share', 'Steam', 'compatibilitytools.d'),
    // Flatpak Steam
    path.join(HOME, '.var', 'app', 'com.valvesoftware.Steam', 'data', 'Steam', 'steamapps', 'common'),
    path.join(HOME, '.var', 'app', 'com.valvesoftware.Steam', 'data', 'Steam', 'compatibilitytools.d'),
];

function scanProtonVersions() {
    const found = [];
    const seen  = new Set();

    for (const dir of PROTON_DIRS) {
        if (!fs.existsSync(dir)) continue;
        let entries;
        try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
        catch { continue; }

        for (const entry of entries) {
            if (!entry.isDirectory()) continue;
            const fullPath = path.join(dir, entry.name);
            // Resolve symlinks so ~/.steam/root, ~/.steam/steam, ~/.local/share/Steam
            // (which are all symlinks to the same location) don't produce duplicates.
            const realPath = (() => { try { return fs.realpathSync(fullPath); } catch { return fullPath; } })();
            if (seen.has(realPath)) continue;

            // A valid Proton dir has a 'proton' script and/or toolmanifest.vdf
            const isProton =
                fs.existsSync(path.join(realPath, 'proton')) ||
                fs.existsSync(path.join(realPath, 'toolmanifest.vdf')) ||
                fs.existsSync(path.join(realPath, 'compatibilitytool.vdf'));

            if (!isProton) continue;
            seen.add(realPath);

            const name = entry.name;
            let type = 'other';
            if (/^GE-Proton|^Proton-GE/i.test(name))  type = 'ge';
            else if (/^Proton/i.test(name))             type = 'steam';

            found.push({ name, path: realPath, type });
        }
    }

    // Sort: GE-Proton first (usually preferred), then Steam Proton, then others.
    // Within each group, newest (highest version number) first.
    const order = { ge: 0, steam: 1, other: 2 };
    return found.sort((a, b) => {
        const to = (order[a.type] ?? 2) - (order[b.type] ?? 2);
        if (to !== 0) return to;
        return b.name.localeCompare(a.name, undefined, { numeric: true, sensitivity: 'base' });
    });
}

// Expand ~ to HOME so spawn() (which doesn't use a shell) gets real paths
function expandTilde(p) {
    if (!p) return p;
    if (p === '~') return HOME;
    if (p.startsWith('~/')) return path.join(HOME, p.slice(2));
    return p;
}

// ── Bundled binary paths ──────────────────────────────────────────────────────
// In packaged AppImage, extraResources land in process.resourcesPath/assets/bin/linux.
// In dev, they live in __dirname/assets/bin/linux.
const binDir = app.isPackaged
    ? path.join(process.resourcesPath, 'assets', 'bin', 'linux')
    : path.join(__dirname, 'assets', 'bin', 'linux');

const BUNDLED_LEGENDARY = path.join(binDir, 'legendary');
const BUNDLED_GOGDL     = path.join(binDir, 'gogdl');

// ── External tool helpers ─────────────────────────────────────────────────────
function which(bin) {
    try { return execSync(`which ${bin}`, { stdio: ['ignore','pipe','ignore'] }).toString().trim(); }
    catch { return null; }
}

// Prefer bundled legendary; fall back to system install
function findLegendary() {
    if (fs.existsSync(BUNDLED_LEGENDARY)) return BUNDLED_LEGENDARY;
    return which('legendary');
}
function findGogdl() {
    if (fs.existsSync(BUNDLED_GOGDL)) return BUNDLED_GOGDL;
    return which('gogdl');
}
// umu-run cannot be bundled (Python module); detect system install only
function findUmu() { return which('umu-run'); }

// ── Launch engine ─────────────────────────────────────────────────────────────
async function launchGame(gameId) {
    const game = db.prepare('SELECT * FROM games WHERE id = ?').get(gameId);
    if (!game)           throw new Error(`Game "${gameId}" not found in GRINDER database.`);
    if (!game.installed) throw new Error(`"${game.title}" is not marked as installed.`);

    const prefix = expandTilde(game.prefix_path) || (() => {
        const legacy = path.join(prefixesDir, gameId);
        if (fs.existsSync(legacy)) return legacy;
        const safeName = (game.title || gameId).replace(/[/\\:*?"<>|]/g, '').trim().slice(0, 64) || gameId;
        return path.join(prefixesDir, safeName);
    })();
    const proton = expandTilde(game.proton_path)
        || db.prepare("SELECT value FROM settings WHERE key='default_proton_path'").get()?.value
        || '';

    fs.mkdirSync(prefix, { recursive: true });

    // Resolve exe to an absolute path, expanding ~ in the stored install_path
    const installPath = expandTilde(game.install_path || '');
    const exe = installPath && game.executable ? path.join(installPath, game.executable) : '';

    const umu = findUmu();

    // Epic: try direct exe via umu-run first; fall back to legendary (handles EOS/cloud saves)
    if (game.store === 'epic') {
        if (exe && fs.existsSync(exe) && umu) {
            const env = {
                ...process.env,
                WINEPREFIX: prefix,
                PROTONPATH:  proton,
                GAMEID:      game.app_id || `grinder-${gameId}`,
            };
            spawn(umu, [exe], { env, detached: true, stdio: 'ignore' }).unref();
            return { ok: true, method: 'umu-run' };
        }
        const legendary = findLegendary();
        if (legendary) {
            spawn(legendary, ['launch', game.app_id], { detached: true, stdio: 'ignore' }).unref();
            return { ok: true, method: 'legendary' };
        }
        throw new Error('Cannot launch: exe not found, umu-run not available, and legendary not found.');
    }

    // Non-Epic: validate exe
    if (!exe || !fs.existsSync(exe)) {
        throw new Error(`Executable not found: ${exe || '(not set)'}`);
    }

    // Linux native games (GOG linux builds, custom native apps): run directly
    if (game.platform === 'linux') {
        try { fs.chmodSync(exe, '755'); } catch {}
        spawn(exe, [], { detached: true, stdio: 'ignore' }).unref();
        return { ok: true, method: 'native' };
    }

    // Launch priority:
    // 1. umu-run (best compatibility — DXVK/VKD3D managed automatically)
    // 2. Direct Proton invocation (requires Proton path set)
    // 3. Raw Wine (last resort)
    if (umu) {
        const env = {
            ...process.env,
            WINEPREFIX: prefix,
            PROTONPATH:  proton,
            GAMEID:      game.app_id || `grinder-${gameId}`,
        };
        spawn(umu, [exe], { env, detached: true, stdio: 'ignore' }).unref();
        return { ok: true, method: 'umu-run' };
    }

    if (proton) {
        const steamRoot = which('steam') ? path.dirname(which('steam')) : path.join(HOME, '.steam', 'root');
        const env = {
            ...process.env,
            WINEPREFIX:                       prefix,
            STEAM_COMPAT_DATA_PATH:           prefix,
            STEAM_COMPAT_CLIENT_INSTALL_PATH: steamRoot,
        };
        const protonBin = path.join(proton, 'proton');
        if (!fs.existsSync(protonBin)) throw new Error(`proton script not found in ${proton}`);
        spawn(protonBin, ['run', exe], { env, detached: true, stdio: 'ignore' }).unref();
        return { ok: true, method: 'proton-direct' };
    }

    const wine = which('wine');
    if (!wine) throw new Error('No launch method: umu-run not found, no Proton path set, wine not installed.');
    spawn(wine, [exe], { env: { ...process.env, WINEPREFIX: prefix }, detached: true, stdio: 'ignore' }).unref();
    return { ok: true, method: 'wine' };
}

// ── Window ────────────────────────────────────────────────────────────────────
function createWindow() {
    win = new BrowserWindow({
        width: 1100, height: 700,
        minWidth: 800, minHeight: 500,
        frame: false,
        show: false,
        backgroundColor: '#1a0f0a',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        }
    });
    win.setMenu(null);
    win.loadFile('index.html');

    const showWin = () => { if (!win.isVisible()) win.show(); };
    ipcMain.once('renderer-ready', showWin);
    win.once('ready-to-show', () => setTimeout(showWin, 2000));
}

// ── App lifecycle ─────────────────────────────────────────────────────────────
if (cliMode) {
    // Headless CLI: launch game and exit
    app.disableHardwareAcceleration();
    app.whenReady().then(() => {
        initDb();
        launchGame(cliGameId)
            .then(r  => { console.log(`GRINDER: launched via ${r.method}`); setTimeout(() => app.quit(), 300); })
            .catch(e => { console.error('GRINDER error:', e.message); app.quit(); });
    });
} else {
    app.whenReady().then(() => {
        initDb();
        createWindow();
    });
    app.on('window-all-closed', () => app.quit());
}

// ── IPC handlers ──────────────────────────────────────────────────────────────

ipcMain.on('window-minimize', () => BrowserWindow.getFocusedWindow()?.minimize());
ipcMain.on('window-maximize', () => {
    const w = BrowserWindow.getFocusedWindow();
    if (w) w.isMaximized() ? w.unmaximize() : w.maximize();
});
ipcMain.on('window-close',    () => BrowserWindow.getFocusedWindow()?.close());

// Games
ipcMain.handle('get-games', () => db.prepare('SELECT * FROM games ORDER BY title COLLATE NOCASE').all());

ipcMain.handle('add-game', (_, data) => {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    db.prepare(`
        INSERT INTO games (id, title, store, app_id, install_path, executable, prefix_path, proton_path, installed, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, data.title || 'Unnamed', data.store || 'custom', data.app_id || null,
           data.install_path || null, data.executable || null,
           data.prefix_path || null, data.proton_path || null,
           data.installed ? 1 : 0, data.notes || null);
    return id;
});

ipcMain.handle('update-game', (_, id, data) => {
    const allowed = ['title','store','app_id','install_path','executable','prefix_path','proton_path','installed','version','notes'];
    const entries = Object.entries(data).filter(([k]) => allowed.includes(k));
    if (!entries.length) return false;
    const set = entries.map(([k]) => `${k}=?`).join(', ');
    const vals = entries.map(([,v]) => v);
    db.prepare(`UPDATE games SET ${set} WHERE id=?`).run(...vals, id);
    return true;
});

ipcMain.handle('delete-game', (_, id) => { db.prepare('DELETE FROM games WHERE id=?').run(id); return true; });

ipcMain.handle('uninstall-game-files', async (_, id) => {
    const game = db.prepare('SELECT * FROM games WHERE id=?').get(id);
    if (!game) return { ok: false, error: 'Game not found.' };

    const errors = [];

    const installPath = expandTilde(game.install_path || '');
    if (installPath && fs.existsSync(installPath)) {
        try { fs.rmSync(installPath, { recursive: true, force: true }); }
        catch (e) { errors.push(`Game files: ${e.message}`); }
    }

    const prefixPath = expandTilde(game.prefix_path) || (() => {
        const legacy = path.join(prefixesDir, id);
        if (fs.existsSync(legacy)) return legacy;
        const safeName = (game.title || id).replace(/[/\\:*?"<>|]/g, '').trim().slice(0, 64) || id;
        return path.join(prefixesDir, safeName);
    })();
    if (fs.existsSync(prefixPath)) {
        try { fs.rmSync(prefixPath, { recursive: true, force: true }); }
        catch (e) { errors.push(`Prefix: ${e.message}`); }
    }

    // For Epic games, also tell legendary to remove its own install record
    if (game.store === 'epic' && game.app_id) {
        const leg = findLegendary();
        if (leg) await new Promise(resolve => {
            const proc = spawn(leg, ['uninstall', game.app_id, '-y'], { stdio: 'ignore' });
            proc.on('close', resolve);
            proc.on('error', resolve);
        });
    }

    db.prepare("UPDATE games SET installed=0, install_path=NULL, executable=NULL, version=NULL WHERE id=?").run(id);

    return errors.length ? { ok: false, error: errors.join('; ') } : { ok: true };
});

ipcMain.handle('launch-game', async (_, gameId) => {
    try   { return await launchGame(gameId); }
    catch (e) { return { ok: false, error: e.message }; }
});

// Settings
ipcMain.handle('get-setting', (_, key) => db.prepare("SELECT value FROM settings WHERE key=?").get(key)?.value ?? null);
ipcMain.handle('set-setting', (_, key, value) => { db.prepare("INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)").run(key, value); return true; });

// Environment checks
ipcMain.handle('check-tools', () => {
    const leg   = findLegendary();
    const gogdl = findGogdl();
    return {
        legendary:         leg,
        legendary_bundled: leg === BUNDLED_LEGENDARY,
        gogdl:             gogdl,
        gogdl_bundled:     gogdl === BUNDLED_GOGDL,
        umu:               findUmu(),
        wine:              which('wine'),
    };
});

ipcMain.handle('open-path', (_, p) => shell.openPath(p));

ipcMain.handle('verify-installs', () => {
    const installed = db.prepare("SELECT id, install_path FROM games WHERE installed=1").all();
    let reset = 0;
    for (const g of installed) {
        const p = expandTilde(g.install_path || '');
        if (!p || !fs.existsSync(p)) {
            db.prepare("UPDATE games SET installed=0, install_path=NULL, executable=NULL, version=NULL WHERE id=?").run(g.id);
            reset++;
        }
    }
    return { reset };
});

ipcMain.handle('get-disk-size', (_, dirPath) => {
    const resolved = expandTilde(dirPath);
    if (!resolved || !fs.existsSync(resolved)) return null;
    return new Promise(resolve => {
        const { exec } = require('child_process');
        exec(`du -sh "${resolved}" 2>/dev/null`, { timeout: 15000 }, (err, stdout) => {
            resolve(err ? null : stdout.split('\t')[0].trim());
        });
    });
});
ipcMain.handle('get-config-dir', () => configDir);

// Proton
ipcMain.handle('scan-proton', () => scanProtonVersions());

// ── Legendary / Epic ──────────────────────────────────────────────────────────

function runLegendary(args) {
    const leg = findLegendary();
    if (!leg) return Promise.resolve({ ok: false, error: 'legendary not found' });
    return new Promise(resolve => {
        let out = '', err = '';
        const proc = spawn(leg, args, { stdio: ['ignore', 'pipe', 'pipe'] });
        proc.stdout.on('data', d => out += d);
        proc.stderr.on('data', d => err += d);
        proc.on('close', code => resolve({ ok: code === 0, stdout: out, stderr: err, code }));
        proc.on('error', e => resolve({ ok: false, error: e.message }));
    });
}

// Check if logged in
ipcMain.handle('legendary-status', async () => {
    const r = await runLegendary(['status']);
    if (!r.ok && r.error) return { ok: false, error: r.error };
    const text = r.stdout + r.stderr;
    const loggedIn = !text.includes('<not logged in>');
    const accountMatch = text.match(/Epic account:\s*(.+)/);
    const gamesMatch   = text.match(/Games available:\s*(\d+)/);
    return {
        ok: true,
        logged_in: loggedIn,
        account:   loggedIn ? (accountMatch?.[1]?.trim() || 'unknown') : null,
        games_available: parseInt(gamesMatch?.[1] || '0'),
    };
});

// Open Epic login window and authenticate legendary
ipcMain.handle('legendary-login', event => {
    // legendary.gl/epiclogin is maintained by the legendary team and always uses
    // the current valid Epic client ID — avoids hardcoding one that can be revoked.
    const AUTH_URL = 'https://legendary.gl/epiclogin';
    const leg = findLegendary();
    if (!leg) return Promise.resolve({ ok: false, error: 'legendary not found' });

    return new Promise(resolve => {
        let resolved = false;

        const authWin = new BrowserWindow({
            width: 560, height: 780, title: 'Login to Epic Games — close when done',
            webPreferences: { nodeIntegration: false, contextIsolation: true },
        });
        authWin.setMenu(null);
        // Force a fresh page load so we always get a new authorization code,
        // not a cached one with an already-expired code.
        authWin.loadURL(AUTH_URL, { extraHeaders: 'Cache-Control: no-cache\nPragma: no-cache\n' });

        const send = d => { try { event.sender.send('legendary-login-progress', String(d)); } catch {} };

        async function tryExtract() {
            if (resolved) return;
            try {
                const text = await authWin.webContents.executeJavaScript('document.body.innerText');

                // Epic returns the code in multiple places — try all of them:
                // 1. redirectUrl query param:  ...?code=<authCode>
                // 2. authorizationCode field (current flow)
                // 3. exchangeCode field (older flow)
                const m = text.match(/"redirectUrl"\s*:\s*"[^"]*[?&]code=([^"&\\s]+)/) ||
                          text.match(/"authorizationCode"\s*:\s*"([^"]+)"/) ||
                          text.match(/"exchangeCode"\s*:\s*"([^"]+)"/);
                if (!m) return;

                resolved = true;
                authWin.close();
                send(`Extracted auth code, running legendary auth...\n`);

                const proc = spawn(leg, ['auth', '--code', m[1]], { stdio: ['ignore', 'pipe', 'pipe'] });
                proc.stdout.on('data', send);
                proc.stderr.on('data', send);
                proc.on('close', exitCode => {
                    if (exitCode !== 0) {
                        // Show legendary's log file so the user can see what went wrong
                        try {
                            const logPath = path.join(HOME, '.config', 'legendary', 'logs', 'legendary.log');
                            const log = fs.readFileSync(logPath, 'utf8');
                            const tail = log.split('\n').slice(-25).join('\n');
                            send(`\n--- legendary log (last 25 lines) ---\n${tail}\n`);
                        } catch { send('\n(Could not read legendary log)\n'); }
                    }
                    resolve({ ok: exitCode === 0 });
                });
                proc.on('error', e => resolve({ ok: false, error: e.message }));
            } catch {}
        }

        authWin.webContents.on('did-finish-load',     tryExtract);
        authWin.webContents.on('did-navigate',         tryExtract);
        authWin.webContents.on('did-navigate-in-page', tryExtract);
        setTimeout(tryExtract, 1500);
        authWin.on('closed', () => { if (!resolved) resolve({ ok: false, error: 'Window closed before login completed.' }); });
    });
});

// List all owned Epic games (installed or not via legendary)
ipcMain.handle('legendary-list-owned', async () => {
    const r = await runLegendary(['list', '--json']);
    if (!r.ok && r.error) return { ok: false, error: r.error };
    try {
        const all = JSON.parse(r.stdout);
        return {
            ok: true,
            games: all.map(g => ({
                app_name:     g.app_name,
                title:        g.app_title || g.metadata?.title || 'Unknown',
                is_dlc:       false,
                install_path: null,
                executable:   null,
                version:      null,
            }))
        };
    } catch { return { ok: false, error: 'Failed to parse legendary output.' }; }
});

// List games that legendary itself has installed (subset of owned)
ipcMain.handle('legendary-list-installed', async () => {
    const r = await runLegendary(['list-installed', '--json']);
    if (!r.ok && r.error) return { ok: false, error: r.error };
    try {
        const all = JSON.parse(r.stdout);
        return { ok: true, games: all.filter(g => !g.is_dlc) };
    } catch { return { ok: false, error: 'Failed to parse legendary output.' }; }
});

// ── Game installation ─────────────────────────────────────────────────────────
let activeInstallProc = null;

// Directory picker dialog
ipcMain.handle('select-directory', async () => {
    const result = await dialog.showOpenDialog(win, {
        title: 'Choose Install Directory',
        properties: ['openDirectory', 'createDirectory'],
    });
    return result.canceled ? null : result.filePaths[0];
});

// Start installing a game via legendary
ipcMain.handle('legendary-install', (event, appName, installDir) => {
    if (activeInstallProc) return { ok: false, error: 'An installation is already in progress.' };
    const leg = findLegendary();
    if (!leg) return { ok: false, error: 'legendary not found.' };

    const dir = expandTilde(installDir) || path.join(HOME, 'Games', 'CafeNeurotico');
    try { fs.mkdirSync(dir, { recursive: true }); } catch {}

    const send = d => { try { event.sender.send('install-progress', String(d)); } catch {} };

    return new Promise(resolve => {
        // -y skips interactive prompts; --skip-sdl skips SDL check
        activeInstallProc = spawn(leg, ['install', appName, '--base-path', dir, '-y'], {
            stdio: ['ignore', 'pipe', 'pipe'],
        });

        activeInstallProc.stdout.on('data', send);
        activeInstallProc.stderr.on('data', send);

        activeInstallProc.on('close', async code => {
            activeInstallProc = null;
            if (code === 0) {
                // Get actual install path and executable from legendary
                const info = await getGameInstallInfo(appName);
                resolve({ ok: true, info });
            } else {
                resolve({ ok: false, exitCode: code });
            }
        });
        activeInstallProc.on('error', e => { activeInstallProc = null; resolve({ ok: false, error: e.message }); });
    });
});

// Cancel an in-progress installation
ipcMain.handle('legendary-cancel-install', () => {
    if (!activeInstallProc) return { ok: false };
    activeInstallProc.kill('SIGTERM');
    activeInstallProc = null;
    return { ok: true };
});

// Get install path/exe for a specific game from legendary
async function getGameInstallInfo(appName) {
    const r = await runLegendary(['list-installed', '--json']);
    if (!r.ok) return null;
    try {
        const all = JSON.parse(r.stdout);
        return all.find(g => g.app_name === appName) || null;
    } catch { return null; }
}
ipcMain.handle('legendary-install-info', (_, appName) => getGameInstallInfo(appName));

// Uninstall a game via legendary
ipcMain.handle('legendary-uninstall', (event, appName) => {
    const leg = findLegendary();
    if (!leg) return { ok: false, error: 'legendary not found.' };
    return new Promise(resolve => {
        const proc = spawn(leg, ['uninstall', appName, '-y'], { stdio: ['ignore', 'pipe', 'pipe'] });
        proc.on('close', code => resolve({ ok: code === 0 }));
        proc.on('error', e => resolve({ ok: false, error: e.message }));
    });
});

// Import selected games into GRINDER DB
ipcMain.handle('legendary-import', (_, games) => {
    const stmt = db.prepare(`
        INSERT OR IGNORE INTO games (id, title, store, app_id, install_path, executable, installed, version)
        VALUES (?, ?, 'epic', ?, ?, ?, 0, ?)
    `);
    const tx = db.transaction(list => {
        let n = 0;
        for (const g of list) {
            // installed=0 by default — will be updated when user installs via GRINDER
        stmt.run('epic_' + g.app_name, g.title, g.app_name,
                     g.install_path || null, g.executable || null, g.version || null);
            n++;
        }
        return n;
    });
    try { return { ok: true, count: tx(games) }; }
    catch (e) { return { ok: false, error: e.message }; }
});

// ── GOG / gogdl ───────────────────────────────────────────────────────────────

const GOG_CLIENT_ID     = '46899977096215655';
const GOG_CLIENT_SECRET = '9d85c43b1482497dbbce61f6e4aa173a433796eeae2ca8c5f6129f2dc4de46d9';
const GOG_REDIRECT_URI  = 'https://embed.gog.com/on_login_success?origin=client';
const GOG_AUTH_URL      =
    `https://auth.gog.com/auth?client_id=${GOG_CLIENT_ID}` +
    `&layout=client2&redirect_uri=${encodeURIComponent(GOG_REDIRECT_URI)}&response_type=code`;

async function gogFetch(url, token) {
    const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}`, 'User-Agent': 'GRINDER/1.0' },
    });
    if (!res.ok) throw new Error(`GOG API ${res.status}: ${url}`);
    return res.json();
}

async function getGogToken() {
    const get = k => db.prepare("SELECT value FROM settings WHERE key=?").get(k)?.value;
    const access  = get('gog_access_token');
    const refresh = get('gog_refresh_token');
    const expiry  = parseInt(get('gog_token_expiry') || '0');

    if (!refresh) return null;
    if (access && Date.now() < expiry - 60000) return access;

    try {
        const res = await fetch('https://auth.gog.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id:     GOG_CLIENT_ID,
                client_secret: GOG_CLIENT_SECRET,
                grant_type:    'refresh_token',
                refresh_token: refresh,
            }).toString(),
        });
        const data = await res.json();
        if (!data.access_token) return null;
        const set = (k, v) => db.prepare("INSERT OR REPLACE INTO settings VALUES (?,?)").run(k, v);
        set('gog_access_token', data.access_token);
        set('gog_token_expiry', String(Date.now() + data.expires_in * 1000));
        if (data.refresh_token) set('gog_refresh_token', data.refresh_token);
        return data.access_token;
    } catch { return null; }
}

function writeGogAuthConfig() {
    const get    = k => db.prepare("SELECT value FROM settings WHERE key=?").get(k)?.value || '';
    const expiry = parseInt(get('gog_token_expiry') || '0');
    // gogdl expects the Heroic auth format: keyed by client_id
    const authPath = path.join(configDir, 'gogdl_auth.json');
    fs.writeFileSync(authPath, JSON.stringify({
        [GOG_CLIENT_ID]: {
            access_token:  get('gog_access_token'),
            refresh_token: get('gog_refresh_token'),
            user_id:       get('gog_user_id'),
            token_type:    'Bearer',
            expires_in:    Math.max(0, Math.floor((expiry - Date.now()) / 1000)),
            loginTime:     Math.floor((expiry - 3600000) / 1000),
        }
    }));
    return authPath;
}

ipcMain.handle('gog-status', async () => {
    const token = await getGogToken();
    if (!token) return { logged_in: false, gogdl: !!findGogdl() };
    try {
        const user = await gogFetch('https://embed.gog.com/userData.json', token);
        return { logged_in: true, username: user.username, userId: user.userId, gogdl: !!findGogdl() };
    } catch { return { logged_in: false, gogdl: !!findGogdl() }; }
});

ipcMain.handle('gog-login', event => {
    const send = d => { try { event.sender.send('gog-login-progress', String(d)); } catch {} };
    return new Promise(resolve => {
        let resolved = false;
        const authWin = new BrowserWindow({
            width: 600, height: 780, title: 'Login to GOG — close when done',
            webPreferences: { nodeIntegration: false, contextIsolation: true },
        });
        authWin.setMenu(null);
        authWin.loadURL(GOG_AUTH_URL);

        async function tryExtract() {
            if (resolved) return;
            const url   = authWin.webContents.getURL();
            const match = url.match(/[?&]code=([^&\s]+)/);
            if (!match) return;
            resolved = true;
            authWin.close();
            send('Exchanging auth code...\n');
            try {
                const res = await fetch('https://auth.gog.com/token', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({
                        client_id:     GOG_CLIENT_ID,
                        client_secret: GOG_CLIENT_SECRET,
                        grant_type:    'authorization_code',
                        code:          match[1],
                        redirect_uri:  GOG_REDIRECT_URI,
                    }).toString(),
                });
                const data = await res.json();
                if (!data.access_token) { resolve({ ok: false, error: `No token: ${JSON.stringify(data)}` }); return; }
                const set = (k, v) => db.prepare("INSERT OR REPLACE INTO settings VALUES (?,?)").run(k, v);
                set('gog_access_token',  data.access_token);
                set('gog_refresh_token', data.refresh_token);
                set('gog_token_expiry',  String(Date.now() + data.expires_in * 1000));
                const user = await gogFetch('https://embed.gog.com/userData.json', data.access_token);
                if (user.userId) set('gog_user_id', String(user.userId));
                send(`✓ Logged in as ${user.username}\n`);
                resolve({ ok: true, username: user.username });
            } catch (e) { resolve({ ok: false, error: e.message }); }
        }

        authWin.webContents.on('did-navigate',         tryExtract);
        authWin.webContents.on('did-navigate-in-page', tryExtract);
        authWin.on('closed', () => { if (!resolved) resolve({ ok: false, error: 'Window closed before login.' }); });
    });
});

ipcMain.handle('gog-logout', () => {
    for (const k of ['gog_access_token', 'gog_refresh_token', 'gog_token_expiry', 'gog_user_id'])
        db.prepare("DELETE FROM settings WHERE key=?").run(k);
    return true;
});

ipcMain.handle('gog-list-owned', async () => {
    const token = await getGogToken();
    if (!token) return { ok: false, error: 'Not logged in to GOG.' };
    try {
        const owned = await gogFetch('https://embed.gog.com/user/data/games', token);
        const ids   = owned.owned || [];
        if (!ids.length) return { ok: true, games: [] };

        const games = [];
        for (let i = 0; i < ids.length; i += 50) {
            const batch = ids.slice(i, i + 50).join(',');
            const data  = await gogFetch(`https://api.gog.com/products?ids=${batch}&expand=downloads`, token);
            const items = Array.isArray(data) ? data : [data];
            for (const item of items) {
                if (!item?.id) continue;
                const oses     = (item.downloads?.installers || []).map(x => x.os).filter(Boolean);
                const platform = oses.includes('linux') ? 'linux' : 'windows';
                games.push({ id: String(item.id), title: item.title || 'Unknown', platform });
            }
        }
        return { ok: true, games };
    } catch (e) { return { ok: false, error: e.message }; }
});

ipcMain.handle('gog-import', (_, games) => {
    const stmt = db.prepare(
        "INSERT OR IGNORE INTO games (id, title, store, app_id, platform, installed) VALUES (?, ?, 'gog', ?, ?, 0)"
    );
    const tx = db.transaction(list => {
        let n = 0;
        for (const g of list) { stmt.run('gog_' + g.id, g.title, g.id, g.platform || 'windows'); n++; }
        return n;
    });
    try { return { ok: true, count: tx(games) }; }
    catch (e) { return { ok: false, error: e.message }; }
});

let activeGogInstallProc = null;

ipcMain.handle('gogdl-install', (event, appId, platform, installDir) => {
    if (activeGogInstallProc) return { ok: false, error: 'An installation is already in progress.' };
    const gogdl = findGogdl();
    if (!gogdl) return { ok: false, error: 'gogdl not found. Place the gogdl binary in the same folder as GRINDER.AppImage.' };

    const dir = expandTilde(installDir) || path.join(HOME, 'Games', 'CafeNeurotico');
    try { fs.mkdirSync(dir, { recursive: true }); } catch {}

    // Ensure the binary is executable
    try { fs.chmodSync(gogdl, '755'); } catch {}

    const authPath = writeGogAuthConfig();
    const send = d => { try { event.sender.send('gog-install-progress', String(d)); } catch {} };

    return new Promise(resolve => {
        send(`Running: ${gogdl} --auth-config-path <auth> download ${appId} --platform ${platform} --path ${dir}\n`);
        activeGogInstallProc = spawn(gogdl, [
            '--auth-config-path', authPath,
            'download', appId,
            '--platform', platform,
            '--path',     dir,
            '--lang',     'en-US',
        ], { stdio: ['ignore', 'pipe', 'pipe'] });

        activeGogInstallProc.stdout.on('data', send);
        activeGogInstallProc.stderr.on('data', send);
        activeGogInstallProc.on('close', code => {
            activeGogInstallProc = null;
            try { fs.unlinkSync(authPath); } catch {}
            resolve({ ok: code === 0, exitCode: code, install_dir: dir });
        });
        activeGogInstallProc.on('error', e => {
            activeGogInstallProc = null;
            send(`\nSpawn error: ${e.message}\n`);
            resolve({ ok: false, error: e.message });
        });
    });
});

ipcMain.handle('gogdl-cancel-install', () => {
    if (!activeGogInstallProc) return { ok: false };
    activeGogInstallProc.kill('SIGTERM');
    activeGogInstallProc = null;
    return { ok: true };
});

// umu-run installer — tries pipx first, falls back to pip --user
ipcMain.handle('install-umu', (event) => {
    const pipx = which('pipx');
    const pip  = which('pip3') || which('pip');

    if (!pipx && !pip) {
        return { ok: false, error: 'Neither pipx nor pip found. Install pipx first:\n  Fedora: sudo dnf install pipx\n  Debian/Ubuntu: sudo apt install pipx\n  Arch: sudo pacman -S python-pipx' };
    }

    const cmd  = pipx || pip;
    const args = pipx ? ['install', 'umu-launcher'] : ['install', '--user', 'umu-launcher'];

    return new Promise(resolve => {
        const proc = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });

        const send = (data) => {
            try { event.sender.send('umu-install-progress', String(data)); } catch {}
        };

        proc.stdout.on('data', send);
        proc.stderr.on('data', send);
        proc.on('close', code => resolve({ ok: code === 0, exitCode: code, method: pipx ? 'pipx' : 'pip --user' }));
        proc.on('error', err => resolve({ ok: false, error: err.message }));
    });
});
