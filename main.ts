import { App, Plugin, PluginSettingTab, Setting } from "obsidian";

interface AutoSaveSettings {
	debounceTimeMs: number;
	timeToWaitAfterSaveMs: number;
}

const DEFAULT_SETTINGS: AutoSaveSettings = {
	debounceTimeMs: 3000,
	timeToWaitAfterSaveMs: 5000,
};

export default class AutoSavePlugin extends Plugin {
	settings: AutoSaveSettings;
	private debounceTimer: NodeJS.Timeout | null = null;
	private lastSave = new Date(0);

	async onload() {
		console.log("Loading Auto Save Plugin");

		await this.loadSettings();

		this.addSettingTab(new AutoSaveSettingTab(this.app, this));

		this.registerEvent(
			this.app.workspace.on("active-leaf-change", () => {
				if (this.debounceTimer) clearTimeout(this.debounceTimer);
				this.debounceTimer = null;
			})
		);

		this.registerEvent(
			this.app.workspace.on("editor-change", () => {
				this.triggerSaveWithDebounce();
			})
		);
	}

	onunload() {
		console.log("Unloading Auto Save Plugin");
		if (this.debounceTimer) {
			clearTimeout(this.debounceTimer);
			this.debounceTimer = null;
		}
	}

	triggerSaveWithDebounce() {
		const diff = new Date().getTime() - this.lastSave.getTime();
		if (diff < this.settings.timeToWaitAfterSaveMs) return;

		const activeFile = this.app.workspace.getActiveFile();
		if (this.debounceTimer) {
			clearTimeout(this.debounceTimer);
		}

		this.debounceTimer = setTimeout(async () => {
			const newActiveFile = this.app.workspace.getActiveFile();
			if (!newActiveFile || activeFile?.path != newActiveFile.path)
				return;

			const app = this.app as any;
			app.commands.executeCommandById("editor:save-file");
			this.debounceTimer = null;
			this.lastSave = new Date();
		}, this.settings.debounceTimeMs);
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
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
		containerEl.createEl("h2", { text: "Auto Save Settings" });

		new Setting(containerEl)
			.setName("Debounce time (ms)")
			.setDesc(
				"Time to wait after the last edit before automatically saving the active file."
			)
			.addText((text) =>
				text
					.setPlaceholder(String(DEFAULT_SETTINGS.debounceTimeMs))
					.setValue(this.plugin.settings.debounceTimeMs.toString())
					.onChange(async (value) => {
						const numValue = parseInt(value, 10);
						if (!isNaN(numValue) && numValue > 50) {
							this.plugin.settings.debounceTimeMs = numValue;
							await this.plugin.saveSettings();
						}
					})
			);

		new Setting(containerEl)
			.setName("Delay after save (ms)")
			.setDesc(
				"Time to wait after active file has been saved, before listening for file changes again. (This is very relevant if you have a file formatter or something, that runs after save again. Without this, the file will continue to save indefinitely.)"
			)
			.addText((text) =>
				text
					.setPlaceholder(
						String(DEFAULT_SETTINGS.timeToWaitAfterSaveMs)
					)
					.setValue(
						this.plugin.settings.timeToWaitAfterSaveMs.toString()
					)
					.onChange(async (value) => {
						const numValue = parseInt(value, 10);
						if (!isNaN(numValue) && numValue >= 50) {
							this.plugin.settings.timeToWaitAfterSaveMs =
								numValue;
							await this.plugin.saveSettings();
						}
					})
			);
	}
}
