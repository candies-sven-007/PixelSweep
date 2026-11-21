import React, { useEffect, useRef, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { MusicTrack } from "../types";
import { cozySynth } from "../utils/cozySynth";
import { PixelMusicIcon } from "./PixelIcons";
import {
  FolderVectorIcon,
  NextTrackIcon,
  PauseIcon,
  PlayIcon,
  PlaylistIcon,
  PrevTrackIcon,
  ShuffleIcon,
  VolumeIcon,
} from "./UiIcons";

interface MusicDockProps {
  musicDir: string | null;
  tracks: MusicTrack[];
  onPickMusicFolder: () => void;
  onPlayStateChange: (playing: boolean) => void;
}

export const MusicDock: React.FC<MusicDockProps> = ({
  musicDir,
  tracks,
  onPickMusicFolder,
  onPlayStateChange,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [sourceMode, setSourceMode] = useState<"local" | "cozy">("local");
  const [currentIdx, setCurrentIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.72);
  const [showPlaylist, setShowPlaylist] = useState(false);

  const currentTrack = tracks[currentIdx] ?? null;

  // Auto-select built-in cozy BGM mode when local music directory is empty
  useEffect(() => {
    if (tracks.length === 0) {
      setSourceMode("cozy");
    } else {
      setSourceMode("local");
    }
  }, [tracks.length]);

  useEffect(() => {
    onPlayStateChange(isPlaying);
  }, [isPlaying, onPlayStateChange]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
    cozySynth.setVolume(volume);
  }, [volume]);

  useEffect(() => {
    return () => {
      cozySynth.stop();
    };
  }, []);

  useEffect(() => {
    if (sourceMode !== "local" || !currentTrack || !audioRef.current) return;
    const src = convertFileSrc(currentTrack.path);
    if (audioRef.current.src !== src) {
      audioRef.current.src = src;
      if (isPlaying) {
        audioRef.current.play().catch(() => setIsPlaying(false));
      }
    }
  }, [sourceMode, currentTrack, isPlaying]);

  const togglePlay = () => {
    if (sourceMode === "cozy" || !currentTrack) {
      if (isPlaying) {
        cozySynth.stop();
        setIsPlaying(false);
      } else {
        audioRef.current?.pause();
        setSourceMode("cozy");
        cozySynth.setVolume(volume);
        cozySynth.start();
        setIsPlaying(true);
      }
      return;
    }

    if (!audioRef.current) return;
    cozySynth.stop();
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      if (!audioRef.current.src) {
        audioRef.current.src = convertFileSrc(currentTrack.path);
      }
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    }
  };

  const switchToCozy = () => {
    audioRef.current?.pause();
    setSourceMode("cozy");
    cozySynth.setVolume(volume);
    cozySynth.start();
    setIsPlaying(true);
  };

  const playIndex = (idx: number) => {
    if (tracks.length === 0) return;
    cozySynth.stop();
    setSourceMode("local");
    const safeIdx = (idx + tracks.length) % tracks.length;
    setCurrentIdx(safeIdx);
    setIsPlaying(true);
    setTimeout(() => {
      if (audioRef.current) {
        audioRef.current.src = convertFileSrc(tracks[safeIdx].path);
        audioRef.current.play().catch(() => setIsPlaying(false));
      }
    }, 30);
  };

  const handleNext = () => {
    if (sourceMode === "cozy" || tracks.length === 0) return;
    if (shuffle && tracks.length > 1) {
      playIndex(Math.floor(Math.random() * tracks.length));
    } else {
      playIndex(currentIdx + 1);
    }
  };

  const handlePrev = () => {
    if (sourceMode === "cozy" || tracks.length === 0) return;
    playIndex(currentIdx - 1);
  };

  const fmtTime = (sec: number) => {
    if (!Number.isFinite(sec) || sec < 0) return "0:00";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const isCozy = sourceMode === "cozy" || !currentTrack;
  const progressPct = isCozy
    ? isPlaying
      ? 100
      : 0
    : duration > 0
    ? Math.min(100, (currentTime / duration) * 100)
    : 0;
  const volPct = Math.round(volume * 100);

  return (
    <div className="music-dock-shell">
      <audio
        ref={audioRef}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
        onEnded={handleNext}
      />

      {showPlaylist && (
        <div className="playlist-popover">
          <div className="playlist-header">
            <div className="playlist-title-col">
              <strong>音乐播放源 ({tracks.length} 首本地曲目)</strong>
              <div className="muted-text small-path" title={musicDir || ""}>
                {musicDir || "未选择本地音乐文件夹"}
              </div>
            </div>
            <button className="btn-glass btn-sm" onClick={onPickMusicFolder}>
              <FolderVectorIcon size={13} /> 更换目录
            </button>
          </div>
          <div className="playlist-scroll">
            <button
              className={`playlist-item ${isCozy ? "playing" : ""}`}
              onClick={switchToCozy}
            >
              <span className="track-idx">♪</span>
              <span className="track-name">内置 · 星露谷田园八音盒（无限循环）</span>
              <span className="track-ext">SYNTH</span>
            </button>

            {tracks.length === 0 ? (
              <div className="empty-playlist">
                当前本地音乐目录为空，可直接播放上方内置八音盒，或点击「更换目录」加载本地 MP3 / FLAC / WAV。
              </div>
            ) : (
              tracks.map((t, i) => (
                <button
                  key={t.path}
                  className={`playlist-item ${!isCozy && i === currentIdx ? "playing" : ""}`}
                  onClick={() => playIndex(i)}
                >
                  <span className="track-idx">{String(i + 1).padStart(2, "0")}</span>
                  <span className="track-name">{t.title}</span>
                  <span className="track-ext">{t.ext}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      <div className="music-dock">
        <div className="music-left">
          <div className={`vinyl-badge ${isPlaying ? "spinning" : ""}`}>
            <PixelMusicIcon size={18} />
          </div>
          <div className="music-meta">
            <div className="music-title">
              {isCozy || !currentTrack ? "田园八音盒 · 休闲伴奏" : currentTrack.title}
            </div>
            <div className="music-sub" title={musicDir || ""}>
              {isCozy
                ? tracks.length === 0
                  ? "本地音乐库为空 · 点播放即可享受伴奏"
                  : "内置零占用合成器 · 可随时切回本地歌单"
                : `${currentTrack?.folder ?? "Music"} · ${currentTrack?.ext ?? ""}`}
            </div>
          </div>
        </div>

        <div className="music-center">
          <div className="music-controls">
            <button
              className={`ctrl-icon-btn ${shuffle ? "ctrl-active" : ""}`}
              onClick={() => setShuffle((s) => !s)}
              disabled={isCozy}
              title="随机播放"
            >
              <ShuffleIcon size={14} />
            </button>
            <button
              className="ctrl-icon-btn"
              onClick={handlePrev}
              disabled={isCozy || tracks.length === 0}
              title="上一首"
            >
              <PrevTrackIcon size={15} />
            </button>
            <button
              className="ctrl-play-btn"
              onClick={togglePlay}
              title={isPlaying ? "暂停" : "播放"}
            >
              {isPlaying ? <PauseIcon size={14} /> : <PlayIcon size={14} />}
            </button>
            <button
              className="ctrl-icon-btn"
              onClick={handleNext}
              disabled={isCozy || tracks.length === 0}
              title="下一首"
            >
              <NextTrackIcon size={15} />
            </button>
            <button
              className={`ctrl-icon-btn ${showPlaylist ? "ctrl-active" : ""}`}
              onClick={() => setShowPlaylist((v) => !v)}
              title="展开播放列表与音源切换"
            >
              <PlaylistIcon size={15} />
            </button>
          </div>
          <div className="progress-row">
            <span className="time-label">{isCozy ? "LIVE" : fmtTime(currentTime)}</span>
            <input
              type="range"
              min={0}
              max={isCozy ? 100 : duration || 1}
              step={0.5}
              disabled={isCozy}
              value={isCozy ? (isPlaying ? 100 : 0) : currentTime}
              style={{ "--pct": `${progressPct}%` } as React.CSSProperties}
              onChange={(e) => {
                const v = Number(e.target.value);
                setCurrentTime(v);
                if (audioRef.current) audioRef.current.currentTime = v;
              }}
              className="apple-slider"
            />
            <span className="time-label">{isCozy ? "∞" : fmtTime(duration)}</span>
          </div>
        </div>

        <div className="music-right">
          <div className={`mini-eq ${isPlaying ? "active" : ""}`} aria-hidden>
            <span />
            <span />
            <span />
            <span />
          </div>
          <div className="vol-group">
            <VolumeIcon size={14} />
            <input
              type="range"
              min={0}
              max={1}
              step={0.02}
              value={volume}
              style={{ "--pct": `${volPct}%` } as React.CSSProperties}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="apple-slider vol-slider"
              title="音量"
            />
          </div>
          <button className="btn-glass btn-sm" onClick={onPickMusicFolder} title="加载本地音乐文件夹">
            <FolderVectorIcon size={13} /> 音乐库
          </button>
        </div>
      </div>
    </div>
  );
};
