import { App, Plugin, PluginSettingTab, Setting, Notice, MarkdownView } from 'obsidian';

interface AutoSaveSettings {
	debounceTime: number;
}

const DEFAULT_SETTINGS: AutoSaveSettings = {
	debounceTime: 3,
}

export default class AutoSavePlugin extends Plugin {
	settings: AutoSaveSettings;
	private debounceTimer: NodeJS.Timeout | null = null;

	async onload() {
		console.log('Loading Auto Save Plugin');

		await this.loadSettings();

		this.addSettingTab(new AutoSaveSettingTab(this.app, this));


		this.registerEvent(
			this.app.workspace.on('active-leaf-change', () => {
				if (this.debounceTimer) clearTimeout(this.debounceTimer);
				this.debounceTimer = null;
			})
		);

		this.registerEvent(
			this.app.workspace.on('editor-change', () => {
				this.triggerSaveWithDebounce();
			})
		);
	}

	onunload() {
		console.log('Unloading Auto Save Plugin');
		if (this.debounceTimer) {
			clearTimeout(this.debounceTimer);
			this.debounceTimer = null;
		}
	}

	triggerSaveWithDebounce() {
		const activeFile = this.app.workspace.getActiveFile();
		if (this.debounceTimer) {
			clearTimeout(this.debounceTimer);
		}

		this.debounceTimer = setTimeout(async () => {
			const newActiveFile = this.app.workspace.getActiveFile();
			if (!newActiveFile || activeFile?.path != newActiveFile.path) return

			const app = this.app as any
			app.commands.executeCommandById('editor:save-file');
			this.debounceTimer = null;
		}, this.settings.debounceTime * 1000);
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class AutoSaveSettingTab extends PluginSettingTab {
	plugin: AutoSavePlugin;

	constructor(app: App, plugin: AutoSavePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();
		containerEl.createEl('h2', { text: 'Auto Save Settings' });

		new Setting(containerEl)
			.setName('Debounce time (ms)')
			.setDesc('Time to wait after the last edit before automatically saving the active file. Minimum 0.')
			.addText(text => text
				.setPlaceholder(String(DEFAULT_SETTINGS.debounceTime))
				.setValue(this.plugin.settings.debounceTime.toString())
				.onChange(async (value) => {
					const numValue = parseInt(value, 10);
					if (!isNaN(numValue) && numValue >= 0) {
						this.plugin.settings.debounceTime = numValue;
						await this.plugin.saveSettings();
					} else {
						new Notice("Please enter a valid non-negative number for debounce time.");
						text.setValue(this.plugin.settings.debounceTime.toString());
					}
				}));
	}
}
