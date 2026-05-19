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
    setDot('status-umu',       tools.umu);
    setDot('status-wine',      tools.wine);

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
            ${storeBadge(g.store)}
            <span class="game-title">${g.title}</span>
            <span class="game-status ${g.installed ? 'status-installed' : 'status-uninstalled'}">
                ${g.installed ? '● Installed' : '○ Not installed'}
            </span>
            <div class="game-actions">
                ${g.installed ? `<button class="btn-launch" data-launch="${g.id}">▶ Launch</button>` : ''}
                <button class="btn-edit" data-edit="${g.id}">Edit</button>
                <button class="btn-delete" data-delete="${g.id}">✕</button>
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
            setStatus(`Launching "${allGames.find(g=>g.id===id)?.title}"...`);
            btn.disabled = true;
            const result = await window.api.launchGame(id);
            btn.disabled = false;
            setStatus(result.ok ? `Launched via ${result.method}.` : `Error: ${result.error}`);
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
            if (!confirm(`Remove "${game?.title}" from GRINDER? (files are NOT deleted)`)) return;
            await window.api.deleteGame(game.id);
            if (selectedId === game.id) selectedId = null;
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
}

document.getElementById('search-input').addEventListener('input', () => renderGames(filterGames()));

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
    await checkTools();
}

document.getElementById('btn-save-settings').addEventListener('click', async () => {
    await window.api.setSetting('default_proton_path', document.getElementById('s-proton').value.trim());
    await window.api.setSetting('default_prefix_dir',  document.getElementById('s-prefix-dir').value.trim());
    setStatus('Settings saved.');
});

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
