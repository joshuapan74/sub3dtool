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
  Layers,
  Volume2,
  Play,
  Pause,
  Square,
  Music,
  Loader2
} from 'lucide-react';
import { 
  parseSrt, 
  parseAss, 
  convertTo3D, 
  discard3D, 
  serializeAss, 
  serializeSrt, 
  SubtitleData,
  AssStyle,
  assToSrtText
} from '../lib/subtitleParser';
import { bufferToWav } from '../lib/audioCompiler';

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

// Convert ASS time "H:MM:SS.cc" to seconds
function assTimeToSeconds(timeStr: string): number {
  const match = timeStr.trim().match(/(\d+):(\d+):(\d+)\.(\d+)/);
  if (!match) return 0;
  const [_, h, m, s, cs] = match;
  return parseInt(h) * 3600 + parseInt(m) * 60 + parseInt(s) + parseInt(cs) / 100;
}

// Strips out all ASS formatting override tags for TTS reader
function stripAssTags(text: string): string {
  return text.replace(/\{[^\}]+\}/g, '').replace(/\\N/g, ' ').trim();
}

const SUPPORTED_LANGUAGES = [
  { code: 'zh-TW', name: 'Chinese (Taiwan) 繁體中文' },
  { code: 'zh-CN', name: 'Chinese (China) 简体中文' },
  { code: 'en-US', name: 'English (US)' },
  { code: 'ja-JP', name: 'Japanese 日本語' },
  { code: 'ko-KR', name: 'Korean 한국어' },
  { code: 'fr-FR', name: 'French' },
  { code: 'es-ES', name: 'Spanish' },
];

export default function Sub3dtoolPage() {
  const [file, setFile] = useState<File | null>(null);
  const [subtitleData, setSubtitleData] = useState<SubtitleData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [activeTab, setActiveTab] = useState<'visual' | 'tts'>('visual');

  // Visual Overrides Settings State
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

  // TTS Settings & State
  const [ttsLang, setTtsLang] = useState<string>('zh-TW');
  const [ttsSpeed, setTtsSpeed] = useState<number>(1.0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [activeEventIndex, setActiveEventIndex] = useState<number | null>(null);
  const [isSynthesizing, setIsSynthesizing] = useState<boolean>(false);
  const [synthesizeProgress, setSynthesizeProgress] = useState<number>(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const ttsTimerRef = useRef<NodeJS.Timeout[]>([]);
  const isPlayingRef = useRef<boolean>(false);

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

  // Clean up timers and speech on unmount
  useEffect(() => {
    return () => {
      stopReadAloud();
    };
  }, []);

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
        stopReadAloud();
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

    const outputContent = serializeAss(finalData);
    const blob = new Blob([outputContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    const baseName = file.name.substring(0, file.name.lastIndexOf('.'));
    link.href = url;
    link.download = `${baseName}_3d_${mode.toUpperCase()}.ass`;
    document.body.appendChild(link);
    link.click();
    
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Real-time speech playback helper
  const startReadAloud = () => {
    if (!subtitleData) return;
    stopReadAloud();
    setIsPlaying(true);
    isPlayingRef.current = true;

    const events = subtitleData.events;
    const synth = window.speechSynthesis;

    events.forEach((event, index) => {
      const startTimeMs = assTimeToSeconds(event.start) * 1000;
      const endTimeMs = assTimeToSeconds(event.end) * 1000;

      // Schedule highlight start
      const startTimer = setTimeout(() => {
        if (!isPlayingRef.current) return;
        setActiveEventIndex(index);

        // Synthesize voice
        const cleanText = stripAssTags(event.text);
        if (cleanText) {
          const utterance = new SpeechSynthesisUtterance(cleanText);
          utterance.lang = ttsLang;
          utterance.rate = ttsSpeed;
          
          // Try to select standard native voices matching the language
          const voices = synth.getVoices();
          const targetVoice = voices.find(v => v.lang.startsWith(ttsLang));
          if (targetVoice) utterance.voice = targetVoice;

          synth.cancel(); // Cancel any currently speaking utterance to speak the active block immediately
          synth.speak(utterance);
        }
      }, startTimeMs);

      // Schedule highlight stop
      const endTimer = setTimeout(() => {
        if (!isPlayingRef.current) return;
        setActiveEventIndex(prev => prev === index ? null : prev);
      }, endTimeMs);

      ttsTimerRef.current.push(startTimer);
      ttsTimerRef.current.push(endTimer);
    });

    // Schedule stop on completion
    const totalDuration = Math.max(...events.map(e => assTimeToSeconds(e.end))) * 1000;
    const completeTimer = setTimeout(() => {
      setIsPlaying(false);
      isPlayingRef.current = false;
      setActiveEventIndex(null);
    }, totalDuration + 1000);
    ttsTimerRef.current.push(completeTimer);
  };

  const stopReadAloud = () => {
    setIsPlaying(false);
    isPlayingRef.current = false;
    setActiveEventIndex(null);
    ttsTimerRef.current.forEach(timer => clearTimeout(timer));
    ttsTimerRef.current = [];
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  };

  // Compile timeline into a single WAV audio file
  const handleCompileAudio = async () => {
    if (!subtitleData || !file) return;
    setIsSynthesizing(true);
    setSynthesizeProgress(0);
    stopReadAloud();

    try {
      const events = subtitleData.events;
      const totalEvents = events.length;

      // Filter empty events
      const validEvents = events.filter(e => stripAssTags(e.text).trim().length > 0);
      if (validEvents.length === 0) {
        throw new Error('No synthesizable dialogue text found.');
      }

      // Initialize Web Audio Context
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const decodedBuffers: { start: number; end: number; buffer: AudioBuffer }[] = [];

      // Fetch and decode speech for each line
      for (let i = 0; i < validEvents.length; i++) {
        const event = validEvents[i];
        const text = stripAssTags(event.text);
        const startSec = assTimeToSeconds(event.start);
        const endSec = assTimeToSeconds(event.end);

        // Fetch MP3 from our proxy API
        const ttsUrl = `/api/tts?text=${encodeURIComponent(text)}&lang=${ttsLang}`;
        const response = await fetch(ttsUrl);
        if (!response.ok) {
          throw new Error(`Failed to synthesize line ${i + 1}: ${text}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

        decodedBuffers.push({
          start: startSec,
          end: endSec,
          buffer: audioBuffer
        });

        setSynthesizeProgress(Math.round(((i + 1) / validEvents.length) * 80)); // scale progress to 80%
      }

      // Find total duration for offline rendering (last audio block ending)
      const lastBuffer = decodedBuffers[decodedBuffers.length - 1];
      const totalDuration = lastBuffer.start + lastBuffer.buffer.duration + 2; // add small safety buffer

      // Create Offline Audio Context (44.1kHz Stereo PCM)
      const offlineCtx = new OfflineAudioContext(2, 44100 * totalDuration, 44100);

      // Schedule each buffer onto the timeline
      decodedBuffers.forEach(({ start, buffer }) => {
        const source = offlineCtx.createBufferSource();
        source.buffer = buffer;
        source.connect(offlineCtx.destination);
        source.start(start);
      });

      setSynthesizeProgress(90);

      // Render audio offline
      const renderedBuffer = await offlineCtx.startRendering();
      
      setSynthesizeProgress(95);

      // Convert buffer to WAV blob
      const wavBlob = bufferToWav(renderedBuffer);

      setSynthesizeProgress(100);

      // Trigger browser file download
      const url = URL.createObjectURL(wavBlob);
      const link = document.createElement('a');
      const baseName = file.name.substring(0, file.name.lastIndexOf('.'));
      link.href = url;
      link.download = `${baseName}_audio.wav`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      audioCtx.close();
    } catch (err: any) {
      setError(`Audio compilation failed: ${err.message || err}`);
    } finally {
      setIsSynthesizing(false);
    }
  };

  const resetApp = () => {
    stopReadAloud();
    setFile(null);
    setSubtitleData(null);
    setError(null);
  };

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
          <p className="logo-sub">Online 3D Subtitle & TTS Synthesizer</p>
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
              Key Features
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-standard)', padding: '15px', borderRadius: '12px' }}>
                <h5 style={{ fontSize: '0.9rem', color: 'hsl(var(--accent-cyan))', marginBottom: '5px' }}>3D Subtitle Converter</h5>
                <p style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))' }}>Convert 2D subtitles into Side-by-Side (SBS) or Top-Bottom (TB) 3D formats instantly.</p>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-standard)', padding: '15px', borderRadius: '12px' }}>
                <h5 style={{ fontSize: '0.9rem', color: 'hsl(var(--accent-purple))', marginBottom: '5px' }}>Subtitle-to-Speech (TTS)</h5>
                <p style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))' }}>Read subtitles aloud with multi-language synced voices, and export the timeline mix as a WAV track.</p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Workspace Screen */
        <div className="app-grid">
          {/* Settings Sidebar */}
          <aside className="glass-panel" style={{ padding: '25px', alignSelf: 'start' }}>
            {/* Tabs Selector */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '1px solid var(--border-standard)', paddingBottom: '15px' }}>
              <button 
                onClick={() => setActiveTab('visual')} 
                className={`mode-btn ${activeTab === 'visual' ? 'active' : ''}`}
                style={{ flex: 1 }}
              >
                3D Settings
              </button>
              <button 
                onClick={() => setActiveTab('tts')} 
                className={`mode-btn ${activeTab === 'tts' ? 'active' : ''}`}
                style={{ flex: 1 }}
              >
                TTS Audio
              </button>
            </div>

            {activeTab === 'visual' ? (
              /* Visual Options Form */
              <div>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.2rem', color: '#fff', marginBottom: '20px' }}>
                  <Settings size={18} style={{ color: 'hsl(var(--accent-cyan))' }} />
                  3D Formatting
                </h3>

                {/* 3D mode selection */}
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
              </div>
            ) : (
              /* TTS Audio Options Form */
              <div>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.2rem', color: '#fff', marginBottom: '20px' }}>
                  <Volume2 size={18} style={{ color: 'hsl(var(--accent-purple))' }} />
                  Voice Synthesizer
                </h3>

                <div style={{ marginBottom: '20px' }}>
                  <label className="input-label">Voice Language</label>
                  <select 
                    className="select-input"
                    value={ttsLang}
                    onChange={(e) => setTtsLang(e.target.value)}
                  >
                    {SUPPORTED_LANGUAGES.map((lang) => (
                      <option key={lang.code} value={lang.code}>
                        {lang.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ marginBottom: '30px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <label className="input-label" style={{ marginBottom: 0 }}>Reading Speed</label>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'hsl(var(--accent-cyan))' }}>{ttsSpeed}x</span>
                  </div>
                  <input 
                    type="range" 
                    min="0.5" 
                    max="2" 
                    step="0.1" 
                    className="text-input"
                    style={{ padding: 0, height: '6px', background: 'rgba(255,255,255,0.1)' }}
                    value={ttsSpeed}
                    onChange={(e) => setTtsSpeed(parseFloat(e.target.value))}
                  />
                </div>

                {/* Real-time Listen Player */}
                <div style={{ borderTop: '1px solid var(--border-standard)', paddingTop: '20px', marginBottom: '25px' }}>
                  <label className="input-label">Real-time Read Aloud</label>
                  <div style={{ display: 'grid', gridTemplateColumns: isPlaying ? '1fr 1fr' : '1fr', gap: '10px' }}>
                    {!isPlaying ? (
                      <button onClick={startReadAloud} className="action-btn" style={{ background: 'linear-gradient(135deg, hsl(var(--accent-blue)), hsl(var(--accent-purple)))', boxShadow: 'none' }}>
                        <Play size={16} />
                        Listen in Browser
                      </button>
                    ) : (
                      <>
                        <button onClick={startReadAloud} className="action-btn" style={{ background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid var(--border-standard)', boxShadow: 'none' }}>
                          <RefreshCw size={14} />
                          Restart
                        </button>
                        <button onClick={stopReadAloud} className="action-btn" style={{ background: 'linear-gradient(135deg, #ef4444, #b91c1c)', boxShadow: '0 4px 15px rgba(239,68,68,0.2)' }}>
                          <Square size={14} />
                          Stop
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Offline Compile Action */}
                <div style={{ borderTop: '1px solid var(--border-standard)', paddingTop: '20px' }}>
                  <label className="input-label">Export Audio Track</label>
                  <button 
                    onClick={handleCompileAudio} 
                    className="action-btn" 
                    disabled={isSynthesizing}
                    style={{ background: 'linear-gradient(135deg, hsl(var(--accent-cyan)), hsl(var(--accent-purple)))', boxShadow: '0 4px 20px rgba(157, 38, 255, 0.25)' }}
                  >
                    {isSynthesizing ? (
                      <>
                        <Loader2 size={18} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
                        <span>Synthesizing ({synthesizeProgress}%)</span>
                      </>
                    ) : (
                      <>
                        <Music size={18} />
                        <span>Compile & Download WAV</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
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
                      paddingBottom: `${marginV * 0.15}px`,
                      paddingLeft: `${marginL * 0.1}px`,
                      paddingRight: `${marginR * 0.1}px`,
                    }}
                  >
                    {activeEventIndex !== null && subtitleData ? (
                      <span style={{ borderBottom: '2px solid hsl(var(--accent-cyan))', paddingBottom: '2px' }}>
                        {stripAssTags(subtitleData.events[activeEventIndex].text)}
                      </span>
                    ) : (
                      <>
                        3D Subtitle Preview<br />
                        [Left/Top Eye Frame]
                      </>
                    )}
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
                      {activeEventIndex !== null && subtitleData ? (
                        <span style={{ borderBottom: '2px solid hsl(var(--accent-cyan))', paddingBottom: '2px' }}>
                          {stripAssTags(subtitleData.events[activeEventIndex].text)}
                        </span>
                      ) : (
                        <>
                          3D Subtitle Preview<br />
                          [Right/Bottom Eye Frame]
                        </>
                      )}
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

      {/* Keyframe animation for spinner */}
      <style jsx global>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        .animate-spin {
          display: inline-block;
        }
      `}</style>

      {/* Footer */}
      <footer className="footer-text">
        <p>Sub3dtool Web &bull; Powered by Antigravity AI Engine &bull; GPL v3 Licensed</p>
      </footer>
    </div>
  );
}
