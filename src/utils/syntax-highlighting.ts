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
 * Segment of text with optional color
 */
export interface TextSegment {
  text: string;
  color?: string;
}

/**
 * Highlighted line representation - contains multiple colored segments
 */
export interface HighlightedLine {
  segments: TextSegment[];
}

/**
 * Highlight code with syntax highlighting
 * Returns lines with color information for each segment
 */
export function highlightCode(code: string, filename: string): HighlightedLine[] {
  const language = detectLanguage(filename);
  if (!language) {
    // No highlighting for unsupported types
    return code.split('\n').map(line => ({
      segments: [{ text: line }],
    }));
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

    // Helper to decode HTML entities
    const decodeHtml = (html: string): string => {
      return html
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&#39;/g, "'");
    };

    // Parse HTML into lines with colored segments
    // We'll use a state machine to properly handle nested spans
    const lines: HighlightedLine[] = [];
    let currentSegments: TextSegment[] = [];

    let pos = 0;
    let currentColor: string | undefined = undefined;
    const colorStack: string[] = [];

    while (pos < highlighted.length) {
      // Check for opening span tag
      const openMatch = highlighted.slice(pos).match(/^<span class="([^"]*)">/);
      if (openMatch) {
        const className = openMatch[1];
        const color = mapHighlightColor(className);
        colorStack.push(color);
        currentColor = color;
        pos += openMatch[0].length;
        continue;
      }

      // Check for closing span tag
      const closeMatch = highlighted.slice(pos).match(/^<\/span>/);
      if (closeMatch) {
        colorStack.pop();
        currentColor = colorStack.length > 0 ? colorStack[colorStack.length - 1] : undefined;
        pos += closeMatch[0].length;
        continue;
      }

      // Check for newline
      if (highlighted[pos] === '\n') {
        lines.push({ segments: currentSegments.length > 0 ? currentSegments : [{ text: '' }] });
        currentSegments = [];
        pos++;
        continue;
      }

      // Regular character - accumulate text until next tag or newline
      let text = '';
      while (pos < highlighted.length && highlighted[pos] !== '\n' && highlighted[pos] !== '<') {
        text += highlighted[pos];
        pos++;
      }

      if (text) {
        text = decodeHtml(text);
        currentSegments.push({
          text,
          color: currentColor || CatppuccinMocha.text,
        });
      }
    }

    // Push final line if there are remaining segments
    if (currentSegments.length > 0) {
      lines.push({ segments: currentSegments });
    }

    // Ensure we have at least one line
    if (lines.length === 0) {
      lines.push({ segments: [{ text: '' }] });
    }

    return lines;
  } catch (err) {
    // If highlighting fails, return plain text
    console.error('Syntax highlighting failed:', err);
    return code.split('\n').map(line => ({
      segments: [{ text: line }],
    }));
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
