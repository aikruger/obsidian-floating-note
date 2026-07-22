import { App, PluginSettingTab, Setting, Notice } from "obsidian";
import FloatingNotePlugin from "./main";
import { SavedConfiguration } from "./types";

export class FloatingNoteSettingTab extends PluginSettingTab {
    plugin: FloatingNotePlugin;

    constructor(app: App, plugin: FloatingNotePlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl("h2", { text: "SETTINGS" });
        containerEl.createEl("h3", { text: "Window Size" });

        new Setting(containerEl)
            .setName("Default width")
            .setDesc("Default width of floating windows in pixels")
            .addText(text => text
                .setPlaceholder("400")
                .setValue(String(this.plugin.settings.defaultWidth))
                .onChange(async (value) => {
                    const num = Number(value);
                    if (!isNaN(num) && num > 200) {
                        this.plugin.settings.defaultWidth = num;
                        await this.plugin.saveSettings();
                    }
                }));

        new Setting(containerEl)
            .setName("Default height")
            .setDesc("Default height of floating windows in pixels")
            .addText(text => text
                .setPlaceholder("600")
                .setValue(String(this.plugin.settings.defaultHeight))
                .onChange(async (value) => {
                    const num = Number(value);
                    if (!isNaN(num) && num > 200) {
                        this.plugin.settings.defaultHeight = num;
                        await this.plugin.saveSettings();
                    }
                }));

        containerEl.createEl("h3", { text: "Window Position" });

        new Setting(containerEl)
            .setName("Default position")
            .setDesc("Where to place new floating windows")
            .addDropdown(dropdown => dropdown
                .addOption('center', 'Center')
                .addOption('top-right', 'Top Right')
                .addOption('top-left', 'Top Left')
                .addOption('bottom-right', 'Bottom Right')
                .addOption('bottom-left', 'Bottom Left')
                .setValue(this.plugin.settings.defaultPosition)
                .onChange(async (value) => {
                    this.plugin.settings.defaultPosition = value as any;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName("Remember position")
            .setDesc("Remember the last position and size for each note")
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.rememberPosition)
                .onChange(async (value) => {
                    this.plugin.settings.rememberPosition = value;
                    await this.plugin.saveSettings();
                }));

        containerEl.createEl("h3", { text: "Window Appearance" });

        new Setting(containerEl)
            .setName("Window opacity")
            .setDesc("Default opacity level (0.3 = very transparent, 1.0 = fully opaque)")
            .addSlider(slider => slider
                .setLimits(0.3, 1.0, 0.05)
                .setValue(this.plugin.settings.defaultOpacity)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.defaultOpacity = value;
                    await this.plugin.saveSettings();
                }));

        containerEl.createEl("h3", { text: "Window Behavior" });

        new Setting(containerEl)
            .setName("Always on top")
            .setDesc("Keep floating windows above other applications")
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.alwaysOnTop)
                .onChange(async (value) => {
                    this.plugin.settings.alwaysOnTop = value;
                    await this.plugin.saveSettings();
                }));

        // --- ADD THIS SECTION after "Window Behavior" and before "Data Management" ---

        containerEl.createEl("h3", { text: "Saved Configurations" });

        const configDesc = containerEl.createEl('p');
        configDesc.setText(
            'Save named configurations of a specific note + window layout. ' +
            'Each configuration can open at startup and is accessible via a command ' +
            '(searchable in Command Palette and assignable in Commander). ' +
            'Reload the plugin after adding new configurations for commands to appear.'
        );

        // Render existing configurations
        for (let i = 0; i < this.plugin.settings.savedConfigurations.length; i++) {
            const config = this.plugin.settings.savedConfigurations[i];
            const configEl = containerEl.createEl('div', { cls: 'floating-note-config-item' });
            configEl.style.border = '1px solid var(--background-modifier-border)';
            configEl.style.borderRadius = '6px';
            configEl.style.padding = '12px';
            configEl.style.marginBottom = '12px';

            configEl.createEl('strong', { text: config.name });
            configEl.createEl('p', { text: `Note: ${config.notePath}`, cls: 'setting-item-description' });
            configEl.createEl('p', { text: `Size: ${config.width}×${config.height}  Position: ${config.position}  Opacity: ${config.opacity}  Always on top: ${config.alwaysOnTop}  Startup: ${config.openOnStartup}`, cls: 'setting-item-description' });
            configEl.createEl('p', { text: `Commander command ID: open-config-${config.id}`, cls: 'setting-item-description' });

            new Setting(configEl)
                .addButton(btn => btn
                    .setButtonText('Launch now')
                    .onClick(async () => {
                        console.log(`[FloatingNote] Manual launch of config "${config.name}" from settings`);
                        await this.plugin.openConfiguration(config);
                    }))
                .addButton(btn => btn
                    .setButtonText('Delete')
                    .setWarning()
                    .onClick(async () => {
                        console.log(`[FloatingNote] Deleting config "${config.name}"`);
                        this.plugin.settings.savedConfigurations.splice(i, 1);
                        await this.plugin.saveSettings();
                        this.display(); // re-render settings panel
                    }));
        }

        // "Add new configuration" form
        containerEl.createEl("h4", { text: "Add new configuration" });

        let newConfig: Partial<SavedConfiguration> = {
            position: 'top-right',
            width: this.plugin.settings.defaultWidth,
            height: this.plugin.settings.defaultHeight,
            opacity: this.plugin.settings.defaultOpacity,
            alwaysOnTop: this.plugin.settings.alwaysOnTop,
            openOnStartup: false,
        };

        new Setting(containerEl)
            .setName('Configuration name')
            .setDesc('A unique human-readable label, e.g. "Daily Note Sidebar"')
            .addText(text => text
                .setPlaceholder('My Config')
                .onChange(value => { newConfig.name = value; }));

        new Setting(containerEl)
            .setName('Note path')
            .setDesc('Vault-relative path including folder, e.g. "Daily/scratch.md"')
            .addText(text => text
                .setPlaceholder('folder/note.md')
                .onChange(value => { newConfig.notePath = value; }));

        new Setting(containerEl)
            .setName('Position')
            .addDropdown(dd => dd
                .addOption('center', 'Center')
                .addOption('top-right', 'Top Right')
                .addOption('top-left', 'Top Left')
                .addOption('bottom-right', 'Bottom Right')
                .addOption('bottom-left', 'Bottom Left')
                .setValue('top-right')
                .onChange(value => { newConfig.position = value as any; }));

        new Setting(containerEl)
            .setName('Width (px)')
            .addText(text => text
                .setPlaceholder(String(this.plugin.settings.defaultWidth))
                .onChange(value => {
                    const n = Number(value);
                    if (!isNaN(n) && n > 100) newConfig.width = n;
                }));

        new Setting(containerEl)
            .setName('Height (px)')
            .addText(text => text
                .setPlaceholder(String(this.plugin.settings.defaultHeight))
                .onChange(value => {
                    const n = Number(value);
                    if (!isNaN(n) && n > 100) newConfig.height = n;
                }));

        new Setting(containerEl)
            .setName('Opacity')
            .addSlider(slider => slider
                .setLimits(0.3, 1.0, 0.05)
                .setValue(this.plugin.settings.defaultOpacity)
                .setDynamicTooltip()
                .onChange(value => { newConfig.opacity = value; }));

        new Setting(containerEl)
            .setName('Always on top')
            .addToggle(toggle => toggle
                .setValue(true)
                .onChange(value => { newConfig.alwaysOnTop = value; }));

        new Setting(containerEl)
            .setName('Open at Obsidian startup')
            .setDesc('This configuration will launch automatically when Obsidian opens')
            .addToggle(toggle => toggle
                .setValue(false)
                .onChange(value => { newConfig.openOnStartup = value; }));

        new Setting(containerEl)
            .addButton(btn => btn
                .setButtonText('Save configuration')
                .setCta()
                .onClick(async () => {
                    if (!newConfig.name || !newConfig.notePath) {
                        new Notice('Please set both a name and a note path.');
                        console.warn('[FloatingNote] Save config aborted — missing name or notePath');
                        return;
                    }
                    const id = newConfig.name
                        .toLowerCase()
                        .replace(/[^a-z0-9]+/g, '-')
                        .replace(/(^-|-$)/g, '');
                    const complete: SavedConfiguration = {
                        id,
                        name: newConfig.name,
                        notePath: newConfig.notePath,
                        position: newConfig.position ?? 'top-right',
                        width: newConfig.width ?? this.plugin.settings.defaultWidth,
                        height: newConfig.height ?? this.plugin.settings.defaultHeight,
                        opacity: newConfig.opacity ?? this.plugin.settings.defaultOpacity,
                        alwaysOnTop: newConfig.alwaysOnTop ?? true,
                        openOnStartup: newConfig.openOnStartup ?? false,
                    };
                    console.log('[FloatingNote] Saving new configuration:', complete);
                    this.plugin.settings.savedConfigurations.push(complete);
                    await this.plugin.saveSettings();
                    new Notice(`Configuration "${complete.name}" saved. Reload the plugin for its command to appear in Commander.`);
                    this.display();
                }));

        containerEl.createEl("h3", { text: "Data Management" });

        const desc = containerEl.createEl('p');
        desc.setText('The plugin saves the last used position and size for each note when "Remember position" is enabled. If you delete or rename notes, these saved settings can become "stale". You can clean them up here.');
        
        new Setting(containerEl)
            .setName("Clean up saved positions")
            .setDesc("Remove saved positions for notes that no longer exist in your vault.")
            .addButton(button => button
                .setButtonText("Clean up")
                .onClick(async () => {
                    const count = this.plugin.cleanupStalePositions();
                }));
    }
}