'use strict';

// ── Theme (reuses CNGM cache) ─────────────────────────────────────────────────
window.api.getSetting('cngm_theme').then(saved => {
    if (saved) {
        // Apply theme from DB if CNGM has set one — just reuse the cache already applied by the inline script
    }
    window.api.signalReady();
});

// ── State ─────────────────────────────────────────────────────────────────────
let allGames = [];
let selectedId = null;

// ── View switching ─────────────────────────────────────────────────────────────
const viewGames    = document.getElementById('view-games');
const viewSettings = document.getElementById('view-settings');

document.querySelectorAll('.nav-btn[data-view]').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.nav-btn[data-view]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const v = btn.dataset.view;
        viewGames.style.display    = v === 'games'    ? 'flex' : 'none';
        viewSettings.style.display = v === 'settings' ? 'block' : 'none';
        if (v === 'settings') loadSettings();
    });
});

// ── Window controls ───────────────────────────────────────────────────────────
document.getElementById('btn-min').addEventListener('click',   () => window.api.minimize());
document.getElementById('btn-max').addEventListener('click',   () => window.api.maximize());
document.getElementById('btn-close').addEventListener('click', () => window.api.close());

// ── Tool status indicators ────────────────────────────────────────────────────
async function checkTools() {
    const tools = await window.api.checkTools();
    function setDot(id, value) {
        const el = document.getElementById(id);
        if (!el) return;
        el.querySelector('.dot').className = 'dot ' + (value ? 'ok' : 'err');
        el.title = value || 'Not found';
    }
    setDot('status-legendary', tools.legendary);
    setDot('status-gogdl',     tools.gogdl);
    setDot('status-umu',       tools.umu);
    setDot('status-wine',      tools.wine);

    // Show install button only when umu is missing
    const umuWrap = document.getElementById('umu-install-wrap');
    if (umuWrap) umuWrap.style.display = tools.umu ? 'none' : 'flex';

    const info = document.getElementById('tools-info');
    if (!info) return;
    info.innerHTML = [
        `<strong style="color:var(--text_main)">legendary</strong>: ${
            tools.legendary
                ? (tools.legendary_bundled
                    ? `<span style="color:#66bb6a">✓ bundled (${tools.legendary})</span>`
                    : `<span style="color:#ffb74d">⚠ system install (${tools.legendary})</span>`)
                : '<span style="color:#ef5350">not found</span>'
        }`,
        `<strong style="color:var(--text_main)">gogdl</strong>: ${
            tools.gogdl
                ? (tools.gogdl_bundled
                    ? `<span style="color:#66bb6a">✓ bundled (${tools.gogdl})</span>`
                    : `<span style="color:#ffb74d">⚠ system install (${tools.gogdl})</span>`)
                : '<span style="color:var(--text_dim)">not found — required for GOG installation. Place gogdl binary next to GRINDER.AppImage.</span>'
        }`,
        `<strong style="color:var(--text_main)">umu-run</strong>: ${
            tools.umu
                ? `<span style="color:#66bb6a">✓ ${tools.umu}</span>`
                : '<span style="color:#ffb74d">not found — install via package manager for best compatibility. GRINDER will use direct Proton invocation as fallback.</span>'
        }`,
        `<strong style="color:var(--text_main)">wine</strong>: ${
            tools.wine
                ? `<span style="color:#66bb6a">✓ ${tools.wine}</span>`
                : '<span style="color:var(--text_dim)">not found (optional — only needed as last resort)</span>'
        }`,
    ].join('<br><br>');
}
checkTools();

// ── Games list ────────────────────────────────────────────────────────────────
function storeBadge(store) {
    const map = { epic: 'badge-epic', gog: 'badge-gog', custom: 'badge-custom' };
    const cls = map[store] || 'badge-custom';
    return `<span class="game-store-badge ${cls}">${store}</span>`;
}

function renderGames(games) {
    const list  = document.getElementById('games-list');
    const count = document.getElementById('status-count');
    count.textContent = `${games.length} game${games.length !== 1 ? 's' : ''}`;

    if (!games.length) {
        list.innerHTML = `<div id="empty-state"><p>NO GAMES YET</p><p style="font-size:11px">Click + Add Game to get started.</p></div>`;
        return;
    }

    list.innerHTML = games.map(g => `
        <div class="game-row ${g.id === selectedId ? 'selected' : ''}" data-id="${g.id}">
            <div class="game-row-main">
                ${storeBadge(g.store)}
                <span class="game-title">${g.title}</span>
                <div class="game-actions">
                    ${g.installed  ? `<button class="btn-launch" data-launch="${g.id}">▶ Launch</button>` : ''}
                    ${!g.installed && g.store === 'epic' ? `<button class="btn-install-game" data-install="${g.id}" style="background:#0078f2;border:none;color:#fff;border-radius:4px;padding:4px 10px;font-family:Raleway,sans-serif;font-weight:900;font-size:10px;cursor:pointer;letter-spacing:0.5px;">↓ Install</button>` : ''}
                    ${!g.installed && g.store === 'gog'  ? `<button class="btn-install-game" data-install="${g.id}" style="background:#9b59d9;border:none;color:#fff;border-radius:4px;padding:4px 10px;font-family:Raleway,sans-serif;font-weight:900;font-size:10px;cursor:pointer;letter-spacing:0.5px;">↓ Install</button>` : ''}
                    <button class="btn-edit" data-edit="${g.id}">Edit</button>
                    ${g.installed ? `<button class="btn-uninstall" data-uninstall="${g.id}">Uninstall</button>` : ''}
                    <button class="btn-delete" data-delete="${g.id}">✕</button>
                </div>
            </div>
            <div class="game-row-sub">
                ${g.installed && g.install_path ? `<span data-size="${g.id}" class="game-size-badge">…</span>` : ''}
                <span class="game-status ${g.installed ? 'status-installed' : 'status-uninstalled'}">
                    ${g.installed ? '● Installed' : '○ Not installed'}
                </span>
            </div>
        </div>
    `).join('');

    // Row selection
    list.querySelectorAll('.game-row').forEach(row => {
        row.addEventListener('click', () => {
            selectedId = row.dataset.id;
            renderGames(filterGames());
        });
    });

    // Launch buttons
    list.querySelectorAll('[data-launch]').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const id = btn.dataset.launch;
            const title = allGames.find(g=>g.id===id)?.title || '';
            setStatus(`Launching "${title}"...`);
            btn.textContent = '⏳ Launching…';
            btn.disabled = true;
            const result = await window.api.launchGame(id);
            btn.disabled = false;
            btn.textContent = '▶ Launch';
            setStatus(result.ok ? `Launched via ${result.method}.` : `Error: ${result.error}`);
        });
    });

    // Install buttons
    list.querySelectorAll('[data-install]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const game = allGames.find(g => g.id === btn.dataset.install);
            if (game) openInstallModal(game);
        });
    });

    // Edit buttons
    list.querySelectorAll('[data-edit]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            openModal(allGames.find(g => g.id === btn.dataset.edit));
        });
    });

    // Delete buttons
    list.querySelectorAll('[data-delete]').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const game = allGames.find(g => g.id === btn.dataset.delete);
            const confirmed = await showConfirm(
                `Remove ${game?.title}?`,
                `This will remove <span style="color:var(--text_main)">${game?.title}</span> from GRINDER's library.<br><br>
                 <span style="color:#66bb6a; font-size:11px;">Game files on disk are NOT deleted.</span>`
            );
            if (!confirmed) return;
            await window.api.deleteGame(game.id);
            if (selectedId === game.id) selectedId = null;
            await loadGames();
        });
    });

    // Uninstall buttons
    list.querySelectorAll('[data-uninstall]').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const game = allGames.find(g => g.id === btn.dataset.uninstall);
            if (!game) return;
            const confirmed = await showConfirm(
                `Uninstall ${game.title}?`,
                `This will permanently delete:<br><br>
                 <span style="color:var(--text_main)">● Game files</span><br>
                 <span style="color:var(--text_dim); font-size:11px;">${game.install_path || '(unknown path)'}</span><br><br>
                 <span style="color:var(--text_main)">● Wine prefix</span><br>
                 <span style="color:var(--text_dim); font-size:11px;">All save data and settings for this game</span><br><br>
                 <span style="color:#ef5350; font-size:11px; font-weight:900;">This cannot be undone.</span>`
            );
            if (!confirmed) return;
            btn.textContent = 'Removing…';
            btn.disabled = true;
            const result = await window.api.uninstallGameFiles(game.id);
            setStatus(result.ok ? `"${game.title}" uninstalled.` : `Error: ${result.error}`);
            await loadGames();
        });
    });
}

function filterGames() {
    const q = document.getElementById('search-input').value.toLowerCase();
    return q ? allGames.filter(g =>
        g.title.toLowerCase().includes(q) ||
        (g.store||'').toLowerCase().includes(q) ||
        (g.app_id||'').toLowerCase().includes(q)
    ) : allGames;
}

async function loadGames() {
    allGames = await window.api.getGames();
    renderGames(filterGames());
    loadGameSizes();
}

async function loadGameSizes() {
    const installed = allGames.filter(g => g.installed && g.install_path);
    for (const g of installed) {
        const el = document.querySelector(`[data-size="${g.id}"]`);
        if (!el) continue;
        const size = await window.api.getDiskSize(g.install_path);
        el.textContent = size || '';
    }
}

document.getElementById('search-input').addEventListener('input', () => renderGames(filterGames()));

document.getElementById('btn-verify-installs')?.addEventListener('click', async () => {
    const btn = document.getElementById('btn-verify-installs');
    btn.textContent = '⏳ Verifying…';
    btn.disabled = true;
    const { reset } = await window.api.verifyInstalls();
    await loadGames();
    btn.textContent = '✓ Verify';
    btn.disabled = false;
    setStatus(reset > 0
        ? `Reset ${reset} game${reset !== 1 ? 's' : ''} with missing files — ready to reinstall.`
        : 'All installed games verified OK.');
});

// ── Modal: Add / Edit game ─────────────────────────────────────────────────────
const modal = document.getElementById('modal-game');

function openModal(game = null) {
    document.getElementById('modal-title').textContent = game ? 'Edit Game' : 'Add Game';
    document.getElementById('edit-id').value           = game?.id           || '';
    document.getElementById('edit-title').value        = game?.title        || '';
    document.getElementById('edit-store').value        = game?.store        || 'custom';
    document.getElementById('edit-appid').value        = game?.app_id       || '';
    document.getElementById('edit-install-path').value = game?.install_path || '';
    document.getElementById('edit-exe').value          = game?.executable   || '';
    document.getElementById('edit-prefix').value       = game?.prefix_path  || '';
    populateProtonDropdown(protonVersions, game?.proton_path || '');
    document.getElementById('edit-notes').value        = game?.notes        || '';
    modal.classList.add('active');
    document.getElementById('edit-title').focus();
}

function closeModal() { modal.classList.remove('active'); }

document.getElementById('btn-add-game').addEventListener('click', () => openModal());
document.getElementById('btn-modal-cancel').addEventListener('click', closeModal);
modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });

document.getElementById('btn-modal-save').addEventListener('click', async () => {
    const id    = document.getElementById('edit-id').value;
    const title = document.getElementById('edit-title').value.trim();
    if (!title) { alert('Title is required.'); return; }

    const data = {
        title,
        store:        document.getElementById('edit-store').value,
        app_id:       document.getElementById('edit-appid').value.trim()       || null,
        install_path: document.getElementById('edit-install-path').value.trim() || null,
        executable:   document.getElementById('edit-exe').value.trim()          || null,
        prefix_path:  document.getElementById('edit-prefix').value.trim()       || null,
        proton_path:  document.getElementById('edit-proton').value               || null,
        notes:        document.getElementById('edit-notes').value.trim()         || null,
        installed:    document.getElementById('edit-install-path').value.trim() ? 1 : 0,
    };

    if (id) {
        await window.api.updateGame(id, data);
        setStatus(`Updated "${title}".`);
    } else {
        const newId = await window.api.addGame(data);
        setStatus(`Added "${title}" (ID: ${newId}).`);
    }
    closeModal();
    await loadGames();
});

// ── Installation ──────────────────────────────────────────────────────────────
const modalInstall = document.getElementById('modal-install');
let installingGame = null;

function openInstallModal(game) {
    installingGame = game;
    document.getElementById('install-modal-title').textContent  = 'Install Game';
    document.getElementById('install-modal-subtitle').textContent = game.title;
    document.getElementById('install-config-panel').style.display   = 'flex';
    document.getElementById('install-progress-panel').style.display = 'none';
    document.getElementById('install-done-panel').style.display     = 'none';
    document.getElementById('install-log').textContent = '';
    document.getElementById('install-progress-bar').style.width = '0%';
    document.getElementById('install-pct-label').textContent = '0%';
    document.getElementById('install-speed-label').textContent = '';
    document.getElementById('install-eta-label').textContent = '';

    // Pre-fill install dir from settings
    window.api.getSetting('default_install_dir').then(d => {
        document.getElementById('install-dir-input').value = d || '~/Games/CafeNeurotico';
    });

    modalInstall.classList.add('active');
}

function closeInstallModal() { modalInstall.classList.remove('active'); installingGame = null; }

document.getElementById('btn-install-cancel-pre')?.addEventListener('click', closeInstallModal);
document.getElementById('btn-install-done')?.addEventListener('click', () => { closeInstallModal(); loadGames(); });

document.getElementById('btn-browse-install-dir')?.addEventListener('click', async () => {
    const dir = await window.api.selectDirectory();
    if (dir) document.getElementById('install-dir-input').value = dir;
});

document.getElementById('btn-install-cancel-running')?.addEventListener('click', async () => {
    await window.api.cancelInstall();
    document.getElementById('install-log').textContent += '\n⚠ Installation cancelled.\n';
    document.getElementById('btn-install-cancel-running').disabled = true;
    setStatus('Installation cancelled.');
});

function parseProgress(line) {
    const pct   = line.match(/Progress:\s*([\d.]+)%/)?.[1];
    const speed = line.match(/([\d.]+\s*\w+\/s)/)?.[1];
    const eta   = line.match(/ETA:\s*([\d:]+)/)?.[1];
    return { pct: pct ? parseFloat(pct) : null, speed: speed || null, eta: eta || null };
}

window.api.onInstallProgress(data => {
    const log = document.getElementById('install-log');
    if (!log) return;
    log.textContent += data;
    log.scrollTop = log.scrollHeight;

    // Parse and update progress indicators
    const { pct, speed, eta } = parseProgress(data);
    if (pct !== null) {
        document.getElementById('install-progress-bar').style.width = pct + '%';
        document.getElementById('install-pct-label').textContent = pct.toFixed(1) + '%';
        setStatus(`Installing ${installingGame?.title || 'game'}: ${pct.toFixed(1)}%`);
    }
    if (speed) document.getElementById('install-speed-label').textContent = speed;
    if (eta)   document.getElementById('install-eta-label').textContent   = 'ETA ' + eta;
});

// GOG install progress feeds the same install log/bar
window.api.onGogInstallProgress(data => {
    const log = document.getElementById('install-log');
    if (!log) return;
    log.textContent += data;
    log.scrollTop = log.scrollHeight;

    const { pct, speed, eta } = parseProgress(data);
    if (pct !== null) {
        document.getElementById('install-progress-bar').style.width = pct + '%';
        document.getElementById('install-pct-label').textContent = pct.toFixed(1) + '%';
        setStatus(`Installing ${installingGame?.title || 'game'}: ${pct.toFixed(1)}%`);
    }
    if (speed) document.getElementById('install-speed-label').textContent = speed;
    if (eta)   document.getElementById('install-eta-label').textContent   = 'ETA ' + eta;
});

document.getElementById('btn-install-start')?.addEventListener('click', async () => {
    if (!installingGame) return;
    const dir = document.getElementById('install-dir-input').value.trim();
    if (!dir) { setStatus('Choose an install directory first.'); return; }

    await window.api.setSetting('default_install_dir', dir);

    document.getElementById('install-config-panel').style.display   = 'none';
    document.getElementById('install-progress-panel').style.display = 'flex';
    document.getElementById('btn-install-cancel-running').disabled  = false;
    setStatus(`Starting installation of ${installingGame.title}...`);

    let result;
    if (installingGame.store === 'gog') {
        result = await window.api.gogInstall(installingGame.app_id, installingGame.platform || 'windows', dir);
    } else {
        result = await window.api.installGame(installingGame.app_id, dir);
    }

    document.getElementById('install-progress-panel').style.display = 'none';

    if (result.ok) {
        if (installingGame.store === 'gog') {
            const gi = result.gameInfo;
            // Only store install_path if we found the actual game subfolder via goggame-*.info.
            // Falling back to the base dir (result.install_dir) would make uninstall delete
            // the entire CafeNeurotico folder — so leave it null if we can't determine the subdir.
            await window.api.updateGame(installingGame.id, {
                install_path: gi?.install_path || null,
                executable:   gi?.executable   || null,
                installed:    1,
            });
        } else {
            const info = result.info;
            if (info) {
                await window.api.updateGame(installingGame.id, {
                    install_path: info.install_path || null,
                    executable:   info.executable   || null,
                    version:      info.version       || null,
                    installed:    1,
                });
            } else {
                await window.api.updateGame(installingGame.id, { installed: 1 });
            }
        }
        document.getElementById('install-done-msg').textContent = `${installingGame.title} installed!`;
        document.getElementById('install-done-panel').style.display = 'flex';
        setStatus(`${installingGame.title} installed successfully.`);
    } else {
        document.getElementById('install-log').textContent += `\n✗ Installation failed (exit ${result.exitCode ?? result.error ?? 'error'}).\n`;
        document.getElementById('install-progress-panel').style.display = 'flex';
        document.getElementById('btn-install-cancel-running').textContent = 'Close';
        document.getElementById('btn-install-cancel-running').style.borderColor = 'var(--border_solid)';
        document.getElementById('btn-install-cancel-running').style.color = 'var(--text_sec)';
        document.getElementById('btn-install-cancel-running').onclick = closeInstallModal;
        setStatus(`Installation of ${installingGame.title} failed.`);
    }
});

// ── Legendary / Epic ──────────────────────────────────────────────────────────
let legendaryStatus = null;

async function refreshLegendaryStatus() {
    legendaryStatus = await window.api.legendaryStatus();
    const el = document.getElementById('s-legendary-status');
    const loginBtn  = document.getElementById('btn-s-epic-login');
    const logoutBtn = document.getElementById('btn-s-epic-logout');
    if (!el) return;
    if (!legendaryStatus.ok) {
        el.innerHTML = `<span style="color:#ef5350">legendary not found.</span>`;
        return;
    }
    if (legendaryStatus.logged_in) {
        el.innerHTML = `<span style="color:#66bb6a">✓ Logged in as <strong>${legendaryStatus.account}</strong></span>`;
        loginBtn.style.display  = 'none';
        logoutBtn.style.display = 'inline-block';
    } else {
        el.innerHTML = `<span style="color:var(--text_dim)">Not logged in to Epic Games.</span>`;
        loginBtn.style.display  = 'inline-block';
        logoutBtn.style.display = 'none';
    }
}

// Login flow (called from both Settings and Import modal)
async function doEpicLogin(progressElId) {
    const out = document.getElementById(progressElId);
    if (out) { out.style.display = 'block'; out.textContent = 'Opening Epic login window...\n'; }

    window.api.onLegendaryLoginProgress(data => {
        if (out) { out.textContent += data; out.scrollTop = out.scrollHeight; }
    });

    const result = await window.api.legendaryLogin();
    if (result.ok) {
        if (out) out.textContent += '\n✓ Login successful!\n';
        await refreshLegendaryStatus();
        return true;
    } else {
        if (out) out.textContent += `\n✗ ${result.error || 'Login failed.'}\n`;
        return false;
    }
}

document.getElementById('btn-s-epic-login')?.addEventListener('click', () => doEpicLogin(null));
document.getElementById('btn-s-epic-logout')?.addEventListener('click', async () => {
    await window.api.legendaryStatus(); // placeholder — legendary logout via CLI
    setStatus('Logged out of Epic.');
    await refreshLegendaryStatus();
});

// ── Import modal ──────────────────────────────────────────────────────────────
const modalImport   = document.getElementById('modal-import');
let importGames     = [];
let importSelected  = new Set();

// ── Import modal tab switching ─────────────────────────────────────────────────
function switchImportTab(tab) {
    document.getElementById('tab-panel-epic').style.display = tab === 'epic' ? 'flex' : 'none';
    document.getElementById('tab-panel-gog').style.display  = tab === 'gog'  ? 'flex' : 'none';
    document.getElementById('tab-epic').classList.toggle('active', tab === 'epic');
    document.getElementById('tab-gog').classList.toggle('active',  tab === 'gog');
}
document.getElementById('tab-epic')?.addEventListener('click', () => switchImportTab('epic'));
document.getElementById('tab-gog')?.addEventListener('click',  () => { switchImportTab('gog'); loadGogImportData(); });

function openImportModal(tab = 'epic') {
    modalImport.classList.add('active');
    switchImportTab(tab);
    if (tab === 'epic') loadImportData();
    else                loadGogImportData();
}
function closeImportModal() { modalImport.classList.remove('active'); }

document.getElementById('btn-import-legendary')?.addEventListener('click', () => openImportModal('epic'));
document.getElementById('btn-import-gog')?.addEventListener('click',       () => openImportModal('gog'));
document.getElementById('btn-import-cancel')?.addEventListener('click', closeImportModal);
document.getElementById('btn-gog-import-cancel')?.addEventListener('click', closeImportModal);
modalImport?.addEventListener('click', e => { if (e.target === modalImport) closeImportModal(); });

document.getElementById('btn-epic-login')?.addEventListener('click', async () => {
    document.getElementById('btn-epic-login').disabled = true;
    document.getElementById('btn-epic-login').textContent = '⏳ Opening login window...';
    const ok = await doEpicLogin('login-output');
    document.getElementById('btn-epic-login').disabled = false;
    document.getElementById('btn-epic-login').textContent = ok ? '✓ Logged in' : 'Login to Epic Games';
    if (ok) loadImportData();
});

async function loadImportData() {
    const status = legendaryStatus || await window.api.legendaryStatus();
    const loginPanel  = document.getElementById('import-login-panel');
    const gamesPanel  = document.getElementById('import-games-panel');
    const emptyPanel  = document.getElementById('import-empty');
    const confirmBtn  = document.getElementById('btn-import-confirm');
    const accountEl   = document.getElementById('import-account');

    if (!status.logged_in) {
        loginPanel.style.display  = 'block';
        gamesPanel.style.display  = 'none';
        emptyPanel.style.display  = 'none';
        confirmBtn.style.display  = 'none';
        return;
    }

    loginPanel.style.display = 'none';
    accountEl.textContent    = `✓ ${status.account}`;
    setStatus('Fetching installed Epic games...');

    const result = await window.api.legendaryListOwned();
    if (!result.ok || !result.games.length) {
        gamesPanel.style.display = 'none';
        emptyPanel.style.display = 'block';
        confirmBtn.style.display = 'none';
        setStatus(result.ok ? 'No Epic games found in your library.' : `Error: ${result.error}`);
        return;
    }

    importGames = result.games;
    importSelected = new Set(importGames.map(g => g.app_name)); // select all by default
    gamesPanel.style.display = 'flex';
    emptyPanel.style.display = 'none';
    confirmBtn.style.display = 'inline-block';
    renderImportList();
    setStatus(`Found ${importGames.length} installed Epic game${importGames.length !== 1 ? 's' : ''}.`);
}

function renderImportList() {
    const list = document.getElementById('import-game-list');
    const countEl = document.getElementById('import-sel-count');
    countEl.textContent = `${importSelected.size} / ${importGames.length} selected`;

    // Check which are already in GRINDER DB
    list.innerHTML = importGames.map(g => {
        const alreadyIn = allGames.some(ag => ag.app_id === g.app_name && ag.store === 'epic');
        const checked   = importSelected.has(g.app_name);
        return `
        <label style="display:flex; align-items:center; gap:10px; padding:7px 10px; background:rgba(0,0,0,0.2); border-radius:5px; cursor:${alreadyIn ? 'default' : 'pointer'}; border:1px solid var(--border_solid);">
            <input type="checkbox" data-appname="${g.app_name}" ${checked && !alreadyIn ? 'checked' : ''} ${alreadyIn ? 'disabled' : ''} style="accent-color:var(--accent); width:14px; height:14px; flex-shrink:0;">
            <span style="flex:1; font-size:12px; font-weight:700; color:${alreadyIn ? 'var(--text_dim)' : 'var(--text_main)'};">${g.title}</span>
            <span style="font-size:10px; color:var(--text_dim);">${g.version || ''}</span>
            ${alreadyIn ? '<span style="font-size:10px; color:#66bb6a; font-weight:700;">Already imported</span>' : ''}
        </label>`;
    }).join('');

    list.querySelectorAll('input[type=checkbox]').forEach(cb => {
        cb.addEventListener('change', () => {
            if (cb.checked) importSelected.add(cb.dataset.appname);
            else            importSelected.delete(cb.dataset.appname);
            document.getElementById('import-sel-count').textContent = `${importSelected.size} / ${importGames.length} selected`;
        });
    });
}

document.getElementById('btn-import-select-all')?.addEventListener('click', () => {
    importSelected = new Set(importGames.filter(g => !allGames.some(ag => ag.app_id === g.app_name)).map(g => g.app_name));
    renderImportList();
});
document.getElementById('btn-import-select-none')?.addEventListener('click', () => {
    importSelected.clear(); renderImportList();
});

document.getElementById('btn-import-confirm')?.addEventListener('click', async () => {
    const toImport = importGames.filter(g => importSelected.has(g.app_name));
    if (!toImport.length) { setStatus('Nothing selected.'); return; }
    const result = await window.api.legendaryImport(toImport);
    if (result.ok) {
        setStatus(`Imported ${result.count} game${result.count !== 1 ? 's' : ''} from Epic.`);
        closeImportModal();
        await loadGames();
    } else {
        setStatus(`Import failed: ${result.error}`);
    }
});

// ── GOG import ────────────────────────────────────────────────────────────────
let gogImportGames    = [];
let gogImportSelected = new Set();

async function refreshGogStatus() {
    const s = await window.api.gogStatus();
    const el         = document.getElementById('s-gog-status');
    const loginBtn   = document.getElementById('btn-s-gog-login');
    const logoutBtn  = document.getElementById('btn-s-gog-logout');
    const gogdlEl    = document.getElementById('s-gogdl-status');
    if (el) {
        el.innerHTML = s.logged_in
            ? `<span style="color:#66bb6a">✓ Logged in as <strong>${s.username}</strong></span>`
            : `<span style="color:var(--text_dim)">Not logged in to GOG.</span>`;
    }
    if (loginBtn)  loginBtn.style.display  = s.logged_in ? 'none' : '';
    if (logoutBtn) logoutBtn.style.display = s.logged_in ? ''     : 'none';
    if (gogdlEl)   gogdlEl.innerHTML = s.gogdl
        ? `<span style="color:#66bb6a">✓ gogdl found</span>`
        : `<span style="color:var(--text_dim)">gogdl not found — place it next to GRINDER.AppImage</span>`;
}

document.getElementById('btn-s-gog-login')?.addEventListener('click', async () => {
    const btn = document.getElementById('btn-s-gog-login');
    btn.disabled = true; btn.textContent = '⏳ Opening login window...';
    window.api.onGogLoginProgress(() => {});
    const result = await window.api.gogLogin();
    btn.disabled = false; btn.textContent = 'Login to GOG';
    await refreshGogStatus();
    if (!result.ok) setStatus(`GOG login failed: ${result.error}`);
});

document.getElementById('btn-s-gog-logout')?.addEventListener('click', async () => {
    await window.api.gogLogout();
    await refreshGogStatus();
    setStatus('Logged out of GOG.');
});

async function loadGogImportData() {
    const loginPanel = document.getElementById('gog-login-panel');
    const gamesPanel = document.getElementById('gog-games-panel');
    const emptyPanel = document.getElementById('gog-empty');
    const confirmBtn = document.getElementById('btn-gog-import-confirm');
    const accountEl  = document.getElementById('gog-account');

    const s = await window.api.gogStatus();
    if (!s.logged_in) {
        loginPanel.style.display = 'block';
        gamesPanel.style.display = 'none';
        emptyPanel.style.display = 'none';
        confirmBtn.style.display = 'none';
        return;
    }

    loginPanel.style.display = 'none';
    accountEl.textContent = `✓ ${s.username}`;
    setStatus('Fetching GOG library...');
    confirmBtn.style.display = 'none';

    const result = await window.api.gogListOwned();
    if (!result.ok || !result.games.length) {
        gamesPanel.style.display = 'none';
        emptyPanel.style.display = 'block';
        setStatus(result.ok ? 'No GOG games found.' : `Error: ${result.error}`);
        return;
    }

    gogImportGames    = result.games;
    gogImportSelected = new Set(gogImportGames.map(g => g.id));
    gamesPanel.style.display = 'flex';
    emptyPanel.style.display = 'none';
    confirmBtn.style.display = '';
    renderGogImportList();
    setStatus(`Found ${gogImportGames.length} GOG game${gogImportGames.length !== 1 ? 's' : ''}.`);
}

function renderGogImportList() {
    const list    = document.getElementById('gog-game-list');
    const countEl = document.getElementById('gog-sel-count');
    countEl.textContent = `${gogImportSelected.size} / ${gogImportGames.length} selected`;
    list.innerHTML = gogImportGames.map(g => {
        const alreadyIn = allGames.some(ag => ag.app_id === g.id && ag.store === 'gog');
        const checked   = gogImportSelected.has(g.id);
        const platBadge = g.platform === 'linux'
            ? `<span style="font-size:9px;color:#66bb6a;font-weight:900;padding:1px 6px;border:1px solid rgba(102,187,106,0.4);border-radius:3px;">LINUX</span>`
            : `<span style="font-size:9px;color:#9b59d9;font-weight:900;padding:1px 6px;border:1px solid rgba(155,89,217,0.4);border-radius:3px;">WIN</span>`;
        return `
        <label style="display:flex;align-items:center;gap:10px;padding:7px 10px;background:rgba(0,0,0,0.2);border-radius:5px;cursor:${alreadyIn?'default':'pointer'};border:1px solid var(--border_solid);">
            <input type="checkbox" data-gogid="${g.id}" ${checked && !alreadyIn ? 'checked' : ''} ${alreadyIn ? 'disabled' : ''} style="accent-color:#9b59d9;width:14px;height:14px;flex-shrink:0;">
            <span style="flex:1;font-size:12px;font-weight:700;color:${alreadyIn?'var(--text_dim)':'var(--text_main)'};">${g.title}</span>
            ${platBadge}
            ${alreadyIn ? '<span style="font-size:10px;color:#66bb6a;font-weight:700;">Already imported</span>' : ''}
        </label>`;
    }).join('');
    list.querySelectorAll('input[type=checkbox]').forEach(cb => {
        cb.addEventListener('change', () => {
            if (cb.checked) gogImportSelected.add(cb.dataset.gogid);
            else            gogImportSelected.delete(cb.dataset.gogid);
            document.getElementById('gog-sel-count').textContent = `${gogImportSelected.size} / ${gogImportGames.length} selected`;
        });
    });
}

document.getElementById('btn-gog-select-all')?.addEventListener('click', () => {
    gogImportSelected = new Set(gogImportGames.filter(g => !allGames.some(ag => ag.app_id === g.id && ag.store === 'gog')).map(g => g.id));
    renderGogImportList();
});
document.getElementById('btn-gog-select-none')?.addEventListener('click', () => { gogImportSelected.clear(); renderGogImportList(); });

document.getElementById('btn-gog-login')?.addEventListener('click', async () => {
    const btn = document.getElementById('btn-gog-login');
    const out = document.getElementById('gog-login-output');
    btn.disabled = true; btn.textContent = '⏳ Opening login window...';
    out.style.display = 'block'; out.textContent = '';
    window.api.onGogLoginProgress(d => { out.textContent += d; out.scrollTop = out.scrollHeight; });
    const result = await window.api.gogLogin();
    btn.disabled = false; btn.textContent = result.ok ? '✓ Logged in' : 'Login to GOG';
    if (result.ok) { await refreshGogStatus(); loadGogImportData(); }
    else out.textContent += `\n✗ ${result.error}\n`;
});

document.getElementById('btn-gog-import-confirm')?.addEventListener('click', async () => {
    const toImport = gogImportGames.filter(g => gogImportSelected.has(g.id));
    if (!toImport.length) { setStatus('Nothing selected.'); return; }
    const result = await window.api.gogImport(toImport);
    if (result.ok) {
        setStatus(`Imported ${result.count} game${result.count !== 1 ? 's' : ''} from GOG.`);
        closeImportModal();
        await loadGames();
    } else {
        setStatus(`Import failed: ${result.error}`);
    }
});

// ── umu-run installer ─────────────────────────────────────────────────────────
window.api.onUmuInstallProgress(data => {
    const out = document.getElementById('umu-install-output');
    if (!out) return;
    out.style.display = 'block';
    out.textContent += data;
    out.scrollTop = out.scrollHeight;
});

document.getElementById('btn-install-umu')?.addEventListener('click', async () => {
    const btn = document.getElementById('btn-install-umu');
    const out = document.getElementById('umu-install-output');
    btn.disabled = true;
    btn.textContent = '⏳ Installing...';
    out.style.display = 'block';
    out.textContent = '';
    setStatus('Installing umu-run...');

    const result = await window.api.installUmu();

    if (result.ok) {
        out.textContent += `\n✓ Installed successfully via ${result.method}.\n  Restart GRINDER if umu-run is not detected yet.`;
        btn.textContent = '✓ Installed';
        btn.style.color = '#66bb6a';
        setStatus('umu-run installed. Re-checking tools...');
        await checkTools();
    } else {
        out.textContent += `\n✗ Failed (exit ${result.exitCode ?? 'error'}).\n${result.error || ''}`;
        btn.textContent = '✗ Failed — try again';
        btn.disabled = false;
        setStatus('umu-run installation failed.');
    }
});

// ── Proton versions ───────────────────────────────────────────────────────────
let protonVersions = []; // cache

const TYPE_LABEL = { ge: '🟠 GE-Proton', steam: '🔵 Steam Proton', other: '⚪ Other' };

function populateProtonDropdown(versions, selectedPath = '') {
    const sel = document.getElementById('edit-proton');
    const prev = sel.value || selectedPath;
    sel.innerHTML = '<option value="">Use system default</option>';
    for (const v of versions) {
        const opt = document.createElement('option');
        opt.value = v.path;
        opt.textContent = `${TYPE_LABEL[v.type] ?? v.type} — ${v.name}`;
        sel.appendChild(opt);
    }
    if (prev) sel.value = prev;
}

async function loadProtonVersions() {
    // Load cached list from DB first
    const cached = await window.api.getSetting('proton_versions_cache');
    if (cached) {
        try { protonVersions = JSON.parse(cached); }
        catch { protonVersions = []; }
    }
    populateProtonDropdown(protonVersions);
    renderProtonList(protonVersions);
}

function renderProtonList(versions) {
    const container = document.getElementById('proton-list');
    if (!versions.length) {
        container.innerHTML = '<span style="color:var(--text_dim)">No Proton versions found yet. Click Scan.</span>';
        return;
    }
    const defaultPath = document.getElementById('s-proton').value;
    container.innerHTML = versions.map(v => `
        <div style="display:flex;align-items:center;gap:10px;padding:6px 10px;background:rgba(0,0,0,0.2);border-radius:5px;border:1px solid var(--border_solid);">
            <span style="font-size:10px;font-weight:900;color:var(--accent);min-width:80px;">${TYPE_LABEL[v.type] ?? v.type}</span>
            <span style="flex:1;font-size:12px;color:var(--text_main);">${v.name}</span>
            <span style="font-size:10px;color:var(--text_dim);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:220px;" title="${v.path}">${v.path}</span>
            <button onclick="setDefaultProton('${v.path.replace(/'/g, "\\'")}')" style="font-size:10px;font-weight:900;padding:3px 8px;border:1px solid var(--border_solid);background:transparent;color:var(--text_sec);border-radius:3px;cursor:pointer;font-family:Raleway,sans-serif;${v.path===defaultPath?'border-color:var(--accent);color:var(--accent);':''}">${v.path===defaultPath?'✓ Default':'Set Default'}</button>
        </div>
    `).join('');
}

window.setDefaultProton = async (p) => {
    document.getElementById('s-proton').value = p;
    await window.api.setSetting('default_proton_path', p);
    renderProtonList(protonVersions);
    setStatus(`Default Proton set: ${p.split('/').pop()}`);
};

document.getElementById('btn-scan-proton').addEventListener('click', async () => {
    setStatus('Scanning for Proton versions...');
    document.getElementById('btn-scan-proton').textContent = '⏳ Scanning...';
    protonVersions = await window.api.scanProton();
    await window.api.setSetting('proton_versions_cache', JSON.stringify(protonVersions));
    populateProtonDropdown(protonVersions);
    renderProtonList(protonVersions);
    document.getElementById('btn-scan-proton').textContent = '🔍 Scan for Proton Versions';
    setStatus(`Found ${protonVersions.length} Proton version${protonVersions.length !== 1 ? 's' : ''}.`);
});

// ── Settings view ─────────────────────────────────────────────────────────────
async function loadSettings() {
    const [proton, prefixDir] = await Promise.all([
        window.api.getSetting('default_proton_path'),
        window.api.getSetting('default_prefix_dir'),
    ]);
    document.getElementById('s-proton').value     = proton     || '';
    document.getElementById('s-prefix-dir').value = prefixDir  || '';
    renderProtonList(protonVersions);
    await Promise.all([checkTools(), refreshLegendaryStatus(), refreshGogStatus()]);
}

document.getElementById('btn-save-settings').addEventListener('click', async () => {
    await window.api.setSetting('default_proton_path', document.getElementById('s-proton').value.trim());
    await window.api.setSetting('default_prefix_dir',  document.getElementById('s-prefix-dir').value.trim());
    setStatus('Settings saved.');
});

// ── Confirm modal ─────────────────────────────────────────────────────────────
function showConfirm(title, bodyHtml) {
    return new Promise(resolve => {
        const modal  = document.getElementById('modal-confirm');
        const okBtn  = document.getElementById('modal-confirm-ok');
        const canBtn = document.getElementById('modal-confirm-cancel');
        document.getElementById('modal-confirm-title').textContent = title;
        document.getElementById('modal-confirm-body').innerHTML    = bodyHtml;
        modal.classList.add('active');
        const done = (result) => {
            modal.classList.remove('active');
            okBtn.onclick = canBtn.onclick = modal.onclick = null;
            resolve(result);
        };
        okBtn.onclick  = () => done(true);
        canBtn.onclick = () => done(false);
        modal.onclick  = (e) => { if (e.target === modal) done(false); };
    });
}

// ── Status bar ────────────────────────────────────────────────────────────────
function setStatus(msg) { document.getElementById('status-msg').textContent = msg; }

// ── Keyboard shortcuts ────────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal();
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') { e.preventDefault(); openModal(); }
});

// ── Init ──────────────────────────────────────────────────────────────────────
loadProtonVersions();
loadGames();
refreshLegendaryStatus();
refreshGogStatus();
