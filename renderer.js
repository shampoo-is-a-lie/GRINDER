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
        el.querySelector('.dot').className = 'dot ' + (value ? 'ok' : 'err');
        el.title = value || 'Not found';
    }
    setDot('status-legendary', tools.legendary);
    setDot('status-umu',       tools.umu);
    setDot('status-wine',      tools.wine);

    const info = document.getElementById('tools-info');
    info.innerHTML = [
        `<strong style="color:var(--text_main)">legendary</strong>: ${tools.legendary || '<span style="color:#ef5350">not found — install via pip or package manager</span>'}`,
        `<strong style="color:var(--text_main)">umu-run</strong>: ${tools.umu || '<span style="color:#ef5350">not found — install umu-launcher</span>'}`,
        `<strong style="color:var(--text_main)">wine</strong>: ${tools.wine || '<span style="color:#ef5350">not found</span>'}`,
    ].join('<br>');
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
    document.getElementById('edit-proton').value       = game?.proton_path  || '';
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
        proton_path:  document.getElementById('edit-proton').value.trim()       || null,
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

// ── Settings view ─────────────────────────────────────────────────────────────
async function loadSettings() {
    const [proton, prefixDir] = await Promise.all([
        window.api.getSetting('default_proton_path'),
        window.api.getSetting('default_prefix_dir'),
    ]);
    document.getElementById('s-proton').value     = proton     || '';
    document.getElementById('s-prefix-dir').value = prefixDir  || '';
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
loadGames();
