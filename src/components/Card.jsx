import React from 'react';

const suitSymbols = {
  '♠': '♠',
  '♥': '♥',
  '♦': '♦',
  '♣': '♣',
};

export default function Card({ rank, suit, size = 'large' }) {
  // size: 'large' (default), 'small'
  const color = suit === '♥' || suit === '♦' ? '#d00' : '#222';
  const dims = size === 'small' ? { w: 48, h: 72, f: 15, c: 10, s: 28 } : { w: 80, h: 120, f: 22, c: 18, s: 48 };
  return (
    <span style={{
      display: 'inline-block',
      width: dims.w,
      height: dims.h,
      margin: size === 'small' ? 2 : 4,
      border: '2.5px solid #888',
      borderRadius: size === 'small' ? 8 : 12,
      background: 'linear-gradient(135deg, #fff 80%, #f3f3f3 100%)',
      color,
      fontWeight: 'bold',
      fontSize: dims.f,
      boxShadow: '2px 4px 16px #0002',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Top left rank/suit */}
      <span style={{
        position: 'absolute',
        top: 8,
        left: 10,
        fontSize: dims.f,
        fontWeight: 700,
        color,
        fontFamily: 'serif',
        lineHeight: 1,
      }}>{rank}<br /><span style={{ fontSize: dims.c }}>{suitSymbols[suit]}</span></span>
      {/* Center suit symbol */}
      <span style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        fontSize: dims.s,
        opacity: 0.18,
      }}>{suitSymbols[suit]}</span>
      {/* Bottom right rank/suit */}
      <span style={{
        position: 'absolute',
        bottom: 8,
        right: 10,
        fontSize: dims.f,
        fontWeight: 700,
        color,
        fontFamily: 'serif',
        lineHeight: 1,
        transform: 'rotate(180deg)',
      }}>{rank}<br /><span style={{ fontSize: dims.c }}>{suitSymbols[suit]}</span></span>
    </span>
  );
}
