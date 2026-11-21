import React, { useEffect, useRef, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { MusicTrack } from "../types";
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
  const [currentIdx, setCurrentIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.75);
  const [showPlaylist, setShowPlaylist] = useState(false);

  const currentTrack = tracks[currentIdx] ?? null;

  useEffect(() => {
    onPlayStateChange(isPlaying);
  }, [isPlaying, onPlayStateChange]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  useEffect(() => {
    if (!currentTrack || !audioRef.current) return;
    const src = convertFileSrc(currentTrack.path);
    if (audioRef.current.src !== src) {
      audioRef.current.src = src;
      if (isPlaying) {
        audioRef.current.play().catch(() => setIsPlaying(false));
      }
    }
  }, [currentTrack, isPlaying]);

  const togglePlay = () => {
    if (!audioRef.current || !currentTrack) return;
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

  const playIndex = (idx: number) => {
    if (tracks.length === 0) return;
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
    if (tracks.length === 0) return;
    if (shuffle && tracks.length > 1) {
      const next = Math.floor(Math.random() * tracks.length);
      playIndex(next);
    } else {
      playIndex(currentIdx + 1);
    }
  };

  const handlePrev = () => {
    if (tracks.length === 0) return;
    playIndex(currentIdx - 1);
  };

  const fmtTime = (sec: number) => {
    if (!Number.isFinite(sec) || sec < 0) return "0:00";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const progressPct = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
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
              <strong>本地音乐库 ({tracks.length} 首)</strong>
              <div className="muted-text small-path" title={musicDir || ""}>
                {musicDir || "未选择本地音乐文件夹"}
              </div>
            </div>
            <button className="btn-glass btn-sm" onClick={onPickMusicFolder}>
              <FolderVectorIcon size={13} /> 更换目录
            </button>
          </div>
          <div className="playlist-scroll">
            {tracks.length === 0 ? (
              <div className="empty-playlist">
                当前音乐目录暂无支持的音频文件（支持 MP3 / FLAC / WAV / M4A / OGG）
              </div>
            ) : (
              tracks.map((t, i) => (
                <button
                  key={t.path}
                  className={`playlist-item ${i === currentIdx ? "playing" : ""}`}
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
            <div className="music-title" title={currentTrack?.title || "点击右侧选择本地音乐文件夹"}>
              {currentTrack ? currentTrack.title : "暂无本地音乐 · 点击加载"}
            </div>
            <div className="music-sub" title={musicDir || ""}>
              {currentTrack
                ? `${currentTrack.folder} · ${currentTrack.ext}`
                : musicDir || "自动读取系统音乐文件夹"}
            </div>
          </div>
        </div>

        <div className="music-center">
          <div className="music-controls">
            <button
              className={`ctrl-icon-btn ${shuffle ? "ctrl-active" : ""}`}
              onClick={() => setShuffle((s) => !s)}
              title="随机播放"
            >
              <ShuffleIcon size={14} />
            </button>
            <button
              className="ctrl-icon-btn"
              onClick={handlePrev}
              disabled={tracks.length === 0}
              title="上一首"
            >
              <PrevTrackIcon size={15} />
            </button>
            <button
              className="ctrl-play-btn"
              onClick={tracks.length === 0 ? onPickMusicFolder : togglePlay}
              title={isPlaying ? "暂停" : "播放"}
            >
              {isPlaying ? <PauseIcon size={14} /> : <PlayIcon size={14} />}
            </button>
            <button
              className="ctrl-icon-btn"
              onClick={handleNext}
              disabled={tracks.length === 0}
              title="下一首"
            >
              <NextTrackIcon size={15} />
            </button>
            <button
              className={`ctrl-icon-btn ${showPlaylist ? "ctrl-active" : ""}`}
              onClick={() => setShowPlaylist((v) => !v)}
              title="展开曲目列表"
            >
              <PlaylistIcon size={15} />
            </button>
          </div>
          <div className="progress-row">
            <span className="time-label">{fmtTime(currentTime)}</span>
            <input
              type="range"
              min={0}
              max={duration || 1}
              step={0.5}
              value={currentTime}
              style={{ "--pct": `${progressPct}%` } as React.CSSProperties}
              onChange={(e) => {
                const v = Number(e.target.value);
                setCurrentTime(v);
                if (audioRef.current) audioRef.current.currentTime = v;
              }}
              className="apple-slider"
            />
            <span className="time-label">{fmtTime(duration)}</span>
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
          <button className="btn-glass btn-sm" onClick={onPickMusicFolder} title="切换本地音乐目录">
            <FolderVectorIcon size={13} /> 音乐库
          </button>
        </div>
      </div>
    </div>
  );
};
