import * as vscode from 'vscode';

// Types for recorded actions
type Action =
  | { type: 'command'; command: string; args?: any }
  | { type: 'text'; text: string };

class MacroManager {
    private isRecording = false;
    private currentRegister = '@'; // Default register
    private registers: Map<string, Action[]> = new Map();
    private activeSequence: Action[] = [];
    private statusBarItem: vscode.StatusBarItem;

    constructor() {
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
    }

    // --- State Management ---

    public setRegister(reg: string) {
        this.currentRegister = reg;
        vscode.window.setStatusBarMessage(`Macro Register selected: "${reg}"`, 2000);
    }

    public startRecording() {
        this.isRecording = true;
        this.activeSequence = [];
        this.updateContext();
        this.statusBarItem.text = `$(record) Recording @${this.currentRegister}`;
        this.statusBarItem.show();
    }

    public stopRecording() {
        if (!this.isRecording) return;
        this.isRecording = false;

        // Save sequence to the selected register
        if (this.activeSequence.length > 0) {
            this.registers.set(this.currentRegister, [...this.activeSequence]);
        }

        // Reset to default register after recording finishes (Helix behavior)
        this.currentRegister = '@';
        this.updateContext();
        this.statusBarItem.hide();
        vscode.window.setStatusBarMessage(`Macro recorded to @${this.currentRegister}`, 2000);
    }

    public toggleRecording() {
        if (this.isRecording) {
            this.stopRecording();
        } else {
            this.startRecording();
        }
    }

    // --- Recording Logic ---

    public recordCommand(command: string, args?: any) {
        if (this.isRecording) {
            this.activeSequence.push({ type: 'command', command, args });
        }
    }

    public recordText(text: string) {
        if (this.isRecording) {
            // Optimization: Merge consecutive text inputs
            const lastAction = this.activeSequence[this.activeSequence.length - 1];
            if (lastAction && lastAction.type === 'text') {
                lastAction.text += text;
            } else {
                this.activeSequence.push({ type: 'text', text });
            }
        }
    }

    // --- Replay Logic ---

    public async replay() {
        if (this.isRecording) {
            vscode.window.showWarningMessage("Cannot replay while recording.");
            return;
        }

        const sequence = this.registers.get(this.currentRegister);
        if (!sequence || sequence.length === 0) {
            vscode.window.setStatusBarMessage(`Register @${this.currentRegister} is empty`, 2000);
            return;
        }

        for (const action of sequence) {
            try {
                if (action.type === 'command') {
                    await vscode.commands.executeCommand(action.command, action.args);
                } else if (action.type === 'text') {
                    // We use 'default:type' to bypass our own interceptor during replay
                    await vscode.commands.executeCommand('default:type', { text: action.text });
                }
            } catch (error) {
                console.error(`Macro failed at ${action.type}:`, error);
                break; // Stop replay on error
            }
        }

        // Reset register to default after replay (Helix behavior)
        this.currentRegister = '@';
    }

    private updateContext() {
        vscode.commands.executeCommand('setContext', 'helixMacro.isRecording', this.isRecording);
    }
}

export function activate(context: vscode.ExtensionContext) {
    const macroManager = new MacroManager();
	console.log('Modal Macros Active');

    // 1. Intercept Typing (The core of text recording)
    // We register a high-priority override for the 'type' command
    const typeDisposable = vscode.commands.registerCommand('type', (args) => {
        macroManager.recordText(args.text);
        // Pass through to VS Code's native handler
        return vscode.commands.executeCommand('default:type', args);
    });

    // 2. Register Commands
    context.subscriptions.push(
        typeDisposable,

        vscode.commands.registerCommand('helixMacro.startRecording', () => macroManager.startRecording()),
        vscode.commands.registerCommand('helixMacro.stopRecording', () => macroManager.stopRecording()),
        vscode.commands.registerCommand('helixMacro.toggleRecording', () => macroManager.toggleRecording()),
        vscode.commands.registerCommand('helixMacro.replay', () => macroManager.replay()),

        // Command to explicitly select a register (e.g. bound to " " <key>)
        vscode.commands.registerCommand('helixMacro.selectRegister', async () => {
            // Simple approach: wait for next keystroke via QuickPick or InputBox is disruptive.
            // Better integration: ModalEditor binds keys to pass arguments to this.
            // If called without args, we can show a quick pick.
            const value = await vscode.window.showInputBox({
                placeHolder: 'Press a key for register (a-z)',
                prompt: 'Select Register',
                validateInput: (text) => text.length === 1 ? null : 'Single char only'
            });
            if (value) macroManager.setRegister(value);
        }),

        // Wrapper to record arbitrary VS Code commands
        // Usage: { "command": "helixMacro.performAction", "args": { "cmd": "cursorDown" } }
        vscode.commands.registerCommand('helixMacro.performAction', async (args) => {
            const cmd = args.cmd || args.command;
            const cmdArgs = args.args;

            if (cmd) {
                macroManager.recordCommand(cmd, cmdArgs);
                await vscode.commands.executeCommand(cmd, cmdArgs);
            }
        })
    );
}

export function deactivate() {}