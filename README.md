<div align="center">

<img src="https://raw.githubusercontent.com/shampoo-is-a-lie/GRINDER/main/assets/icons/grinder_icon.svg" width="80" alt="GRINDER Icon">

# GRINDER

**The robot-barista. Roasts, grinds, and serves your GOG & Epic games — downloading, configuring Proton, and pulling the perfect shot every time.**

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Linux-orange.svg)](#installation)

[🌐 Website](https://shampoo-is-a-lie.github.io/CafeNeuroticoWebSite/) · [🎮 CNGM](https://github.com/shampoo-is-a-lie/CafeNeuroticoGameManager) · [🕹️ CREMA](https://github.com/shampoo-is-a-lie/CREMA)

</div>

---

## About

GRINDER is the install and launch engine of the **Cafe Neurotico ecosystem** — dedicated to GOG and Epic Games on Linux. It uses a bundled [legendary](https://github.com/derrod/legendary) and a custom [gogdl fork](https://github.com/shampoo-is-a-lie/gogdl) to authenticate with both stores, browse your full libraries, install games, and launch them through **umu-run + GE-Proton** for maximum compatibility.

Place `GRINDER.AppImage` in the same folder as `CNGM.AppImage` and they connect automatically — no configuration needed. CNGM tracks install status per game, routes GOG and Epic launches through GRINDER, and opens GRINDER pre-filtered to a specific game. CREMA (the fullscreen gamepad companion) can also install and uninstall games through GRINDER headlessly, showing live progress without ever opening GRINDER's window.

## Features

### Library & Importing
- **Epic & GOG Library Import** — Log in to both stores and import your full owned libraries. Epic via legendary, GOG via the GOG API directly.
- **Filter Bar** — Filter by Installed / Not Installed and by store (Epic, GOG).
- **Search** — Searches all fields, debounced for performance.
- **Disk Size Display** — Shows on-disk size for every installed game (async `du`).
- **Refresh & Check Size** — Rescans all games and resets any whose files are missing from disk.

### Installation
- **In-App Installation** — Install any Epic or GOG game directly. Real-time progress bar with percentage and transfer size.
- **Platform Selector** — GOG games with both Linux and Windows builds offer a Linux/Windows toggle before installing. Linux builds run natively; Windows builds use Proton automatically.
- **Pre-Install Size Check** — Shows download and on-disk size before starting. Disables Install if disk space is insufficient.
- **Auto Compat Files** — After a successful GOG install, compatibility files (redistributables) are installed automatically via umu-run/Proton.
- **Uninstall** — Removes game files, Wine prefix, and the store's install record in one action.

### Launch
- **Smart Launch Chain** — Windows games: umu-run → direct Proton → Wine, in order of preference. Linux native GOG games run directly.
- **Official Launch Arguments** — Reads `goggame-*.info` `playTasks` arguments at launch time so mods, configs, and DLCs load correctly without any manual setup (e.g. Ashes 2063's mod loader).
- **Launch Target Chooser** — Dropdown populated from the game's official `playTasks` — switch between "Play", "Editor", "Mod Launcher", etc. without touching the executable field.
- **Additional Arguments** — Free-form field for extra launch flags (e.g. `-windowed`, `+set com_allowConsole 1`), appended after the official play task arguments.
- **.bat File Support** — Batch file launchers are automatically converted to Wine's `Z:` drive path format for correct execution.
- **Working Directory** — All spawns set `cwd` to the game's install directory so relative paths in arguments resolve correctly.
- **Per-Game Proton Override** — Choose a different Proton version per game, independent of the system default.
- **Per-Game Environment Variables** — Set custom `KEY=value` environment variables applied at launch.
- **Esync / Fsync / DXVK-NVAPI** — Per-game toggles mirroring Heroic's launcher behaviour.
- **BattlEye / EAC Runtime** — Detects and sets runtime paths from GRINDER's own `runtimes/` folder or existing Steam installations.

### Proton Management
- **Proton Scanner** — Detects all Proton versions (GE-Proton, Steam Proton, others) across standard Steam and Flatpak Steam directories. Deduplicated via symlink resolution.
- **GE-Proton Downloader** — Fetches the latest GE-Proton releases directly from GitHub and installs them to `compatibilitytools.d` — no ProtonUp-Qt required.
- **GE-Proton Uninstaller** — Remove any GE-Proton version installed in `compatibilitytools.d` directly from the list. Steam-managed Proton versions are protected.

### Compatibility Tools
- **Winetricks** — Save a list of components per game and run them into the game's Wine prefix with one click.
- **Run .exe on Prefix** — File picker to run any installer, patcher, or tool inside the game's Wine prefix (mod installers, DirectX redists, etc.).
- **Install Compat. Files** — Manually trigger GOG's redistributable installer for any GOG game.
- **umu-run Installer** — One-click umu-run installation via `pipx` (or `pip` fallback) if not already present.

### CNGM & CREMA Integration
- **Auto-detected by CNGM** — Place both AppImages in the same folder; CNGM reads GRINDER's database at startup.
- **Headless Install/Uninstall for CREMA** — CREMA can install or uninstall GOG/Epic games through GRINDER with no window, writing progress to `GameManagerConfig/grinder-progress.json` for CREMA to display its own UI.
- **Theme Sync** — Reads CNGM's active colour theme at startup and applies it before the window appears — consistent look across the ecosystem.
- **CLI Arguments** — External callers can drive GRINDER:
  ```bash
  GRINDER.AppImage launch <game_id>            # headless launch
  GRINDER.AppImage search <name>               # open with search pre-filled
  GRINDER.AppImage setup <game_id>             # open Edit modal for a game
  GRINDER.AppImage install <store> <id> [dir]  # headless install (for CREMA)
  GRINDER.AppImage uninstall-headless <store> <id>  # headless uninstall (for CREMA)
  ```

### UI & UX
- **Welcome Screen** — First-launch guide with live tool status (legendary, gogdl, umu-run, wine) and getting-started tips. Can be reopened from Settings → About.
- **Now Playing Popup** — Spring-animated popup when a game launches, showing logo/cover art.
- **Single-Instance Lock** — A second launch focuses the existing window rather than opening a new one.
- **KDE Taskbar Grouping** — WM_CLASS is set correctly so pinned taskbar icons group properly.

## Installation

1. Download the latest `GRINDER.AppImage` from the [Releases](https://github.com/shampoo-is-a-lie/GRINDER/releases) page.
2. Make it executable:
   ```bash
   chmod +x GRINDER.AppImage
   ```
3. Run it:
   ```bash
   ./GRINDER.AppImage
   ```

GRINDER creates its configuration at `~/.config/grinder/` on first launch:

| What | Path |
|---|---|
| Game library database | `~/.config/grinder/grinder.db` |
| Wine prefixes | `~/.config/grinder/prefixes/<Game Title>/` |
| Game files | `~/Games/CafeNeurotico/<Game Title>/` (default, changeable per-install) |

**CNGM integration:** place `GRINDER.AppImage` in the same folder as `CNGM.AppImage`. CNGM auto-detects it — no configuration needed.

**Desktop integration:** once GRINDER is in the same folder as CNGM, go to **Tools → System → Add to Application Menu** in CNGM to register all three apps in your desktop launcher with icons.

## Requirements

- Linux (x86_64)
- **umu-run** — strongly recommended for Windows game compatibility. Install via:
  ```bash
  pipx install umu-launcher
  ```
  Or use the one-click installer in GRINDER's Settings → External Tools.
- **GE-Proton** — recommended. Install directly from GRINDER's Settings → Install GE-Proton, or manually into `~/.steam/root/compatibilitytools.d/`. GRINDER's Proton Scanner finds it automatically.
- Epic Games and/or GOG account.

> legendary and gogdl are bundled — no separate installs needed.

## Third-Party Software

GRINDER bundles the following tools:

| Tool | License |
|---|---|
| [legendary](https://github.com/derrod/legendary) | [GPL v3](https://github.com/derrod/legendary/blob/master/LICENSE) |
| [gogdl](https://github.com/shampoo-is-a-lie/gogdl) (fork of [heroic-gogdl](https://github.com/Heroic-Games-Launcher/heroic-gogdl)) | [GPL v3](https://github.com/shampoo-is-a-lie/gogdl/blob/grinder/LICENSE) |

## License

Copyright (C) 2026 J.R.A. (Shampoo is a Lie)

This program is free software: you can redistribute it and/or modify it under the terms of the **GNU General Public License v3.0** as published by the Free Software Foundation.

See the [LICENSE](LICENSE) file for the full license text.

---

<div align="center">
<sub>Part of the <a href="https://shampoo-is-a-lie.github.io/CafeNeuroticoWebSite/">Cafe Neurotico ecosystem</a> — built for Linux gamers who take their coffee seriously.</sub>
</div>
