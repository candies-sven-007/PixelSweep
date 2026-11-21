import React from "react";

interface SvgProps {
  size?: number;
  className?: string;
}

export const SunIcon: React.FC<SvgProps> = ({ size = 14, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
  </svg>
);

export const MoonIcon: React.FC<SvgProps> = ({ size = 14, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

export const WinMinIcon: React.FC<SvgProps> = ({ size = 12 }) => (
  <svg width={size} height={size} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
    <path d="M2 6h8" />
  </svg>
);

export const WinMaxIcon: React.FC<SvgProps> = ({ size = 12 }) => (
  <svg width={size} height={size} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3">
    <rect x="2" y="2" width="8" height="8" rx="1.6" />
  </svg>
);

export const WinCloseIcon: React.FC<SvgProps> = ({ size = 12 }) => (
  <svg width={size} height={size} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <path d="M2.5 2.5l7 7M9.5 2.5l-7 7" />
  </svg>
);

export const ChevronIcon: React.FC<SvgProps> = ({ size = 16, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

export const SearchIcon: React.FC<SvgProps> = ({ size = 14, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-3.5-3.5" />
  </svg>
);

export const FolderVectorIcon: React.FC<SvgProps> = ({ size = 15, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M3 7a2 2 0 0 1 2-2h4.2l2 2.2H19a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
  </svg>
);

export const FileVectorIcon: React.FC<SvgProps> = ({ size = 15, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
  </svg>
);

export const ExternalLocateIcon: React.FC<SvgProps> = ({ size = 13, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);

export const PlayIcon: React.FC<SvgProps> = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M7.5 5.25a1 1 0 0 1 1.52-.85l10.5 6.75a1 1 0 0 1 0 1.7l-10.5 6.75a1 1 0 0 1-1.52-.85V5.25z" />
  </svg>
);

export const PauseIcon: React.FC<SvgProps> = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <rect x="6" y="4.5" width="4.2" height="15" rx="1.4" />
    <rect x="13.8" y="4.5" width="4.2" height="15" rx="1.4" />
  </svg>
);

export const PrevTrackIcon: React.FC<SvgProps> = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <rect x="4.5" y="5.5" width="2.2" height="13" rx="1" />
    <path d="M18.6 6.2a1 1 0 0 1 0 1.65L12.1 12l6.5 4.15a1 1 0 0 1-1.08 1.68l-8.2-5.23a.9.9 0 0 1 0-1.52l8.2-5.23a1 1 0 0 1 1.08.35z" />
    <path d="M19 6.3v11.4a1 1 0 0 1-1.54.84l-8.4-5.7a1 1 0 0 1 0-1.68l8.4-5.7A1 1 0 0 1 19 6.3z" />
  </svg>
);

export const NextTrackIcon: React.FC<SvgProps> = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <rect x="17.3" y="5.5" width="2.2" height="13" rx="1" />
    <path d="M5 6.3v11.4a1 1 0 0 0 1.54.84l8.4-5.7a1 1 0 0 0 0-1.68l-8.4-5.7A1 1 0 0 0 5 6.3z" />
  </svg>
);

export const ShuffleIcon: React.FC<SvgProps> = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="16 3 21 3 21 8" />
    <line x1="4" y1="20" x2="21" y2="3" />
    <polyline points="21 16 21 21 16 21" />
    <line x1="15" y1="15" x2="21" y2="21" />
    <line x1="4" y1="4" x2="9" y2="9" />
  </svg>
);

export const PlaylistIcon: React.FC<SvgProps> = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="4" y1="6" x2="16" y2="6" />
    <line x1="4" y1="12" x2="14" y2="12" />
    <line x1="4" y1="18" x2="11" y2="18" />
    <circle cx="17.5" cy="17.5" r="2.5" />
    <path d="M20 17.5V10l-3 1" />
  </svg>
);

export const VolumeIcon: React.FC<SvgProps> = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
  </svg>
);

export const HardDriveIcon: React.FC<SvgProps> = ({ size = 14, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <line x1="22" y1="12" x2="2" y2="12" />
    <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    <circle cx="6" cy="16" r="1" fill="currentColor" />
    <circle cx="10" cy="16" r="1" fill="currentColor" />
  </svg>
);

export const RefreshIcon: React.FC<SvgProps> = ({ size = 13, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M21 12a9 9 0 1 1-2.64-6.36" />
    <polyline points="21 3 21 9 15 9" />
  </svg>
);

export const CheckIcon: React.FC<SvgProps> = ({ size = 11 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 8.5 6.5 12 13 4.5" />
  </svg>
);

export const MinusIcon: React.FC<SvgProps> = ({ size = 11 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
    <line x1="3.5" y1="8" x2="12.5" y2="8" />
  </svg>
);
