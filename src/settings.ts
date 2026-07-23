import { App, PluginSettingTab, Setting, Notice } from "obsidian";
import FloatingNotePlugin from "./main";
import { SavedFloatingDashboard } from "./types";

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

        containerEl.createEl("h3", { text: "Floating Dashboards" });

        const dashboardDesc = containerEl.createEl("p");
        dashboardDesc.setText(
            "Save and restore a whole floating dashboard from the currently focused popout window. " +
            "Version 1 saves multiple note tabs in one floating tab group. " +
            "This does not save or modify the main Obsidian workspace."
        );

        let newDashboardName = "";
        let newDashboardStartup = false;

        new Setting(containerEl)
            .setName("Dashboard name")
            .setDesc("Name for the currently focused floating dashboard")
            .addText(text => text
                .setPlaceholder("Research dashboard")
                .onChange(value => {
                    newDashboardName = value;
                }));

        new Setting(containerEl)
            .setName("Open at startup")
            .setDesc("Automatically restore this floating dashboard when Obsidian starts")
            .addToggle(toggle => toggle
                .setValue(false)
                .onChange(value => {
                    newDashboardStartup = value;
                }));

        new Setting(containerEl)
            .setName("Save current floating dashboard")
            .setDesc("Focus a tab inside the floating dashboard you want to save, then click Save")
            .addButton(button => button
                .setButtonText("Save dashboard")
                .setCta()
                .onClick(async () => {
                    if (!newDashboardName.trim()) {
                        new Notice("Please enter a dashboard name.");
                        console.warn("[FloatingNote] Save dashboard aborted: missing name");
                        return;
                    }

                    console.log(`[FloatingNote] Attempting to save current floating dashboard as "${newDashboardName}"`);
                    const ok = await this.plugin.saveDashboardFromActivePopout(newDashboardName.trim(), newDashboardStartup);
                    if (ok) {
                        this.display();
                    }
                }));

        // Render saved dashboards
        containerEl.createEl("h4", { text: "Saved dashboards" });

        if (this.plugin.settings.savedDashboards.length === 0) {
            containerEl.createEl("p", {
                text: "No floating dashboards saved yet.",
                cls: "setting-item-description"
            });
        }

        for (const dashboard of this.plugin.settings.savedDashboards) {
            const tabCount = dashboard.groups.reduce((sum, group) => sum + group.leaves.length, 0);

            const block = containerEl.createDiv({ cls: "floating-note-dashboard-item" });
            block.style.border = "1px solid var(--background-modifier-border)";
            block.style.borderRadius = "6px";
            block.style.padding = "12px";
            block.style.marginBottom = "12px";

            block.createEl("strong", { text: dashboard.name });
            block.createEl("p", {
                text: `Tabs: ${tabCount} · Groups: ${dashboard.groups.length} · Startup: ${dashboard.openOnStartup}`,
                cls: "setting-item-description"
            });
            block.createEl("p", {
                text: `Bounds: ${dashboard.width}×${dashboard.height} at ${dashboard.position === 'custom' ? `${dashboard.x}, ${dashboard.y}` : dashboard.position} · Opacity: ${dashboard.opacity} · Always on top: ${dashboard.alwaysOnTop}`,
                cls: "setting-item-description"
            });
            block.createEl("p", {
                text: `Commander command: Open floating dashboard: ${dashboard.name}`,
                cls: "setting-item-description"
            });
            block.createEl("p", {
                text: "After adding a dashboard, reload the plugin if Commander does not yet show the new command.",
                cls: "setting-item-description"
            });

            new Setting(block)
                .addToggle(toggle => toggle
                    .setTooltip("Open this dashboard at startup")
                    .setValue(dashboard.openOnStartup)
                    .onChange(async (value) => {
                        dashboard.openOnStartup = value;
                        await this.plugin.saveSettings();
                        console.log(`[FloatingNote] Updated openOnStartup for dashboard "${dashboard.name}" to`, value);
                    }))
                .addButton(button => button
                    .setButtonText("Launch now")
                    .onClick(async () => {
                        console.log(`[FloatingNote] Launch now clicked for dashboard "${dashboard.name}"`);
                        await this.plugin.openSavedDashboard(dashboard);
                    }))
                .addButton(button => button
                    .setButtonText("Replace from current")
                    .onClick(async () => {
                        console.log(`[FloatingNote] Replace from current clicked for dashboard "${dashboard.name}"`);
                        const ok = await this.plugin.replaceDashboardFromActivePopout(dashboard.id);
                        if (ok) {
                            this.display();
                        }
                    }))
                .addButton(button => button
                    .setButtonText("Delete")
                    .setWarning()
                    .onClick(async () => {
                        console.log(`[FloatingNote] Deleting dashboard "${dashboard.name}"`);
                        this.plugin.settings.savedDashboards =
                            this.plugin.settings.savedDashboards.filter(d => d.id !== dashboard.id);
                        await this.plugin.saveSettings();
                        this.display();
                    }));
        }

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