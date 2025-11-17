/**
 * Configuration system for open-s3
 *
 * Manages user preferences, keybindings, and S3 settings
 * Config file: ~/.open-s3rc.json
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { expandUser } from './path-utils.js';

/**
 * Keybinding configuration
 */
export interface KeybindingConfig {
  // Navigation
  moveUp?: string[];
  moveDown?: string[];
  moveTop?: string[];
  moveBottom?: string[];

  // Operations
  openEntry?: string[];
  openParent?: string[];
  enter?: string[];

  // Modes
  normalMode?: string[];
  visualMode?: string[];
  editMode?: string[];

  // Actions
  delete?: string[];
  rename?: string[];
  copy?: string[];
  paste?: string[];
  save?: string[];
  quit?: string[];
}

/**
 * Color scheme configuration
 */
export interface ColorScheme {
  cursor?: string;
  selection?: string;
  directory?: string;
  file?: string;
  status?: string;
  error?: string;
}

/**
 * S3 configuration
 */
export interface S3Config {
  region?: string;
  profile?: string; // AWS profile name
  endpoint?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  bucket?: string;
}

/**
 * Display configuration
 */
export interface DisplayConfig {
  showIcons?: boolean;
  showSizes?: boolean;
  showDates?: boolean;
  dateFormat?: string;
  defaultSort?: 'name' | 'size' | 'date';
  showHiddenFiles?: boolean;
}

/**
 * Main configuration object
 */
export interface AppConfig {
  adapter?: 'mock' | 's3';
  keybindings?: KeybindingConfig;
  colors?: ColorScheme;
  s3?: S3Config;
  display?: DisplayConfig;
}

/**
 * Configuration manager
 */
export class ConfigManager {
  private config: AppConfig = {};
  private configPath: string;

  constructor(configPath?: string) {
    this.configPath = configPath || expandUser('~/.open-s3rc.json');
    this.load();
  }

  /**
   * Load configuration from file
   */
  private load(): void {
    if (existsSync(this.configPath)) {
      try {
        const content = readFileSync(this.configPath, 'utf-8');
        this.config = JSON.parse(content);
      } catch (error) {
        console.error('Failed to load config:', error);
        this.config = {};
      }
    }
  }

  /**
   * Save configuration to file
   */
  save(): void {
    try {
      writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
    } catch (error) {
      console.error('Failed to save config:', error);
    }
  }

  /**
   * Get full configuration
   */
  getConfig(): AppConfig {
    return this.config;
  }

  /**
   * Set configuration
   */
  setConfig(config: Partial<AppConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get adapter type
   */
  getAdapter(): string {
    return this.config.adapter || 's3';
  }

  /**
   * Set adapter type
   */
  setAdapter(adapter: 'mock' | 's3'): void {
    this.config.adapter = adapter;
  }

  /**
   * Get keybindings
   */
  getKeybindings(): KeybindingConfig {
    return this.config.keybindings || this.getDefaultKeybindings();
  }

  /**
   * Get default keybindings (vim-style)
   */
  private getDefaultKeybindings(): KeybindingConfig {
    return {
      moveUp: ['k'],
      moveDown: ['j'],
      moveTop: ['g'],
      moveBottom: ['G'],
      openEntry: ['l', 'enter'],
      openParent: ['h', 'backspace'],
      enter: ['enter'],
      normalMode: ['escape'],
      visualMode: ['v'],
      editMode: ['i', 'a'],
      delete: ['d'],
      rename: ['r'],
      copy: ['c'],
      paste: ['p'],
      save: ['w'],
      quit: ['q'],
    };
  }

  /**
   * Set keybindings
   */
  setKeybindings(keybindings: KeybindingConfig): void {
    this.config.keybindings = keybindings;
  }

  /**
   * Get color scheme
   */
  getColorScheme(): ColorScheme {
    return this.config.colors || this.getDefaultColorScheme();
  }

  /**
   * Get default color scheme
   */
  private getDefaultColorScheme(): ColorScheme {
    return {
      cursor: '#FFFF00',
      selection: '#00FF00',
      directory: '#0080FF',
      file: '#FFFFFF',
      status: '#888888',
      error: '#FF0000',
    };
  }

  /**
   * Set color scheme
   */
  setColorScheme(colors: ColorScheme): void {
    this.config.colors = colors;
  }

  /**
   * Get S3 configuration
   */
  getS3Config(): S3Config {
    return this.config.s3 || {};
  }

  /**
   * Set S3 configuration
   */
  setS3Config(s3: S3Config): void {
    this.config.s3 = s3;
  }

  /**
   * Get AWS profile from config
   */
  getAwsProfile(): string | undefined {
    return this.config.s3?.profile;
  }

  /**
   * Set AWS profile in config
   */
  setAwsProfile(profile: string): void {
    if (!this.config.s3) {
      this.config.s3 = {};
    }
    this.config.s3.profile = profile;
  }

  /**
   * Get display configuration
   */
  getDisplayConfig(): DisplayConfig {
    return this.config.display || this.getDefaultDisplayConfig();
  }

  /**
   * Get default display configuration
   */
  private getDefaultDisplayConfig(): DisplayConfig {
    return {
      showIcons: true,
      showSizes: true,
      showDates: false,
      dateFormat: 'YYYY-MM-DD HH:mm',
      defaultSort: 'name',
      showHiddenFiles: false,
    };
  }

  /**
   * Set display configuration
   */
  setDisplayConfig(display: DisplayConfig): void {
    this.config.display = display;
  }
}
