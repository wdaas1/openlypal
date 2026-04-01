import React from 'react';
import Svg, { Circle, Path, Defs, LinearGradient, Stop } from 'react-native-svg';

interface LogoProps {
  size?: number;
  showBackground?: boolean;
}

export function Logo({ size = 80, showBackground = true }: LogoProps) {
  const cx = 50, cy = 50, r = 30;
  // Arc with small opening at top (gap from 258° to 282°)
  // 270° is straight up; opening is ±12° around it
  const startDeg = 282;
  const endDeg = 258;
  const toRad = (d: number) => d * Math.PI / 180;
  const sx = cx + r * Math.cos(toRad(startDeg));
  const sy = cy + r * Math.sin(toRad(startDeg));
  const ex = cx + r * Math.cos(toRad(endDeg));
  const ey = cy + r * Math.sin(toRad(endDeg));
  // Dot position (top of circle, center of gap)
  const dotX = cx;
  const dotY = cy - r;

  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <LinearGradient id="bgGrad" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#001935" />
          <Stop offset="1" stopColor="#0a2d50" />
        </LinearGradient>
      </Defs>
      {showBackground ? <Circle cx="50" cy="50" r="50" fill="url(#bgGrad)" /> : null}
      {/* Main O arc with gap at top */}
      <Path
        d={`M ${sx.toFixed(2)} ${sy.toFixed(2)} A ${r} ${r} 0 1 1 ${ex.toFixed(2)} ${ey.toFixed(2)}`}
        stroke="#00CF35"
        strokeWidth="8.5"
        fill="none"
        strokeLinecap="round"
      />
      {/* Green dot in the opening */}
      <Circle cx={dotX} cy={dotY} r="5" fill="#00CF35" />
      {/* Subtle inner glow */}
      <Circle cx="50" cy="50" r="13" fill="#00CF35" fillOpacity="0.06" />
    </Svg>
  );
}
