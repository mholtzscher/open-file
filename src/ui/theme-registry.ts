/**
 * Theme Registry - manages available themes and the active theme
 *
 * Provides a central place to register themes and switch between them.
 * The registry is a singleton that can be accessed from anywhere in the app.
 */

import type { ThemeDefinition } from '../types/theme.js';

/**
 * Theme change event listener type
 */
export type ThemeChangeListener = (theme: ThemeDefinition) => void;

/**
 * Theme Registry singleton
 *
 * Manages theme registration, selection, and change notifications.
 */
class ThemeRegistryImpl {
  private themes: Map<string, ThemeDefinition> = new Map();
  private activeThemeId: string | null = null;
  private listeners: Set<ThemeChangeListener> = new Set();

  /**
   * Register a theme with the registry
   *
   * @param theme - The theme definition to register
   * @throws Error if a theme with the same ID is already registered
   */
  register(theme: ThemeDefinition): void {
    if (this.themes.has(theme.id)) {
      throw new Error(`Theme with ID "${theme.id}" is already registered`);
    }
    this.themes.set(theme.id, theme);

    // If this is the first theme registered, make it active
    if (this.activeThemeId === null) {
      this.activeThemeId = theme.id;
    }
  }

  /**
   * Get a theme by ID
   *
   * @param id - The theme ID to look up
   * @returns The theme definition, or undefined if not found
   */
  get(id: string): ThemeDefinition | undefined {
    return this.themes.get(id);
  }

  /**
   * Set the active theme by ID
   *
   * @param id - The theme ID to activate
   * @throws Error if the theme ID is not registered
   */
  setActive(id: string): void {
    const theme = this.themes.get(id);
    if (!theme) {
      throw new Error(`Theme with ID "${id}" is not registered`);
    }

    if (this.activeThemeId !== id) {
      this.activeThemeId = id;
      this.notifyListeners(theme);
    }
  }

  /**
   * Get the currently active theme
   *
   * @returns The active theme definition
   * @throws Error if no themes are registered
   */
  getActive(): ThemeDefinition {
    if (this.activeThemeId === null) {
      throw new Error(
        'No themes registered. Register at least one theme before calling getActive()'
      );
    }

    const theme = this.themes.get(this.activeThemeId);
    if (!theme) {
      throw new Error(`Active theme "${this.activeThemeId}" not found in registry`);
    }

    return theme;
  }

  /**
   * Get the ID of the currently active theme
   *
   * @returns The active theme ID, or null if no themes are registered
   */
  getActiveId(): string | null {
    return this.activeThemeId;
  }

  /**
   * Check if a theme with the given ID is registered
   *
   * @param id - The theme ID to check
   * @returns true if the theme is registered
   */
  has(id: string): boolean {
    return this.themes.has(id);
  }

  /**
   * List all registered theme IDs
   *
   * @returns Array of registered theme IDs
   */
  list(): string[] {
    return Array.from(this.themes.keys());
  }

  /**
   * List all registered themes with their metadata
   *
   * @returns Array of theme info objects
   */
  listThemes(): Array<{ id: string; name: string; variant: 'dark' | 'light' }> {
    return Array.from(this.themes.values()).map(theme => ({
      id: theme.id,
      name: theme.name,
      variant: theme.variant,
    }));
  }

  /**
   * Subscribe to theme changes
   *
   * @param listener - Function to call when the theme changes
   * @returns Unsubscribe function
   */
  subscribe(listener: ThemeChangeListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Notify all listeners of a theme change
   */
  private notifyListeners(theme: ThemeDefinition): void {
    for (const listener of this.listeners) {
      try {
        listener(theme);
      } catch (error) {
        // Don't let one listener's error affect others
        console.error('Error in theme change listener:', error);
      }
    }
  }

  /**
   * Unregister a theme (mainly for testing)
   *
   * @param id - The theme ID to unregister
   * @returns true if the theme was unregistered
   */
  unregister(id: string): boolean {
    const deleted = this.themes.delete(id);

    // If we deleted the active theme, switch to another or null
    if (deleted && this.activeThemeId === id) {
      const remaining = this.list();
      this.activeThemeId = remaining.length > 0 ? remaining[0] : null;
      if (this.activeThemeId) {
        const newActive = this.themes.get(this.activeThemeId);
        if (newActive) {
          this.notifyListeners(newActive);
        }
      }
    }

    return deleted;
  }

  /**
   * Clear all registered themes (mainly for testing)
   */
  clear(): void {
    this.themes.clear();
    this.activeThemeId = null;
    this.listeners.clear();
  }
}

/**
 * Global theme registry instance
 */
export const ThemeRegistry = new ThemeRegistryImpl();
