import {
    Plugin,
    TFile,
    WorkspaceLeaf,
    Menu,
    Notice
} from "obsidian";
import {
    FloatingNoteSettings,
    DEFAULT_SETTINGS,
    SavedFloatingDashboard,
    SavedDashboardGroup,
    SavedDashboardLeaf
} from "./types";
import { FloatingNoteSettingTab } from "./settings";

type Position = 'center' | 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';

export default class FloatingNotePlugin extends Plugin {
    settings: FloatingNoteSettings;
    private floatingLeaves: Set<WorkspaceLeaf> = new Set();
    private registeredDashboardCommandIds: Set<string> = new Set();

    async onload() {
        await this.loadSettings();

        const positions: Position[] = ['center', 'top-left', 'top-right', 'bottom-left', 'bottom-right'];
        positions.forEach(position => {
            this.addCommand({
                id: `open-floating-note-${position}`,
                name: `Open in floating window (${position})`,
                checkCallback: (checking) => {
                    const file = this.app.workspace.getActiveFile();
                    if (file) {
                        if (!checking) {
                            this.openFloatingNote(file, position);
                        }
                        return true;
                    }
                    return false;
                },
            });
        });

        this.registerEvent(
            this.app.workspace.on("file-menu", (menu: Menu, file: TFile) => {
                if (file instanceof TFile && file.extension === "md") {
                    menu.addItem((item) => {
                        item
                            .setTitle("Open in floating window")
                            .setIcon("popup-open")
                            .onClick(() => {
                                this.openFloatingNote(file, this.settings.defaultPosition);
                            });
                    });
                }
            })
        );

        this.addRibbonIcon("popup-open", "Open floating note", async () => {
            const file = this.app.workspace.getActiveFile();
            if (file) {
                await this.openFloatingNote(file, this.settings.defaultPosition);
            }
        });

        this.addCommand({
            id: "save-current-floating-dashboard",
            name: "Save current floating dashboard",
            callback: async () => {
                new Notice("Open the plugin settings to name and save the current floating dashboard.");
                console.log("[FloatingNote] save-current-floating-dashboard command triggered");
            }
        });

        // Register a command for each saved dashboard
        this.registerSavedDashboardCommands();

        this.addSettingTab(new FloatingNoteSettingTab(this.app, this));
        console.log("Floating Note plugin loaded");

        // Launch any startup dashboards after the workspace is ready
        this.app.workspace.onLayoutReady(async () => {
            const startupDashboards = this.settings.savedDashboards.filter(d => d.openOnStartup);
            console.log(`[FloatingNote] ${startupDashboards.length} floating dashboard(s) marked for startup`);

            for (let i = 0; i < startupDashboards.length; i++) {
                const dashboard = startupDashboards[i];
                window.setTimeout(() => {
                    console.log(`[FloatingNote] Auto-launching startup dashboard "${dashboard.name}"`);
                    this.openSavedDashboard(dashboard);
                }, i * 400);
            }
        });
    }

    private registerSavedDashboardCommands() {
        console.log(`[FloatingNote] Registering ${this.settings.savedDashboards.length} saved dashboard command(s)`);

        for (const dashboard of this.settings.savedDashboards) {
            const commandId = `open-dashboard-${dashboard.id}`;
            this.registeredDashboardCommandIds.add(commandId);

            this.addCommand({
                id: commandId,
                name: `Open floating dashboard: ${dashboard.name}`,
                callback: async () => {
                    console.log(`[FloatingNote] Command triggered for dashboard "${dashboard.name}"`);
                    await this.openSavedDashboard(dashboard);
                },
            });
        }
    }

    private slugify(value: string): string {
        return value
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '');
    }

    private getActivePopoutLeaf(): WorkspaceLeaf | null {
        const workspaceAny = this.app.workspace as any;

        const leaf: WorkspaceLeaf | null =
            workspaceAny.activeLeaf ??
            this.app.workspace.getMostRecentLeaf() ??
            null;

        console.log("[FloatingNote] getActivePopoutLeaf: candidate leaf", leaf);

        if (!leaf) {
            console.warn("[FloatingNote] No active or recent leaf found while trying to detect popout leaf");
            return null;
        }

        const container = (leaf as any).containerEl ?? (leaf.view as any)?.containerEl;
        const win = container?.win ?? (leaf.view as any)?.containerEl?.win;

        console.log("[FloatingNote] getActivePopoutLeaf: container/window info", {
            hasContainer: !!container,
            hasWindow: !!win,
            isMainWindow: win === window,
        });

        if (!win || win === window) {
            console.warn("[FloatingNote] Active leaf appears to belong to the main window, not a popout");
            return null;
        }

        return leaf;
    }

    private getLeavesInSamePopoutTabGroup(baseLeaf: WorkspaceLeaf): WorkspaceLeaf[] {
        const parent = (baseLeaf as any).parent;
        if (!parent) {
            console.warn("[FloatingNote] Base popout leaf has no parent tabs container");
            return [baseLeaf];
        }

        const children = (parent as any).children ?? [];
        const leaves = children.filter((child: any) => child instanceof WorkspaceLeaf);

        console.log("[FloatingNote] Leaves found in same popout tab group", leaves.length);
        return leaves.length ? leaves : [baseLeaf];
    }

    private captureLeafViewState(leaf: WorkspaceLeaf) {
        try {
            const viewState = leaf.getViewState();
            console.log("[FloatingNote] captureLeafViewState", {
                type: viewState?.type,
                active: viewState?.active,
                state: viewState?.state,
                isDeferred: (leaf as any).isDeferred,
            });
            return viewState;
        } catch (error) {
            console.error("[FloatingNote] Failed to capture leaf view state", error, leaf);
            return null;
        }
    }

    public captureActiveFloatingDashboard(): SavedFloatingDashboard | null {
        try {
            const activeLeaf = this.getActivePopoutLeaf();
            if (!activeLeaf) {
                new Notice("Floating Note: focus a floating dashboard tab before saving.");
                console.warn("[FloatingNote] Dashboard capture aborted because no active popout leaf was found");
                return null;
            }

            const leaves = this.getLeavesInSamePopoutTabGroup(activeLeaf);
            const popoutWindow = (activeLeaf.view.containerEl as any)?.win;
            const electronWindow = popoutWindow?.electronWindow;

            if (!electronWindow) {
                new Notice("Floating Note: could not access floating window bounds.");
                console.warn("[FloatingNote] Dashboard capture aborted because electronWindow was unavailable");
                return null;
            }

            const bounds = electronWindow.getBounds();
            console.log("[FloatingNote] Capturing dashboard bounds", bounds);

            const savedLeaves: SavedDashboardLeaf[] = [];
            for (const leaf of leaves) {
                const viewState = this.captureLeafViewState(leaf);
                if (viewState) {
                    savedLeaves.push({
                        viewState,
                        isActive: leaf === activeLeaf,
                    });
                    console.log("[FloatingNote] Captured dashboard leaf", {
                        type: viewState.type,
                        isActive: leaf === activeLeaf,
                    });
                    console.warn(`[FloatingNote] Leaf type "${viewState.type}" may not fully restore if plugin does not persist view state`);
                } else {
                    console.warn("[FloatingNote] Skipping leaf because no view state could be captured");
                }
            }

            if (savedLeaves.length === 0) {
                new Notice("Floating Note: no savable tabs found in the active floating dashboard.");
                console.warn("[FloatingNote] Dashboard capture found zero savable leaves");
                return null;
            }

            console.log("[FloatingNote] Using plugin defaults for opacity/alwaysOnTop during dashboard capture");

            return {
                id: "",
                name: "",
                width: bounds.width,
                height: bounds.height,
                x: bounds.x,
                y: bounds.y,
                position: 'custom',
                opacity: this.settings.defaultOpacity,
                alwaysOnTop: this.settings.alwaysOnTop,
                openOnStartup: false,
                groups: [
                    {
                        id: "group-1",
                        leaves: savedLeaves,
                    },
                ],
            };
        } catch (error) {
            console.error("[FloatingNote] captureActiveFloatingDashboard failed", error);
            new Notice("Floating Note: failed to inspect the current floating dashboard.");
            return null;
        }
    }

    public async saveDashboardFromActivePopout(name: string, openOnStartup: boolean): Promise<boolean> {
        const captured = this.captureActiveFloatingDashboard();
        if (!captured) {
            return false;
        }

        const idBase = this.slugify(name);
        let id = idBase;
        let counter = 2;
        while (this.settings.savedDashboards.some(d => d.id === id)) {
            id = `${idBase}-${counter++}`;
        }

        captured.id = id;
        captured.name = name;
        captured.openOnStartup = openOnStartup;

        this.settings.savedDashboards.push(captured);
        await this.saveSettings();

        console.log("[FloatingNote] Saved floating dashboard", captured);
        new Notice(`Floating dashboard "${name}" saved. Reload plugin for its command to appear.`);
        return true;
    }

    public async replaceDashboardFromActivePopout(dashboardId: string): Promise<boolean> {
        const idx = this.settings.savedDashboards.findIndex(d => d.id === dashboardId);
        if (idx === -1) {
            console.warn("[FloatingNote] replaceDashboardFromActivePopout: dashboard not found", dashboardId);
            return false;
        }

        const existing = this.settings.savedDashboards[idx];
        const captured = this.captureActiveFloatingDashboard();
        if (!captured) {
            return false;
        }

        captured.id = existing.id;
        captured.name = existing.name;
        captured.openOnStartup = existing.openOnStartup;

        this.settings.savedDashboards[idx] = captured;
        await this.saveSettings();

        console.log("[FloatingNote] Replaced floating dashboard from active popout", captured);
        new Notice(`Floating dashboard "${captured.name}" updated.`);
        return true;
    }

    private calculateWindowPosition(screen: any, position: Position, width: number, height: number): { x?: number, y?: number } {
        if (!screen) {
            console.error("Electron screen module is not available.");
            return { x: undefined, y: undefined };
        }

        const primaryDisplay = screen.getPrimaryDisplay();
        const { width: screenWidth, height: screenHeight } = primaryDisplay.workArea;

        switch (position) {
            case 'center':
                return {
                    x: Math.round((screenWidth - width) / 2),
                    y: Math.round((screenHeight - height) / 2)
                };
            case 'top-left':
                return { x: 0, y: 0 };
            case 'top-right':
                return { x: screenWidth - width, y: 0 };
            case 'bottom-left':
                return { x: 0, y: screenHeight - height };
            case 'bottom-right':
                return { x: screenWidth - width, y: screenHeight - height };
            default:
                return { x: undefined, y: undefined };
        }
    }

    async openFloatingNote(file: TFile, position?: Position) {
        if (!file) {
            return;
        }

        try {
            const popoutLeaf = this.app.workspace.openPopoutLeaf();
            this.floatingLeaves.add(popoutLeaf);

            popoutLeaf.on('close', () => {
                this.floatingLeaves.delete(popoutLeaf);
            });

            await popoutLeaf.openFile(file);

            const popoutWindow = (popoutLeaf.view.containerEl as any)?.win;
            const electronWindow = popoutWindow?.electronWindow;

            if (popoutWindow && electronWindow) {
                // Save position on close
                popoutWindow.addEventListener('beforeunload', () => {
                    if (this.settings.rememberPosition) {
                        const bounds = electronWindow.getBounds();
                        this.settings.notePositions[file.path] = {
                            x: bounds.x,
                            y: bounds.y,
                            width: bounds.width,
                            height: bounds.height,
                        };
                        this.saveSettings();
                    }
                });

                // Always on top
                if (this.settings.alwaysOnTop) {
                    electronWindow.setAlwaysOnTop(true, "floating");
                }

                // Set opacity
                electronWindow.setOpacity(this.settings.defaultOpacity);

                const savedGeometry = this.settings.notePositions[file.path];
                let finalWidth = this.settings.defaultWidth;
                let finalHeight = this.settings.defaultHeight;
                let finalX: number | undefined;
                let finalY: number | undefined;

                if (this.settings.rememberPosition && savedGeometry) {
                    finalWidth = savedGeometry.width;
                    finalHeight = savedGeometry.height;
                    finalX = savedGeometry.x;
                    finalY = savedGeometry.y;
                } else {
                    const screen = popoutWindow.require('@electron/remote').screen;
                    const pos = this.calculateWindowPosition(screen, position || this.settings.defaultPosition, finalWidth, finalHeight);
                    finalX = pos.x;
                    finalY = pos.y;
                }

                const bounds = {
                    width: finalWidth,
                    height: finalHeight,
                    x: finalX,
                    y: finalY,
                };

                const cleanBounds: { width: number, height: number, x?: number, y?: number } = {
                    width: Math.round(bounds.width),
                    height: Math.round(bounds.height)
                };

                if (bounds.x !== undefined) {
                    cleanBounds.x = Math.round(bounds.x);
                }
                if (bounds.y !== undefined) {
                    cleanBounds.y = Math.round(bounds.y);
                }

                electronWindow.setBounds(cleanBounds);
            }

        } catch (error) {
            console.error("Error opening floating window:", error);
        }
    }

    public async openSavedDashboard(dashboard: SavedFloatingDashboard): Promise<void> {
        console.log(`[FloatingNote] Opening saved dashboard "${dashboard.name}"`);

        if (!dashboard.groups?.length || !dashboard.groups[0]?.leaves?.length) {
            console.warn("[FloatingNote] Dashboard has no leaves to restore", dashboard);
            new Notice(`Floating dashboard "${dashboard.name}" has no leaves.`);
            return;
        }

        try {
            const firstLeaf = dashboard.groups[0].leaves[0];

            const popoutLeaf = this.app.workspace.openPopoutLeaf();
            this.floatingLeaves.add(popoutLeaf);
            popoutLeaf.on('close', () => {
                this.floatingLeaves.delete(popoutLeaf);
                console.log(`[FloatingNote] Popout leaf closed for dashboard "${dashboard.name}"`);
            });

            await popoutLeaf.setViewState(firstLeaf.viewState);
            this.app.workspace.setActiveLeaf(popoutLeaf, { focus: true });
            console.log("[FloatingNote] Restored first dashboard leaf", firstLeaf.viewState.type);

            const popoutWindow = (popoutLeaf.view.containerEl as any)?.win;
            const electronWindow = popoutWindow?.electronWindow;
            if (electronWindow) {
                electronWindow.setAlwaysOnTop(dashboard.alwaysOnTop, "floating");
                electronWindow.setOpacity(dashboard.opacity);

                const cleanBounds: { width: number; height: number; x?: number; y?: number } = {
                    width: Math.round(dashboard.width),
                    height: Math.round(dashboard.height),
                };

                if (dashboard.position === 'custom') {
                    if (dashboard.x !== undefined) cleanBounds.x = Math.round(dashboard.x);
                    if (dashboard.y !== undefined) cleanBounds.y = Math.round(dashboard.y);
                } else {
                    const screen = popoutWindow.require('@electron/remote').screen;
                    const pos = this.calculateWindowPosition(
                        screen,
                        dashboard.position || this.settings.defaultPosition,
                        dashboard.width,
                        dashboard.height
                    );
                    if (pos.x !== undefined) cleanBounds.x = Math.round(pos.x);
                    if (pos.y !== undefined) cleanBounds.y = Math.round(pos.y);
                }

                electronWindow.setBounds(cleanBounds);
                console.log("[FloatingNote] Dashboard bounds applied", cleanBounds);
            } else {
                console.warn("[FloatingNote] No electronWindow available when restoring dashboard bounds");
            }

            const parentTabs = (popoutLeaf as any).parent;
            for (let i = 1; i < dashboard.groups[0].leaves.length; i++) {
                const savedLeaf = dashboard.groups[0].leaves[i];
                let newLeaf: WorkspaceLeaf | null = null;

                if (parentTabs && this.app.workspace.createLeafInParent) {
                    newLeaf = this.app.workspace.createLeafInParent(parentTabs, i);
                    console.log("[FloatingNote] Created new leaf in popout parent", {
                        index: i,
                        type: savedLeaf.viewState.type,
                    });
                } else {
                    console.warn("[FloatingNote] Falling back to getLeaf('tab') while restoring dashboard leaf", savedLeaf.viewState.type);
                    newLeaf = this.app.workspace.getLeaf('tab');
                }

                await newLeaf.setViewState(savedLeaf.viewState);
                console.log("[FloatingNote] Restored dashboard leaf", {
                    index: i,
                    type: savedLeaf.viewState.type,
                });
            }

            const activeLeaf = dashboard.groups[0].leaves.find(t => t.isActive);
            if (activeLeaf) {
                const matchingLeaf = this.floatingLeaves.size ? [...this.floatingLeaves] : [];
                console.log("[FloatingNote] Active-leaf restore hint", activeLeaf.viewState.type, matchingLeaf.length);

                // Optional logic for refocusing the active tab could be put here
            }

        } catch (error) {
            console.error(`[FloatingNote] Error restoring dashboard "${dashboard.name}"`, error);
            new Notice(`Error restoring floating dashboard "${dashboard.name}".`);
        }
    }

    onunload() {
        this.closeAllFloatingWindows();
        console.log("Floating Note plugin unloaded");
    }

    closeAllFloatingWindows() {
        this.floatingLeaves.forEach((leaf) => {
            leaf.detach();
        });
        this.floatingLeaves.clear();
    }

    async loadSettings() {
        const data = await this.loadData();
        this.settings = Object.assign({}, DEFAULT_SETTINGS, data);

        if (!Array.isArray(this.settings.savedDashboards)) {
            this.settings.savedDashboards = [];
            console.log("[FloatingNote] Initialized missing savedDashboards array");
        }

        if (!(this.settings.notePositions && typeof this.settings.notePositions === "object")) {
            this.settings.notePositions = {};
            console.log("[FloatingNote] Reinitialized malformed notePositions map");
        }

        // Remove legacy property if it exists
        if ('savedConfigurations' in this.settings) {
            delete (this.settings as any).savedConfigurations;
        }
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    public cleanupStalePositions(): number {
        const validPaths = new Set(this.app.vault.getMarkdownFiles().map(file => file.path));
        let staleCount = 0;

        if (this.settings.notePositions) {
            for (const path in this.settings.notePositions) {
                if (!validPaths.has(path)) {
                    delete this.settings.notePositions[path];
                    staleCount++;
                }
            }
        }

        // Also remove the obsolete windowBounds property if it exists
        if ((this.settings as any).windowBounds) {
            delete (this.settings as any).windowBounds;
        }

        this.saveSettings();
        return staleCount;
    }
}