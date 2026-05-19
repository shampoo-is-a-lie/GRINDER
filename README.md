<div align="center">

<img src="https://raw.githubusercontent.com/shampoo-is-a-lie/GRINDER/main/assets/icons/grinder_icon.svg" width="80" alt="GRINDER Icon">

# GRINDER

**Epic Games launcher and install engine for Linux.**

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Linux-orange.svg)](#installation)

[🌐 Website](https://shampoo-is-a-lie.github.io/CafeNeuroticoWebSite/) · [🎮 CNGM](https://github.com/shampoo-is-a-lie/CafeNeuroticoGameManager) · [🕹️ CREMA](https://github.com/shampoo-is-a-lie/CREMA)

</div>

---

## About

GRINDER is the install and launch engine of the **Cafe Neurotico ecosystem**. It uses a bundled [legendary](https://github.com/derrod/legendary) binary to authenticate with Epic, browse your full library, install games, and launch them through **umu-run + GE-Proton** for maximum compatibility.

Place `GRINDER.AppImage` in the same folder as `CNGM.AppImage` and the two apps connect automatically — CNGM detects GRINDER, shows which Epic games are installed in it, and lets you toggle individual games to launch via GRINDER on a per-game basis.

GRINDER also works headlessly as a CLI backend:

```bash
GRINDER.AppImage launch <game_id>
```

> Pair it with **[CNGM](https://github.com/shampoo-is-a-lie/CafeNeuroticoGameManager)** — the full-featured game library manager. Place both AppImages in the same folder and CNGM can launch Epic games through GRINDER automatically.

## Features

- **Epic Library Import** — Log in with your Epic account via the official auth flow and import your entire owned game list in one click.
- **In-App Installation** — Install any Epic game directly from GRINDER. Real-time progress bar with speed and ETA readout.
- **Smart Launch Chain** — Launches Windows games through umu-run → direct Proton invocation → Wine, in that order of preference, with no configuration required.
- **Proton Scanner** — Detects all installed Proton versions (GE-Proton, Steam Proton, and others) across standard Steam directories. Set a default with one click.
- **umu-run Installer** — One-click umu-run installation via pipx or pip if it isn't already on the system.
- **Disk Size Display** — Shows on-disk size for every installed game in the library list.
- **Uninstall** — Removes game files, Wine prefix, and legendary's install record cleanly in one action.
- **CLI Mode** — Run headlessly to launch a game from an external launcher: `GRINDER.AppImage launch <game_id>`.
- **CNGM Integration** — Auto-detected by CNGM when placed in the same folder. Per-game toggle in CNGM's edit panel to enable GRINDER as the launch backend.

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

**CNGM integration:** place `GRINDER.AppImage` in the same folder as `CNGM.AppImage`. CNGM will auto-detect it — no configuration needed. Open any Epic game's edit panel in CNGM to see the GRINDER status row and toggle it on.

**Desktop integration:** once GRINDER is in the same folder as CNGM, go to **Tools → System → Add to Application Menu** in CNGM to register all three apps (CNGM, CREMA, GRINDER) in your desktop launcher with icons.

## Requirements

- Linux (x86_64)
- **umu-run** — strongly recommended for best game compatibility. Install via:
  ```bash
  # Fedora / Arch / most distros
  pipx install umu-launcher

  # Or use the one-click installer inside GRINDER (Settings tab)
  ```
- **GE-Proton** — recommended. Install via [ProtonUp-Qt](https://github.com/DavidoTek/ProtonUp-Qt) or manually into `~/.steam/root/compatibilitytools.d/`. GRINDER's Proton Scanner will find it automatically.
- An Epic Games account.

> legendary is bundled — no separate install needed.

## Third-Party Software

GRINDER bundles the following tool:

| Tool | License |
|---|---|
| [legendary](https://github.com/derrod/legendary) | [GPL v3](https://github.com/derrod/legendary/blob/master/LICENSE) |
| [gogdl](https://github.com/Heroic-Games-Launcher/heroic-gogdl) | [GPL v3](https://github.com/Heroic-Games-Launcher/heroic-gogdl/blob/main/LICENSE) |

## License

Copyright (C) 2026 J.R.A. (Shampoo is a Lie)

This program is free software: you can redistribute it and/or modify it under the terms of the **GNU General Public License v3.0** as published by the Free Software Foundation.

See the [LICENSE](LICENSE) file for the full license text.

---

<div align="center">
<sub>Built with love for Linux gamers. Part of the <a href="https://shampoo-is-a-lie.github.io/CafeNeuroticoWebSite/">Cafe Neurotico ecosystem</a>.</sub>
</div>
