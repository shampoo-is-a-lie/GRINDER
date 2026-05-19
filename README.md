<div align="center">

<img src="https://raw.githubusercontent.com/shampoo-is-a-lie/GRINDER/main/assets/icons/grinder_icon.svg" width="80" alt="GRINDER Icon">

# GRINDER

**Epic Games and GOG launcher and install engine for Linux.**

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Linux-orange.svg)](#installation)

[🌐 Website](https://shampoo-is-a-lie.github.io/CafeNeuroticoWebSite/) · [🎮 CNGM](https://github.com/shampoo-is-a-lie/CafeNeuroticoGameManager) · [🕹️ CREMA](https://github.com/shampoo-is-a-lie/CREMA)

</div>

---

## About

GRINDER is the install and launch engine of the **Cafe Neurotico ecosystem**. It uses bundled [legendary](https://github.com/derrod/legendary) and a custom [gogdl fork](https://github.com/shampoo-is-a-lie/gogdl) to authenticate with Epic and GOG, browse your full libraries, install games, and launch them through **umu-run + GE-Proton** for maximum compatibility.

Place `GRINDER.AppImage` in the same folder as `CNGM.AppImage` and they connect automatically — CNGM can show GRINDER install status per game, launch Epic and GOG games through GRINDER, and open GRINDER pre-filtered to a specific game title.

GRINDER also works headlessly as a CLI backend:

```bash
GRINDER.AppImage launch <game_id>   # launch a game headlessly (called by CNGM)
GRINDER.AppImage search <name>      # open with search pre-filled (called by CNGM)
```

## Features

- **Epic & GOG Library Import** — Log in to both stores and import your full owned libraries in one click each. Epic via legendary, GOG via the GOG API directly.
- **In-App Installation** — Install any Epic or GOG game directly. Real-time progress bar with percentage, speed, and ETA.
- **Platform Selector** — GOG games with both Linux and Windows builds show a Linux/Windows toggle before installing. Linux builds run natively; Windows builds use umu-run + Proton automatically.
- **Pre-Install Size Check** — Shows download size, on-disk size, and available disk space before starting. Disables Install button if space is insufficient.
- **Smart Launch Chain** — Windows games launch through umu-run → direct Proton → Wine, in order of preference. Linux native GOG games run directly.
- **Proton Scanner** — Detects all installed Proton versions (GE-Proton, Steam Proton, others) across standard Steam directories. Deduplicated via symlink resolution. Set a default with one click.
- **umu-run Installer** — One-click umu-run installation via pipx or pip if not already on the system.
- **Disk Size Display** — Shows on-disk size for every installed game in the library list (async, via `du`).
- **Verify Installations** — Scans all games marked as installed and resets any whose files are missing from disk, so the Install button reappears for reinstall.
- **Uninstall** — Removes game files, Wine prefix, and the store's install record (legendary or gogdl) in one action.
- **CNGM Integration** — Auto-detected by CNGM when placed in the same folder. Per-game toggle in CNGM's edit panel to launch Epic or GOG games through GRINDER. Open GRINDER pre-searched from CNGM's game panel.
- **CLI Mode** — Headless launch from external launchers: `GRINDER.AppImage launch <game_id>`.

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

On first launch, GRINDER creates its configuration at `~/.config/grinder/`. Here is where everything lives:

| What | Path |
|---|---|
| Game library database | `~/.config/grinder/grinder.db` |
| Wine prefixes | `~/.config/grinder/prefixes/<Game Title>/` |
| Game files | `~/Games/CafeNeurotico/<Game Title>/` (default, changeable per-install) |

**CNGM integration:** place `GRINDER.AppImage` in the same folder as `CNGM.AppImage`. CNGM auto-detects it — no configuration needed.

**Desktop integration:** once GRINDER is in the same folder as CNGM, go to **Tools → System → Add to Application Menu** in CNGM to register all three apps (CNGM, CREMA, GRINDER) in your desktop launcher with icons.

## Requirements

- Linux (x86_64)
- **umu-run** — strongly recommended for Windows game compatibility. Install via:
  ```bash
  pipx install umu-launcher   # or use the one-click installer in GRINDER's Settings
  ```
- **GE-Proton** — recommended. Install via [ProtonUp-Qt](https://github.com/DavidoTek/ProtonUp-Qt) or manually into `~/.steam/root/compatibilitytools.d/`. GRINDER's Proton Scanner finds it automatically.
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
<sub>Built with love for Linux gamers. Part of the <a href="https://shampoo-is-a-lie.github.io/CafeNeuroticoWebSite/">Cafe Neurotico ecosystem</a>.</sub>
</div>
