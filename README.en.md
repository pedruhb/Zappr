# Zappr ⚡

![License](https://img.shields.io/github/license/pedruhb/Zappr)
![Latest release](https://img.shields.io/github/v/release/pedruhb/Zappr)
![Platform](https://img.shields.io/badge/platform-Linux%20%7C%20Windows-blue)

[Português (Brasil)](README.md) · **English** · [Español](README.es.md)

Modern, high-performance desktop client for WhatsApp Web built with Electron for **Linux** and **Windows**, featuring native audio/video calls, screen sharing, multiple isolated sessions in tabs with a Discord-style sidebar, intelligent `whatsapp://` link distribution, per-session granular audio control, and real-time unread message badges.

---

## ✨ Features & Highlights

### 👥 Multiple Isolated Sessions in Tabs

- **Discord-style right sidebar**: Manage up to 6 WhatsApp accounts seamlessly within a single sleek window.
- **Complete session isolation**: Each tab runs inside an isolated Electron partition (`persist:partition`), keeping session data, logins, and cookies 100% segregated.
- **Drag & Drop reordering**: Easily reorganize sessions by dragging icons up and down with instant green drop indicators and fluid animations.
- **Fast visual identification**: Set custom profile photos (with automatic square crop and WebP compression) or dynamic high-contrast initials.
- **Instant tab switching**: Fluid tab switching powered by Electron's `WebContentsView`, keeping memory usage low while preserving background chat connections.

### 🔴 Real-time Unread Message Badges

- **Per-session unread counter**: Each sidebar icon displays a badge reflecting unread conversation counts directly extracted from WhatsApp Web.
- **Bounce animation**: Smooth pop animation whenever new messages arrive to catch your attention discreetly.
- **Global dock/taskbar synchronization**: Synchronized with your OS taskbar and dock badge count.

### 🔀 Smart Link Routing (`whatsapp://` & `wa.me`)

- **Native protocol handler**: Zappr registers itself on Linux and Windows to handle `whatsapp://` and `wa.me` links.
- **Automatic routing to the oldest used session**: Distribute incoming chats and leads round-robin style to the session that hasn't handled links in the longest time.
- **Auto-send countdown & editable preview**: Edit pre-filled messages before dispatching, or enable automatic countdown sending with a visual cancel button.
- **Modern picker modal with shortcuts**:
  - Quickly select accounts by pressing number keys `1` to `6`.
  - Arrow keys navigation, double-click or `Enter` to confirm.
  - Hide specific accounts from the prompt to prevent accidental personal account dispatching.

### 🔊 Per-session Audio Control

- **Granular volume adjustment**: Set individual notification volumes per session (**100%**, **75%**, **50%**, **25%**, **10%**, or **Mute**).
- **One-click quick mute**: Instantly mute any account via right-click context menu.
- **Visual mute indicator**: Muted accounts display a crossed speaker badge on their avatar.

### 🎨 Custom Colors & Theming

- **Independent session colors**: Assign distinct colors to each account using the color picker (HEX or preset palette).
- **Dynamic synchronized title bar**: The top title bar immediately morphs to match the color of the active session.
- **Visual accents**: Indicator pills, borders, and glow shadows dynamically reflect the session's custom color.

### 🌐 Multi-language Support (Default: Brazilian Portuguese)

- Zappr defaults to **Português do Brasil (`pt-BR`)**, with full support for **English (`en`)** and **Spanish (`es`)**.
- Switch language anytime via **File > Language** without restarting the application.

---

## ⌨️ Keyboard Shortcuts

| Shortcut                      | Action                                               |
| :---------------------------- | :--------------------------------------------------- |
| `Ctrl + 1` to `Ctrl + 6`      | Switch directly to the corresponding session         |
| `Ctrl + N`                    | Add a new WhatsApp session                           |
| `Ctrl + R` / `F5`             | Reload the active session                            |
| `Ctrl + Shift + R`            | Hard reload the active session (clears render cache) |
| `Ctrl + +` / `Ctrl + -`       | Zoom in / Zoom out                                   |
| `Ctrl + 0`                    | Reset zoom to 100%                                   |
| `F11`                         | Toggle fullscreen mode                               |
| `1` to `6` _(in link dialog)_ | Choose session to open the link                      |
| `Enter` _(in link dialog)_    | Open link in selected session                        |
| `Esc`                         | Close dialogs and modals                             |

---

## 🚀 Installation

Download the latest release from the [Releases](https://github.com/pedruhb/Zappr/releases) page:

### Linux (Ubuntu / Debian / Mint)

```bash
sudo apt install ./zappr_<version>_amd64.deb
```

### Linux (AppImage)

```bash
chmod +x Zappr-*.AppImage
./Zappr-*.AppImage
```

### Windows

Download the installer or portable `.exe` from the Releases page and run it.

---

## 📄 License

Distributed under the **MIT** License. See [LICENSE](LICENSE) for details.

_Special thanks to the original TuxChat contributors for the solid project foundation._
