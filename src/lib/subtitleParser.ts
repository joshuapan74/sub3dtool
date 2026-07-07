export interface AssStyle {
  name: string;
  fontName: string;
  fontSize: number;
  primaryColor: string; // e.g. &H00FFFFFF (AABBGGRR or BBGGRR)
  secondaryColor: string;
  outlineColor: string;
  backColor: string;
  bold: number;
  italic: number;
  underline: number;
  strikeOut: number;
  scaleX: number;
  scaleY: number;
  spacing: number;
  angle: number;
  borderStyle: number;
  outline: number;
  shadow: number;
  alignment: number;
  marginL: number;
  marginR: number;
  marginV: number;
  encoding: number;
}

export interface AssEvent {
  layer: number;
  start: string; // "H:MM:SS.cc"
  end: string;
  style: string;
  name: string;
  marginL: number;
  marginR: number;
  marginV: number;
  effect: string;
  text: string;
}

export interface SubtitleData {
  format: 'srt' | 'ass';
  title?: string;
  playResX: number;
  playResY: number;
  styles: AssStyle[];
  events: AssEvent[];
}

// Convert SRT time "HH:MM:SS,mmm" to ms
function srtTimeToMs(timeStr: string): number {
  const match = timeStr.trim().match(/(\d+):(\d+):(\d+),(\d+)/);
  if (!match) return 0;
  const [_, h, m, s, ms] = match;
  return parseInt(h) * 3600000 + parseInt(m) * 60000 + parseInt(s) * 1000 + parseInt(ms);
}

// Convert ms to SRT time "HH:MM:SS,mmm"
function msToSrtTime(ms: number): string {
  const h = Math.floor(ms / 3600000);
  ms %= 3600000;
  const m = Math.floor(ms / 60000);
  ms %= 60000;
  const s = Math.floor(ms / 1000);
  const msec = ms % 1000;

  const pad = (n: number, l = 2) => String(n).padStart(l, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(msec, 3)}`;
}

// Convert ms to ASS time "H:MM:SS.cc"
function msToAssTime(ms: number): string {
  const h = Math.floor(ms / 3600000);
  ms %= 3600000;
  const m = Math.floor(ms / 60000);
  ms %= 60000;
  const s = Math.floor(ms / 1000);
  const cs = Math.floor((ms % 1000) / 10);

  const pad = (n: number, l = 2) => String(n).padStart(l, '0');
  return `${h}:${pad(m)}:${pad(s)}.${pad(cs, 2)}`;
}

// Convert ASS time "H:MM:SS.cc" to ms
function assTimeToMs(timeStr: string): number {
  const match = timeStr.trim().match(/(\d+):(\d+):(\d+)\.(\d+)/);
  if (!match) return 0;
  const [_, h, m, s, cs] = match;
  return parseInt(h) * 3600000 + parseInt(m) * 60000 + parseInt(s) * 1000 + parseInt(cs) * 10;
}

// Helper to convert HTML-like tags in SRT to ASS tags
export function srtToAssText(text: string): string {
  let res = text
    .replace(/\r?\n/g, '\\N') // Replace newlines with ASS newline tag
    .replace(/<i\b[^>]*>/gi, '{\\i1}')
    .replace(/<\/i>/gi, '{\\i0}')
    .replace(/<b\b[^>]*>/gi, '{\\b1}')
    .replace(/<\/b>/gi, '{\\b0}')
    .replace(/<u\b[^>]*>/gi, '{\\u1}')
    .replace(/<\/u>/gi, '{\\u0}');

  // Convert font color tags: <font color="#RRGGBB">...</font> to {\c&HBBGGRR&}...{\c}
  const fontRegex = /<font\s+color=["']#?([a-f0-9]{6})["']>/gi;
  res = res.replace(fontRegex, (_, colorHex) => {
    const r = colorHex.substring(0, 2);
    const g = colorHex.substring(2, 4);
    const b = colorHex.substring(4, 6);
    return `{\\c&H${b}${g}${r}&}`;
  });
  res = res.replace(/<\/font>/gi, '{\\c}');

  return res;
}

// Helper to convert ASS tags to HTML tags for SRT
export function assToSrtText(text: string): string {
  let res = text.replace(/\\N/g, '\n');

  // Simple conversion of style overrides
  res = res.replace(/\{\\i1\}/g, '<i>').replace(/\{\\i0\}/g, '</i>');
  res = res.replace(/\{\\b1\}/g, '<b>').replace(/\{\\b0\}/g, '</b>');
  res = res.replace(/\{\\u1\}/g, '<u>').replace(/\{\\u0\}/g, '</u>');

  // Convert {\c&HBBGGRR&} to <font color="#RRGGBB"> and {\c} to </font>
  const colorRegex = /\{\\c&H([a-f0-9]{6})&\}/gi;
  res = res.replace(colorRegex, (_, bgr) => {
    const b = bgr.substring(0, 2);
    const g = bgr.substring(2, 4);
    const r = bgr.substring(4, 6);
    return `<font color="#${r}${g}${b}">`;
  });
  res = res.replace(/\{\\c\}/g, '</font>');

  // Clean up any remaining ASS tags we don't support in SRT
  res = res.replace(/\{[^\}]+\}/g, '');

  return res;
}

// Parse SRT text content
export function parseSrt(content: string): SubtitleData {
  const blocks = content.trim().split(/\n\s*\r?\n/);
  const events: AssEvent[] = [];

  blocks.forEach((block) => {
    const lines = block.split(/\r?\n/);
    if (lines.length < 2) return;

    // Find the timestamp line
    let timeIndex = 1;
    if (!lines[0].includes('-->')) {
      timeIndex = 1;
    } else {
      timeIndex = 0;
    }

    const timeLine = lines[timeIndex];
    if (!timeLine || !timeLine.includes('-->')) return;

    const parts = timeLine.split('-->');
    const startStr = parts[0].trim();
    const endStr = parts[1].trim();

    const startMs = srtTimeToMs(startStr);
    const endMs = srtTimeToMs(endStr);

    const startAss = msToAssTime(startMs);
    const endAss = msToAssTime(endMs);

    const textLines = lines.slice(timeIndex + 1);
    const rawText = textLines.join('\n');
    const assText = srtToAssText(rawText);

    events.push({
      layer: 0,
      start: startAss,
      end: endAss,
      style: 'DefaultStyle',
      name: '',
      marginL: 0,
      marginR: 0,
      marginV: 10,
      effect: '',
      text: assText,
    });
  });

  const defaultStyle: AssStyle = {
    name: 'DefaultStyle',
    fontName: 'Arial',
    fontSize: 64,
    primaryColor: '&H00FFFFFA', // ABGR
    secondaryColor: '&H00FFFFC8',
    outlineColor: '&H00000000',
    backColor: '&H00000000',
    bold: 0,
    italic: 0,
    underline: 0,
    strikeOut: 0,
    scaleX: 100,
    scaleY: 100,
    spacing: 0,
    angle: 0,
    borderStyle: 1,
    outline: 2,
    shadow: 2,
    alignment: 2, // Centered
    marginL: 10,
    marginR: 10,
    marginV: 10,
    encoding: 1,
  };

  return {
    format: 'srt',
    playResX: 1920,
    playResY: 1080,
    styles: [defaultStyle],
    events,
  };
}

// Parse ASS text content
export function parseAss(content: string): SubtitleData {
  const sections: { [key: string]: string[] } = {};
  let currentSection = '';

  const lines = content.split(/\r?\n/);
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    if (trimmed.startsWith(';')) return; // comment

    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      currentSection = trimmed.substring(1, trimmed.length - 1).toLowerCase();
      sections[currentSection] = [];
    } else if (currentSection) {
      sections[currentSection].push(trimmed);
    }
  });

  let playResX = 1920;
  let playResY = 1080;
  let title = 'Unknown';

  if (sections['script info']) {
    sections['script info'].forEach((line) => {
      const parts = line.split(':');
      if (parts.length < 2) return;
      const key = parts[0].trim().toLowerCase();
      const val = parts.slice(1).join(':').trim();

      if (key === 'playresx') playResX = parseInt(val) || 1920;
      if (key === 'playresy') playResY = parseInt(val) || 1080;
      if (key === 'title') title = val;
    });
  }

  const styles: AssStyle[] = [];
  if (sections['v4+ styles']) {
    let formatColumns: string[] = [];
    sections['v4+ styles'].forEach((line) => {
      const colonIdx = line.indexOf(':');
      if (colonIdx === -1) return;
      const key = line.substring(0, colonIdx).trim().toLowerCase();
      const val = line.substring(colonIdx + 1).trim();

      if (key === 'format') {
        formatColumns = val.split(',').map((s) => s.trim().toLowerCase());
      } else if (key === 'style') {
        const vals = val.split(',').map((s) => s.trim());
        const styleObj: any = {};
        formatColumns.forEach((col, idx) => {
          styleObj[col] = vals[idx];
        });

        styles.push({
          name: styleObj['name'] || 'Default',
          fontName: styleObj['fontname'] || 'Arial',
          fontSize: parseInt(styleObj['fontsize']) || 64,
          primaryColor: styleObj['primarycolour'] || '&H00FFFFFF',
          secondaryColor: styleObj['secondarycolour'] || '&H000000FF',
          outlineColor: styleObj['outlinecolour'] || '&H00000000',
          backColor: styleObj['backcolour'] || '&H00000000',
          bold: parseInt(styleObj['bold']) || 0,
          italic: parseInt(styleObj['italic']) || 0,
          underline: parseInt(styleObj['underline']) || 0,
          strikeOut: parseInt(styleObj['strikeout']) || 0,
          scaleX: parseInt(styleObj['scalex']) || 100,
          scaleY: parseInt(styleObj['scaley']) || 100,
          spacing: parseInt(styleObj['spacing']) || 0,
          angle: parseFloat(styleObj['angle']) || 0,
          borderStyle: parseInt(styleObj['borderstyle']) || 1,
          outline: parseFloat(styleObj['outline']) || 2,
          shadow: parseFloat(styleObj['shadow']) || 2,
          alignment: parseInt(styleObj['alignment']) || 2,
          marginL: parseInt(styleObj['marginl']) || 10,
          marginR: parseInt(styleObj['marginr']) || 10,
          marginV: parseInt(styleObj['marginv']) || 10,
          encoding: parseInt(styleObj['encoding']) || 1,
        });
      }
    });
  }

  const events: AssEvent[] = [];
  if (sections['events']) {
    let formatColumns: string[] = [];
    sections['events'].forEach((line) => {
      const colonIdx = line.indexOf(':');
      if (colonIdx === -1) return;
      const key = line.substring(0, colonIdx).trim().toLowerCase();
      const val = line.substring(colonIdx + 1).trim();

      if (key === 'format') {
        formatColumns = val.split(',').map((s) => s.trim().toLowerCase());
      } else if (key === 'dialogue') {
        // Dialogue values are comma-separated, but the last column "Text" can contain commas.
        // So we split only for the first N-1 columns.
        const numCols = formatColumns.length;
        const vals: string[] = [];
        let curStr = val;

        for (let i = 0; i < numCols - 1; i++) {
          const commaIdx = curStr.indexOf(',');
          if (commaIdx === -1) {
            vals.push(curStr);
            curStr = '';
          } else {
            vals.push(curStr.substring(0, commaIdx));
            curStr = curStr.substring(commaIdx + 1);
          }
        }
        vals.push(curStr); // The remaining string is the text column

        const eventObj: any = {};
        formatColumns.forEach((col, idx) => {
          eventObj[col] = vals[idx];
        });

        events.push({
          layer: parseInt(eventObj['layer']) || 0,
          start: eventObj['start'] || '0:00:00.00',
          end: eventObj['end'] || '0:00:00.00',
          style: eventObj['style'] || 'Default',
          name: eventObj['name'] || '',
          marginL: parseInt(eventObj['marginl']) || 0,
          marginR: parseInt(eventObj['marginr']) || 0,
          marginV: parseInt(eventObj['marginv']) || 0,
          effect: eventObj['effect'] || '',
          text: eventObj['text'] || '',
        });
      }
    });
  }

  return {
    format: 'ass',
    title,
    playResX,
    playResY,
    styles,
    events,
  };
}

// Convert data to 3D SBS or TB format
export function convertTo3D(data: SubtitleData, mode: 'sbs' | 'tb'): SubtitleData {
  const result: SubtitleData = {
    ...data,
    format: 'ass', // 3D is always output in ASS format
    styles: [],
    events: [],
  };

  const margin = mode === 'tb' ? result.playResY / 2 : result.playResX / 2;

  // Clone and adjust styles
  const styleMap = new Map<string, { left: AssStyle; right: AssStyle }>();

  data.styles.forEach((style) => {
    const leftStyle: AssStyle = {
      ...style,
      name: `${style.name}_Le`,
    };

    const rightStyle: AssStyle = {
      ...style,
      name: `${style.name}_Ri`,
    };

    if (mode === 'sbs') {
      leftStyle.scaleX = Math.round(style.scaleX / 2);
      leftStyle.marginL = Math.round(style.marginL / 2);
      leftStyle.marginR = Math.round(style.marginR / 2 + margin);

      rightStyle.scaleX = Math.round(style.scaleX / 2);
      rightStyle.marginL = Math.round(style.marginL / 2 + margin);
      rightStyle.marginR = Math.round(style.marginR / 2);
    } else {
      // Top-Bottom
      leftStyle.scaleY = Math.round(style.scaleY / 2);
      leftStyle.marginV = Math.round(style.marginV / 2);

      rightStyle.scaleY = Math.round(style.scaleY / 2);
      rightStyle.marginV = Math.round(style.marginV / 2 + margin);
    }

    result.styles.push(leftStyle);
    result.styles.push(rightStyle);

    styleMap.set(style.name, { left: leftStyle, right: rightStyle });
  });

  // Duplicate events for left and right eyes
  data.events.forEach((event) => {
    const mappedStyles = styleMap.get(event.style);
    const leftStyleName = mappedStyles ? mappedStyles.left.name : `${event.style}_Le`;
    const rightStyleName = mappedStyles ? mappedStyles.right.name : `${event.style}_Ri`;

    // Left eye event
    result.events.push({
      ...event,
      style: leftStyleName,
    });

    // Right eye event
    result.events.push({
      ...event,
      style: rightStyleName,
    });
  });

  return result;
}

// Convert 3D back to 2D
export function discard3D(data: SubtitleData): SubtitleData {
  const result: SubtitleData = {
    ...data,
    styles: [],
    events: [],
  };

  const restoredStyles = new Map<string, AssStyle>();

  data.styles.forEach((style) => {
    if (style.name.endsWith('_Le')) {
      const originalName = style.name.slice(0, -3);
      const originalStyle: AssStyle = {
        ...style,
        name: originalName,
      };

      // Restore scales and margins
      originalStyle.scaleX = style.scaleX * 2;
      originalStyle.scaleY = style.scaleY * 2;
      originalStyle.marginL = style.marginL * 2;
      originalStyle.marginR = style.marginR * 2;
      originalStyle.marginV = style.marginV * 2;

      // Bound scales to standard values
      if (originalStyle.scaleX > 100) originalStyle.scaleX = 100;
      if (originalStyle.scaleY > 100) originalStyle.scaleY = 100;

      restoredStyles.set(originalName, originalStyle);
      result.styles.push(originalStyle);
    }
  });

  // If there were no _Le style names found, we don't filter/discard anything
  if (restoredStyles.size === 0) {
    return data;
  }

  // Filter events: keep only left eye event (mapped to original style) and drop right eye events
  data.events.forEach((event) => {
    if (event.style.endsWith('_Le')) {
      const originalStyleName = event.style.slice(0, -3);
      result.events.push({
        ...event,
        style: originalStyleName,
      });
    }
  });

  return result;
}

// Serialize SubtitleData back to ASS text format
export function serializeAss(data: SubtitleData): string {
  const lines: string[] = [];

  // Script Info
  lines.push('[Script Info]');
  lines.push(`Title: ${data.title || 'Untitled'}`);
  lines.push('ScriptType: v4.00+');
  lines.push('WrapStyle: 0');
  lines.push(`PlayResX: ${data.playResX}`);
  lines.push(`PlayResY: ${data.playResY}`);
  lines.push('');

  // Styles Section
  lines.push('[V4+ Styles]');
  lines.push('Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding');
  
  data.styles.forEach((s) => {
    lines.push(`Style: ${s.name},${s.fontName},${s.fontSize},${s.primaryColor},${s.secondaryColor},${s.outlineColor},${s.backColor},${s.bold},${s.italic},${s.underline},${s.strikeOut},${s.scaleX},${s.scaleY},${s.spacing},${s.angle},${s.borderStyle},${s.outline},${s.shadow},${s.alignment},${s.marginL},${s.marginR},${s.marginV},${s.encoding}`);
  });
  lines.push('');

  // Events Section
  lines.push('[Events]');
  lines.push('Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text');
  
  data.events.forEach((e) => {
    lines.push(`Dialogue: ${e.layer},${e.start},${e.end},${e.style},${e.name},${String(e.marginL).padStart(4, '0')},${String(e.marginR).padStart(4, '0')},${String(e.marginV).padStart(4, '0')},${e.effect},${e.text}`);
  });

  return lines.join('\n');
}

// Serialize SubtitleData back to SRT text format
export function serializeSrt(data: SubtitleData): string {
  const blocks: string[] = [];

  // Get active style first color (for fallback)
  const defaultStyle = data.styles[0];

  data.events.forEach((e, idx) => {
    const sMs = assTimeToMs(e.start);
    const eMs = assTimeToMs(e.end);

    const sSrt = msToSrtTime(sMs);
    const eSrt = msToSrtTime(eMs);

    // Convert ASS tags back to SRT tags
    const srtText = assToSrtText(e.text);

    blocks.push(`${idx + 1}\n${sSrt} --> ${eSrt}\n${srtText}`);
  });

  return blocks.join('\n\n');
}
