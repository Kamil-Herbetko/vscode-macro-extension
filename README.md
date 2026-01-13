# Helix Macro API for VS Code

This extension brings Helix/Vim-style macro recording, replaying, and register management to VS Code. It is specifically architected to serve as a backend for the [DCsunset/vscode-modal-editor](https://github.com/DCsunset/vscode-modal-editor) extension.

## Features

* **Macro Registers**: Record specific macros to specific registers (e.g., `"a`, `"b`, `"@`).
* **Action & Text Recording**: Remembers sequence of motions, commands, and text insertion.
* **State Awareness**: Visual feedback in the Status Bar when recording.
* **Headless Design**: Does not impose keybindings; you define them in your modal editor configuration.

---

## Integration Guide

Since this extension acts as an API, it requires configuration within your `settings.json` under the `modalEditor.keybindings` section to function effectively.

### 1. Basic Controls (Start, Stop, Replay)

Add these bindings to your **Normal** mode configuration. This mimics standard Helix bindings:
* `Q`: Start/Stop recording.
* `q`: Replay the macro in the current register.

```json
"modalEditor.keybindings": {
    "normal": {
        "Q": {
            "command": "helixMacro.toggleRecording",
            "text": "Toggle Macro Recording"
        },
        "q": {
            "command": "helixMacro.replay",
            "text": "Replay Macro"
        }
    }
}
```

### 2. Register Selection

Helix uses the `"` key to select a specific register before recording or replaying.

```json
"\"": {
    "command": "helixMacro.selectRegister",
    "text": "Select Register"
}
```
*When you press `"`, an input box will appear asking for a single character (a-z). The next Record or Replay action will use that register.*

### 3. IMPORTANT: Recording Motions (The Wrapper)

**This is the most critical step.**

By default, VS Code extensions cannot "listen" to other commands being executed. To ensure your navigation keys (`h`, `j`, `k`, `l`, `w`, `b`, etc.) are recorded inside the macro, you must wrap them using `helixMacro.performAction`.

**Replace your standard navigation bindings:**

```json
// OLD (Not recordable)
"j": "cursorDown",
"k": "cursorUp",

// NEW (Recordable)
"j": {
    "command": "helixMacro.performAction",
    "args": { "cmd": "cursorDown" }
},
"k": {
    "command": "helixMacro.performAction",
    "args": { "cmd": "cursorUp" }
},
"l": {
    "command": "helixMacro.performAction",
    "args": { "cmd": "cursorRight" }
},
"h": {
    "command": "helixMacro.performAction",
    "args": { "cmd": "cursorLeft" }
}
```

*You should apply this wrapper to any command you wish to be recordable (e.g., Delete, Paste, Indent).*

---

## Available Commands

| Command ID | Description | Arguments |
| :--- | :--- | :--- |
| `helixMacro.toggleRecording` | Starts or Stops recording to current register. | None |
| `helixMacro.replay` | Replays the sequence stored in current register. | None |
| `helixMacro.selectRegister` | Opens input box to set current register. | Optional: `{ "register": "a" }` |
| `helixMacro.performAction` | Executes a command and logs it to the macro. | `{ "cmd": "command.id", "args": {} }` |

## Visual Feedback

When recording is active, a status bar item will appear:
`$(record) Recording @a`

The extension also sets a context key `helixMacro.isRecording` which is true when recording is active. You can use this context in other extensions or keybindings.

## Configuration

| Setting | Default | Description |
| :--- | :--- | :--- |
| `helixMacro.defaultRegister` | `@` | The default register used when the extension activates or after a macro finishes. |

## Known Limitations

1.  **Mouse Actions**: Mouse clicks and scrolling are not recorded.
2.  **Native VS Code Inputs**: If a command opens a VS Code input box (like `Ctrl+P`), the interaction *inside* that box is not recorded, only the command to open it.