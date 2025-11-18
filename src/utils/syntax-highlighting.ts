/**
 * Syntax highlighting utilities for terminal display
 *
 * Uses highlight.js to highlight code based on file type
 * and converts to ANSI color codes for terminal display
 */

import hljs from 'highlight.js';
import { CatppuccinMocha } from '../ui/theme.js';

/**
 * Detect language from file extension
 */
export function detectLanguage(filename: string): string | null {
  const ext = filename.toLowerCase().split('.').pop();

  const languageMap: Record<string, string> = {
    js: 'javascript',
    jsx: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    py: 'python',
    rb: 'ruby',
    go: 'go',
    rs: 'rust',
    c: 'c',
    cpp: 'cpp',
    cc: 'cpp',
    cxx: 'cpp',
    h: 'cpp',
    hpp: 'cpp',
    java: 'java',
    sh: 'bash',
    bash: 'bash',
    zsh: 'bash',
    fish: 'bash',
    json: 'json',
    yaml: 'yaml',
    yml: 'yaml',
    toml: 'toml',
    xml: 'xml',
    html: 'html',
    css: 'css',
    scss: 'scss',
    md: 'markdown',
    markdown: 'markdown',
    sql: 'sql',
    csv: 'plaintext',
    txt: 'plaintext',
    log: 'plaintext',
  };

  return ext ? languageMap[ext] || null : null;
}

/**
 * Map highlight.js theme colors to Catppuccin Mocha colors
 */
function mapHighlightColor(hlToken: string): string {
  // Based on typical highlight.js token classes
  if (hlToken.includes('string')) return CatppuccinMocha.green;
  if (hlToken.includes('number')) return CatppuccinMocha.peach;
  if (hlToken.includes('literal')) return CatppuccinMocha.peach;
  if (hlToken.includes('attr')) return CatppuccinMocha.blue;
  if (hlToken.includes('attribute')) return CatppuccinMocha.blue;
  if (hlToken.includes('keyword')) return CatppuccinMocha.mauve;
  if (hlToken.includes('built_in')) return CatppuccinMocha.yellow;
  if (hlToken.includes('type')) return CatppuccinMocha.yellow;
  if (hlToken.includes('class')) return CatppuccinMocha.yellow;
  if (hlToken.includes('function')) return CatppuccinMocha.blue;
  if (hlToken.includes('title')) return CatppuccinMocha.blue;
  if (hlToken.includes('comment')) return CatppuccinMocha.overlay0;
  if (hlToken.includes('meta')) return CatppuccinMocha.overlay0;
  if (hlToken.includes('tag')) return CatppuccinMocha.mauve;
  if (hlToken.includes('name')) return CatppuccinMocha.text;
  if (hlToken.includes('operator')) return CatppuccinMocha.sky;
  if (hlToken.includes('punctuation')) return CatppuccinMocha.text;

  return CatppuccinMocha.text;
}

/**
 * Highlighted line representation
 */
export interface HighlightedLine {
  text: string;
  color?: string;
}

/**
 * Highlight code with syntax highlighting
 * Returns lines with color information
 */
export function highlightCode(code: string, filename: string): HighlightedLine[] {
  const language = detectLanguage(filename);
  if (!language) {
    // No highlighting for unsupported types
    return code.split('\n').map(line => ({ text: line }));
  }

  try {
    let highlighted: string;
    try {
      // Try to highlight with detected language
      const result = hljs.highlight(code, { language, ignoreIllegals: true });
      highlighted = result.value;
    } catch (err) {
      // Fallback to auto-detect if specific language fails
      const result = hljs.highlightAuto(code);
      highlighted = result.value;
    }

    // Parse HTML tags to extract text and colors
    let currentLine = '';
    let currentColor: string | undefined = undefined;

    // Simple parser for HTML span tags from highlight.js
    const regex = /<span class="([^"]*)">(.*?)<\/span>|([^<]+)|<br\/?>|(?:.)/g;
    let match;

    while ((match = regex.exec(highlighted)) !== null) {
      if (match[1]) {
        // Span tag with class
        const className = match[1];
        const text = match[2];
        const color = mapHighlightColor(className);

        // For now, just accumulate text with the color
        // In a more sophisticated implementation, we'd track per-character colors
        if (text) {
          currentLine += text;
          currentColor = color;
        }
      } else if (match[2]) {
        // This shouldn't happen but handle it
        currentLine += match[2];
      } else if (match[3]) {
        // Regular text without tags
        currentLine += match[3];
      }
    }

    // Split by newlines and create line objects
    const finalLines = currentLine.split('\n');
    return finalLines.map(line => ({
      text: line || '',
      color: currentColor,
    }));
  } catch (err) {
    // If highlighting fails, return plain text
    console.error('Syntax highlighting failed:', err);
    return code.split('\n').map(line => ({ text: line }));
  }
}

/**
 * Get the appropriate color for a line based on content
 * This is a simpler approach that analyzes the line content
 */
export function getLineColor(line: string): string {
  // Comments
  if (line.trim().startsWith('//') || line.trim().startsWith('#')) {
    return CatppuccinMocha.overlay0;
  }

  // Strings
  if (line.includes('"') || line.includes("'") || line.includes('`')) {
    return CatppuccinMocha.green;
  }

  // Keywords
  if (
    /\b(function|const|let|var|class|if|else|for|while|return|import|export|async|await)\b/.test(
      line
    )
  ) {
    return CatppuccinMocha.mauve;
  }

  return CatppuccinMocha.text;
}
