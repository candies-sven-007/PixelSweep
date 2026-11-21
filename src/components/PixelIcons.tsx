import React from "react";

interface IconProps {
  size?: number;
  className?: string;
}

export const PixelBroomIcon: React.FC<IconProps> = ({ size = 18, className }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" shapeRendering="crispEdges" className={className}>
    <rect x="11" y="2" width="2" height="2" fill="#b97a4b" />
    <rect x="10" y="3" width="2" height="2" fill="#d39662" />
    <rect x="9" y="4" width="2" height="2" fill="#b97a4b" />
    <rect x="8" y="5" width="2" height="2" fill="#d39662" />
    <rect x="7" y="6" width="2" height="2" fill="#b97a4b" />
    <rect x="6" y="7" width="3" height="2" fill="#e05a52" />
    <rect x="4" y="8" width="4" height="2" fill="#f3c552" />
    <rect x="3" y="9" width="5" height="2" fill="#ffe28a" />
    <rect x="2" y="10" width="5" height="2" fill="#e3aa38" />
    <rect x="2" y="12" width="4" height="2" fill="#c98e26" />
    <rect x="12" y="9" width="1" height="1" fill="#fff7cc" />
    <rect x="11" y="10" width="3" height="1" fill="#fff7cc" />
    <rect x="12" y="11" width="1" height="1" fill="#fff7cc" />
  </svg>
);

export const PixelMagnifierIcon: React.FC<IconProps> = ({ size = 18, className }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" shapeRendering="crispEdges" className={className}>
    <rect x="4" y="2" width="5" height="1" fill="#5e4b3c" />
    <rect x="3" y="3" width="1" height="5" fill="#5e4b3c" />
    <rect x="9" y="3" width="1" height="5" fill="#5e4b3c" />
    <rect x="4" y="8" width="5" height="1" fill="#5e4b3c" />
    <rect x="4" y="3" width="5" height="5" fill="#9de8ff" />
    <rect x="5" y="4" width="2" height="1" fill="#ffffff" />
    <rect x="5" y="5" width="1" height="1" fill="#ffffff" />
    <rect x="9" y="8" width="2" height="2" fill="#b97a4b" />
    <rect x="10" y="9" width="2" height="2" fill="#8f5832" />
    <rect x="11" y="10" width="2" height="2" fill="#b97a4b" />
    <rect x="12" y="11" width="2" height="2" fill="#784625" />
  </svg>
);

export const PixelTrashIcon: React.FC<IconProps> = ({ size = 18, className }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" shapeRendering="crispEdges" className={className}>
    <rect x="6" y="2" width="4" height="1" fill="#7c8ea6" />
    <rect x="3" y="3" width="10" height="2" fill="#9fb2c9" />
    <rect x="4" y="5" width="8" height="8" fill="#cbd7e6" />
    <rect x="4" y="5" width="1" height="8" fill="#7c8ea6" />
    <rect x="11" y="5" width="1" height="8" fill="#7c8ea6" />
    <rect x="4" y="13" width="8" height="1" fill="#63748a" />
    <rect x="6" y="7" width="1" height="4" fill="#63748a" />
    <rect x="9" y="7" width="1" height="4" fill="#63748a" />
  </svg>
);

export const PixelShieldAlertIcon: React.FC<IconProps> = ({ size = 18, className }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" shapeRendering="crispEdges" className={className}>
    <rect x="4" y="2" width="8" height="2" fill="#f59e0b" />
    <rect x="3" y="4" width="10" height="5" fill="#fbbf24" />
    <rect x="4" y="9" width="8" height="2" fill="#f59e0b" />
    <rect x="5" y="11" width="6" height="2" fill="#d97706" />
    <rect x="7" y="13" width="2" height="1" fill="#b45309" />
    <rect x="7" y="4" width="2" height="4" fill="#451a03" />
    <rect x="7" y="9" width="2" height="2" fill="#451a03" />
  </svg>
);

export const PixelMusicIcon: React.FC<IconProps> = ({ size = 18, className }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" shapeRendering="crispEdges" className={className}>
    <rect x="6" y="3" width="7" height="2" fill="#38bdf8" />
    <rect x="6" y="5" width="2" height="6" fill="#38bdf8" />
    <rect x="11" y="5" width="2" height="5" fill="#7dd3fc" />
    <rect x="4" y="10" width="4" height="3" fill="#0ea5e9" />
    <rect x="9" y="9" width="4" height="3" fill="#38bdf8" />
  </svg>
);

export const PixelFolderIcon: React.FC<IconProps> = ({ size = 18, className }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" shapeRendering="crispEdges" className={className}>
    <rect x="2" y="3" width="5" height="2" fill="#e6a23c" />
    <rect x="2" y="5" width="12" height="8" fill="#f5c35e" />
    <rect x="2" y="5" width="12" height="1" fill="#ffe29c" />
    <rect x="2" y="12" width="12" height="1" fill="#c98524" />
  </svg>
);
