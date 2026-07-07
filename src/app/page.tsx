'use client';

import React, { useState, useRef, useEffect } from 'react';
import { 
  Upload, 
  Download, 
  Settings, 
  Film, 
  RefreshCw, 
  FileText, 
  Palette, 
  Tv, 
  AlertCircle,
  Sparkles,
  Layers
} from 'lucide-react';
import { 
  parseSrt, 
  parseAss, 
  convertTo3D, 
  discard3D, 
  serializeAss, 
  serializeSrt, 
  SubtitleData,
  AssStyle
} from '../lib/subtitleParser';

// Convert ASS color string (e.g., &H00FFFFFA or &H00000000) to HTML hex (#RRGGBB)
function assColorToHex(assColor: string): string {
  let clean = assColor.replace(/&H/i, '').replace(/&/g, '');
  // ASS colors are in AABBGGRR or BBGGRR format (BGR order)
  if (clean.length > 6) {
    clean = clean.substring(clean.length - 6); // Keep last 6 chars (BGR)
  }
  if (clean.length === 6) {
    const b = clean.substring(0, 2);
    const g = clean.substring(2, 4);
    const r = clean.substring(4, 6);
    return `#${r}${g}${b}`;
  }
  return '#ffffff';
}

// Convert HTML hex (#RRGGBB) to ASS color string (e.g., &H00BBGGRR)
function hexToAssColor(hex: string): string {
  const clean = hex.replace('#', '');
  if (clean.length === 6) {
    const r = clean.substring(0, 2);
    const g = clean.substring(2, 4);
    const b = clean.substring(4, 6);
    return `&H00${b}${g}${r}`;
  }
  return '&H00FFFFFF';
}

export default function Sub3dtoolPage() {
  const [file, setFile] = useState<File | null>(null);
  const [subtitleData, setSubtitleData] = useState<SubtitleData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  
  // Settings State
  const [mode, setMode] = useState<'sbs' | 'tb' | 'no3d'>('sbs');
  const [playResX, setPlayResX] = useState<number>(1920);
  const [playResY, setPlayResY] = useState<number>(1080);
  const [fontName, setFontName] = useState<string>('Arial');
  const [fontSize, setFontSize] = useState<number>(64);
  const [primaryColor, setPrimaryColor] = useState<string>('#ffffff');
  const [outlineColor, setOutlineColor] = useState<string>('#000000');
  const [backColor, setBackColor] = useState<string>('#000000');
  const [alignment, setAlignment] = useState<number>(2); // 2 is bottom-center
  const [marginV, setMarginV] = useState<number>(10);
  const [marginL, setMarginL] = useState<number>(10);
  const [marginR, setMarginR] = useState<number>(10);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync settings when a file is parsed
  useEffect(() => {
    if (subtitleData && subtitleData.styles.length > 0) {
      const mainStyle = subtitleData.styles[0];
      setPlayResX(subtitleData.playResX);
      setPlayResY(subtitleData.playResY);
      setFontName(mainStyle.fontName);
      setFontSize(mainStyle.fontSize);
      setPrimaryColor(assColorToHex(mainStyle.primaryColor));
      setOutlineColor(assColorToHex(mainStyle.outlineColor));
      setBackColor(assColorToHex(mainStyle.backColor));
      setAlignment(mainStyle.alignment);
      setMarginV(mainStyle.marginV);
      setMarginL(mainStyle.marginL);
      setMarginR(mainStyle.marginR);
    }
  }, [subtitleData]);

  // Handle file load and parsing
  const handleSubtitleFile = (selectedFile: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      try {
        let parsed: SubtitleData;
        if (selectedFile.name.endsWith('.srt')) {
          parsed = parseSrt(content);
        } else if (selectedFile.name.endsWith('.ass') || selectedFile.name.endsWith('.ssa')) {
          parsed = parseAss(content);
        } else {
          setError('Unsupported file format. Please upload an .srt or .ass file.');
          return;
        }

        if (parsed.events.length === 0) {
          setError('No subtitle events found in the file.');
          return;
        }

        setError(null);
        setFile(selectedFile);
        setSubtitleData(parsed);
      } catch (err: any) {
        setError(`Failed to parse file: ${err.message || err}`);
      }
    };
    reader.onerror = () => {
      setError('Error reading the file.');
    };
    reader.readAsText(selectedFile);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleSubtitleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleSubtitleFile(e.target.files[0]);
    }
  };

  // Run the 3D conversion and trigger download
  const handleExport = () => {
    if (!subtitleData || !file) return;

    // Apply active overrides to subtitle styles
    const updatedStyles = subtitleData.styles.map((style) => {
      // Create copy of style
      const s = { ...style };
      s.fontName = fontName;
      s.fontSize = fontSize;
      s.primaryColor = hexToAssColor(primaryColor);
      s.outlineColor = hexToAssColor(outlineColor);
      s.backColor = hexToAssColor(backColor);
      s.alignment = alignment;
      s.marginV = marginV;
      s.marginL = marginL;
      s.marginR = marginR;
      return s;
    });

    const baseData: SubtitleData = {
      ...subtitleData,
      playResX,
      playResY,
      styles: updatedStyles,
    };

    let finalData: SubtitleData;
    if (mode === 'no3d') {
      finalData = discard3D(baseData);
    } else {
      finalData = convertTo3D(baseData, mode);
    }

    // Generate output file contents
    const outputContent = serializeAss(finalData);
    const blob = new Blob([outputContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    
    // Create download link
    const link = document.createElement('a');
    const baseName = file.name.substring(0, file.name.lastIndexOf('.'));
    link.href = url;
    link.download = `${baseName}_3d_${mode.toUpperCase()}.ass`;
    document.body.appendChild(link);
    link.click();
    
    // Clean up
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const resetApp = () => {
    setFile(null);
    setSubtitleData(null);
    setError(null);
  };

  // Standard alignments in ASS:
  // 1: Bottom-Left, 2: Bottom-Center, 3: Bottom-Right
  // 5: Top-Left, 6: Top-Center, 7: Top-Right
  // 9: Middle-Left, 10: Middle-Center, 11: Middle-Right
  const ALIGNMENTS = [
    { value: 5, label: 'Top Left' },
    { value: 6, label: 'Top Center' },
    { value: 7, label: 'Top Right' },
    { value: 9, label: 'Middle Left' },
    { value: 10, label: 'Middle Center' },
    { value: 11, label: 'Middle Right' },
    { value: 1, label: 'Bottom Left' },
    { value: 2, label: 'Bottom Center' },
    { value: 3, label: 'Bottom Right' }
  ];

  return (
    <div className="container">
      {/* Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <div>
          <h1 className="logo-text">Sub3dtool Web</h1>
          <p className="logo-sub">Online 3D Subtitle Converter</p>
        </div>
        {file && (
          <button onClick={resetApp} className="mode-btn" style={{ border: '1px solid var(--border-standard)' }}>
            Upload Another File
          </button>
        )}
      </header>

      {error && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          color: '#f87171',
          padding: '16px',
          borderRadius: '12px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      {/* Upload Screen */}
      {!file ? (
        <div className="glass-panel" style={{ padding: '60px 40px', maxWidth: '700px', margin: '60px auto 0 auto' }}>
          <div 
            className={`drop-zone ${dragActive ? 'active' : ''}`}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              accept=".srt,.ass,.ssa" 
              style={{ display: 'none' }} 
            />
            <div className="drop-icon-wrapper">
              <Upload size={32} />
            </div>
            <h3 style={{ fontSize: '1.4rem', fontWeight: '600' }}>Upload Subtitle File</h3>
            <p style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.95rem' }}>
              Drag & Drop your <strong>.srt</strong> or <strong>.ass</strong> files here, or click to browse
            </p>
            <span style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))' }}>
              Files are processed entirely in your browser. No data is sent to any server.
            </span>
          </div>

          <div style={{ marginTop: '40px', borderTop: '1px solid var(--border-standard)', paddingTop: '30px' }}>
            <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem', color: '#fff', marginBottom: '15px' }}>
              <Sparkles size={16} style={{ color: 'hsl(var(--accent-cyan))' }} />
              Supported Modes
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-standard)', padding: '15px', borderRadius: '12px' }}>
                <h5 style={{ fontSize: '0.9rem', color: 'hsl(var(--accent-cyan))', marginBottom: '5px' }}>Side-by-Side (SBS)</h5>
                <p style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))' }}>Splits subtitles into left and right halves. Perfect for 3D SBS video streams.</p>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-standard)', padding: '15px', borderRadius: '12px' }}>
                <h5 style={{ fontSize: '0.9rem', color: 'hsl(var(--accent-purple))', marginBottom: '5px' }}>Top-Bottom (TB)</h5>
                <p style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))' }}>Splits subtitles into top and bottom halves. Ideal for 3D Over-Under video streams.</p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Workspace Screen */
        <div className="app-grid">
          {/* Settings Sidebar */}
          <aside className="glass-panel" style={{ padding: '25px', alignSelf: 'start' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.2rem', color: '#fff', marginBottom: '20px' }}>
              <Settings size={18} style={{ color: 'hsl(var(--accent-cyan))' }} />
              Settings
            </h3>

            {/* Mode selection */}
            <div className="input-label">3D Mode</div>
            <div className="mode-toggle-group">
              <button 
                className={`mode-btn ${mode === 'sbs' ? 'active' : ''}`}
                onClick={() => setMode('sbs')}
              >
                SBS
              </button>
              <button 
                className={`mode-btn ${mode === 'tb' ? 'active' : ''}`}
                onClick={() => setMode('tb')}
              >
                TB
              </button>
              <button 
                className={`mode-btn ${mode === 'no3d' ? 'active' : ''}`}
                onClick={() => setMode('no3d')}
              >
                2D
              </button>
            </div>

            {/* Typography Group */}
            <div style={{ borderTop: '1px solid var(--border-standard)', paddingTop: '20px', marginBottom: '20px' }}>
              <h4 style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.95rem', color: '#fff', marginBottom: '15px' }}>
                <Tv size={14} style={{ color: 'hsl(var(--accent-blue))' }} />
                Layout & Font
              </h4>

              <div className="control-row">
                <div>
                  <label className="input-label">Font Family</label>
                  <input 
                    type="text" 
                    className="text-input"
                    value={fontName}
                    onChange={(e) => setFontName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="input-label">Font Size</label>
                  <input 
                    type="number" 
                    className="text-input"
                    value={fontSize}
                    onChange={(e) => setFontSize(parseInt(e.target.value) || 32)}
                  />
                </div>
              </div>

              <div className="control-row">
                <div>
                  <label className="input-label">Resolution W</label>
                  <input 
                    type="number" 
                    className="text-input"
                    value={playResX}
                    onChange={(e) => setPlayResX(parseInt(e.target.value) || 1920)}
                  />
                </div>
                <div>
                  <label className="input-label">Resolution H</label>
                  <input 
                    type="number" 
                    className="text-input"
                    value={playResY}
                    onChange={(e) => setPlayResY(parseInt(e.target.value) || 1080)}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label className="input-label">Alignment</label>
                <select 
                  className="select-input"
                  value={alignment}
                  onChange={(e) => setAlignment(parseInt(e.target.value))}
                >
                  {ALIGNMENTS.map((align) => (
                    <option key={align.value} value={align.value}>
                      {align.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Colors Group */}
            <div style={{ borderTop: '1px solid var(--border-standard)', paddingTop: '20px', marginBottom: '20px' }}>
              <h4 style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.95rem', color: '#fff', marginBottom: '15px' }}>
                <Palette size={14} style={{ color: 'hsl(var(--accent-purple))' }} />
                Colors
              </h4>

              <div className="control-row">
                <div>
                  <label className="input-label">Primary Color</label>
                  <div className="color-picker-wrapper">
                    <input 
                      type="color" 
                      className="color-indicator"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                    />
                    <span style={{ fontSize: '0.85rem' }}>{primaryColor}</span>
                  </div>
                </div>
                <div>
                  <label className="input-label">Outline Color</label>
                  <div className="color-picker-wrapper">
                    <input 
                      type="color" 
                      className="color-indicator"
                      value={outlineColor}
                      onChange={(e) => setOutlineColor(e.target.value)}
                    />
                    <span style={{ fontSize: '0.85rem' }}>{outlineColor}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Margins Group */}
            <div style={{ borderTop: '1px solid var(--border-standard)', paddingTop: '20px', marginBottom: '30px' }}>
              <h4 style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.95rem', color: '#fff', marginBottom: '15px' }}>
                <Layers size={14} style={{ color: 'hsl(var(--accent-pink))' }} />
                Margins
              </h4>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                <div>
                  <label className="input-label">Vertical</label>
                  <input 
                    type="number" 
                    className="text-input"
                    value={marginV}
                    onChange={(e) => setMarginV(parseInt(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <label className="input-label">Left</label>
                  <input 
                    type="number" 
                    className="text-input"
                    value={marginL}
                    onChange={(e) => setMarginL(parseInt(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <label className="input-label">Right</label>
                  <input 
                    type="number" 
                    className="text-input"
                    value={marginR}
                    onChange={(e) => setMarginR(parseInt(e.target.value) || 0)}
                  />
                </div>
              </div>
            </div>

            {/* Export Action */}
            <button onClick={handleExport} className="action-btn">
              <Download size={18} />
              Convert & Download
            </button>
          </aside>

          {/* Main workspace display & Preview */}
          <main className="preview-container">
            {/* Visual Previewer screen */}
            <div className="glass-panel" style={{ padding: '25px' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.2rem', color: '#fff', marginBottom: '20px' }}>
                <Film size={18} style={{ color: 'hsl(var(--accent-purple))' }} />
                Visual 3D Mock Preview
              </h3>

              <div className={`screen-wrapper ${mode === 'sbs' ? 'screen-sbs' : mode === 'tb' ? 'screen-tb' : 'screen-2d'}`}>
                {/* Left/Top Eye half */}
                <div className="preview-half">
                  <div 
                    className="preview-sub"
                    style={{
                      fontFamily: fontName,
                      fontSize: `${fontSize * 0.4}px`, // Scaled down for mockup UI
                      color: primaryColor,
                      textShadow: `
                        -1px -1px 0 ${outlineColor},  
                         1px -1px 0 ${outlineColor},
                        -1px  1px 0 ${outlineColor},
                         1px  1px 0 ${outlineColor},
                         0px 2px 4px rgba(0,0,0,0.8)
                      `,
                      transform: mode === 'sbs' ? 'scaleX(0.5)' : mode === 'tb' ? 'scaleY(0.5)' : 'none',
                      // Shift layout margin
                      paddingBottom: `${marginV * 0.15}px`,
                      paddingLeft: `${marginL * 0.1}px`,
                      paddingRight: `${marginR * 0.1}px`,
                    }}
                  >
                    3D Subtitle Preview<br />
                    [Left/Top Eye Frame]
                  </div>
                </div>

                {/* Right/Bottom Eye half (Only show for 3D modes) */}
                {mode !== 'no3d' && (
                  <div className="preview-half">
                    <div 
                      className="preview-sub"
                      style={{
                        fontFamily: fontName,
                        fontSize: `${fontSize * 0.4}px`, // Scaled down
                        color: primaryColor,
                        textShadow: `
                          -1px -1px 0 ${outlineColor},  
                           1px -1px 0 ${outlineColor},
                          -1px  1px 0 ${outlineColor},
                           1px  1px 0 ${outlineColor},
                           0px 2px 4px rgba(0,0,0,0.8)
                        `,
                        transform: mode === 'sbs' ? 'scaleX(0.5)' : mode === 'tb' ? 'scaleY(0.5)' : 'none',
                        paddingBottom: `${marginV * 0.15}px`,
                        paddingLeft: `${marginL * 0.1}px`,
                        paddingRight: `${marginR * 0.1}px`,
                      }}
                    >
                      3D Subtitle Preview<br />
                      [Right/Bottom Eye Frame]
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Details Panel */}
            <div className="glass-panel" style={{ padding: '25px' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem', color: '#fff', marginBottom: '15px' }}>
                <FileText size={16} style={{ color: 'hsl(var(--accent-cyan))' }} />
                File Metadata Info
              </h3>

              <div className="metadata-grid">
                <div className="metadata-item">
                  <span className="input-label">Filename</span>
                  <span className="metadata-val" style={{ wordBreak: 'break-all' }}>{file.name}</span>
                </div>
                <div className="metadata-item">
                  <span className="input-label">Format</span>
                  <span className="metadata-val" style={{ textTransform: 'uppercase' }}>{subtitleData?.format}</span>
                </div>
                <div className="metadata-item">
                  <span className="input-label">Events Count</span>
                  <span className="metadata-val">{subtitleData?.events.length} lines</span>
                </div>
                <div className="metadata-item">
                  <span className="input-label">Original Resolution</span>
                  <span className="metadata-val">{subtitleData?.playResX} x {subtitleData?.playResY}</span>
                </div>
              </div>
            </div>
          </main>
        </div>
      )}

      {/* Footer */}
      <footer className="footer-text">
        <p>Sub3dtool Web &bull; Powered by Antigravity AI Engine &bull; GPL v3 Licensed</p>
      </footer>
    </div>
  );
}
