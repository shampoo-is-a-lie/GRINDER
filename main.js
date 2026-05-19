'use strict';
const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs   = require('fs');
const { spawn, execSync } = require('child_process');
const Database = require('better-sqlite3');

// ── Paths ─────────────────────────────────────────────────────────────────────
const configDir = app.isPackaged
    ? path.join(path.dirname(process.execPath), 'GRINDERConfig')
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
}

// ── External tool helpers ─────────────────────────────────────────────────────
function which(bin) {
    try { return execSync(`which ${bin}`, { stdio: ['ignore','pipe','ignore'] }).toString().trim(); }
    catch { return null; }
}

function findLegendary() { return which('legendary'); }
function findUmu()       { return which('umu-run'); }

// ── Launch engine ─────────────────────────────────────────────────────────────
async function launchGame(gameId) {
    const game = db.prepare('SELECT * FROM games WHERE id = ?').get(gameId);
    if (!game)          throw new Error(`Game "${gameId}" not found in GRINDER database.`);
    if (!game.installed) throw new Error(`"${game.title}" is not marked as installed.`);

    const prefix  = game.prefix_path || path.join(prefixesDir, gameId);
    const proton  = game.proton_path  || db.prepare("SELECT value FROM settings WHERE key='default_proton_path'").get()?.value || '';

    fs.mkdirSync(prefix, { recursive: true });

    // Epic: delegate to Legendary which handles EOS, cloud saves, etc.
    if (game.store === 'epic') {
        const legendary = findLegendary();
        if (legendary) {
            spawn(legendary, ['launch', game.app_id], { detached: true, stdio: 'ignore' }).unref();
            return { ok: true, method: 'legendary' };
        }
    }

    // Universal: umu-run (preferred) or raw Wine/Proton
    const exe = path.join(game.install_path || '', game.executable || '');
    if (!game.executable || !fs.existsSync(exe)) {
        throw new Error(`Executable not found: ${exe || '(not set)'}`);
    }

    const env = {
        ...process.env,
        WINEPREFIX: prefix,
        PROTONPATH:  proton,
        GAMEID:      game.app_id || `grinder-${gameId}`,
    };

    const umu = findUmu();
    if (umu) {
        spawn(umu, [exe], { env, detached: true, stdio: 'ignore' }).unref();
        return { ok: true, method: 'umu-run' };
    }

    // Last resort: raw Wine
    const wine = proton ? path.join(proton, 'bin', 'wine') : 'wine';
    spawn(wine, [exe], { env, detached: true, stdio: 'ignore' }).unref();
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

ipcMain.handle('launch-game', async (_, gameId) => {
    try   { return await launchGame(gameId); }
    catch (e) { return { ok: false, error: e.message }; }
});

// Settings
ipcMain.handle('get-setting', (_, key) => db.prepare("SELECT value FROM settings WHERE key=?").get(key)?.value ?? null);
ipcMain.handle('set-setting', (_, key, value) => { db.prepare("INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)").run(key, value); return true; });

// Environment checks
ipcMain.handle('check-tools', () => ({
    legendary: findLegendary(),
    umu:       findUmu(),
    wine:      which('wine'),
}));

ipcMain.handle('open-path', (_, p) => shell.openPath(p));
ipcMain.handle('get-config-dir', () => configDir);
