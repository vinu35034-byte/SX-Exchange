import React, { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import { useTheme } from '../../contexts/ThemeContext';

// ── Layout constants (SVG viewBox units) ──────────────────────────────────────
const VW = 600;
const VH = 720; // ~500px on a 390px-wide phone (390 × 720/600 ≈ 468px)
const LEFT_PAD   = 10;
const RIGHT_PAD  = 80;   // reserved for Y-axis labels
const TOP_PAD    = 24;
const XAXIS_H    = 28;
const VOL_H      = 50;
const VOL_GAP    = 8;

const CL = LEFT_PAD;                                   // chart left x
const CR = VW - RIGHT_PAD;                             // chart right x
const CW = CR - CL;                                    // chart width

const PRICE_TOP    = TOP_PAD;
const PRICE_BOTTOM = VH - XAXIS_H - VOL_H - VOL_GAP;
const PRICE_H      = PRICE_BOTTOM - PRICE_TOP;

const VOL_TOP    = PRICE_BOTTOM + VOL_GAP;
const VOL_BOTTOM = VH - XAXIS_H;

const Y_LABEL_X = CR + 5;
// ──────────────────────────────────────────────────────────────────────────────

const CandlestickChart = ({ data, pair, selectedTimeframe = '1m', onTimeframeChange, currentPrice, isConnected, height = '500px' }) => {
  const chartContainerRef = useRef();
  const [chartData, setChartData]             = useState([]);
  const [isAutoFollowing, setIsAutoFollowing] = useState(true);
  const [viewportStart, setViewportStart]     = useState(0);
  const [viewportEnd, setViewportEnd]         = useState(30);
  const [isDragging, setIsDragging]           = useState(false);
  const [dragStart, setDragStart]             = useState(null);
  const [hoverIndex, setHoverIndex]           = useState(null);
  const [hoverSvgX, setHoverSvgX]             = useState(null);
  const [hoverSvgY, setHoverSvgY]             = useState(null);

  const { isDarkMode } = useTheme();

  // ── Formatters ───────────────────────────────────────────────────────────────
  const formatPrice = (price) => {
    if (!price || isNaN(price)) return '0';
    if (price >= 1_000_000) return `${(price / 1_000_000).toFixed(2)}M`;
    if (price >= 1_000)     return price.toFixed(0);
    if (price >= 1)         return price.toFixed(2);
    return price.toFixed(6);
  };

  const formatTime = (time) => {
    if (!time) return '';
    const d = new Date(time * 1000);
    if (['1m','5m','15m'].includes(selectedTimeframe)) {
      return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    }
    if (['1h','4h'].includes(selectedTimeframe)) {
      return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:00`;
    }
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatVol = (v) => {
    if (!v || isNaN(v)) return '0';
    if (v >= 1_000_000) return `${(v/1_000_000).toFixed(1)}M`;
    if (v >= 1_000)     return `${(v/1_000).toFixed(1)}K`;
    return v.toFixed(0);
  };

  // ── Data processing ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (data && data.length > 0) {
      try {
        const processed = data
          .filter(item => {
            if (!item || typeof item !== 'object') return false;
            for (const f of ['time','open','high','low','close']) {
              const v = item[f];
              if (v === null || v === undefined || isNaN(v) || !isFinite(v)) return false;
            }
            if (item.high < item.low) return false;
            if (item.open < 0 || item.close < 0 || item.high < 0 || item.low < 0) return false;
            return true;
          })
          .map((item, index) => {
            const time  = typeof item.time === 'string' ? Math.floor(new Date(item.time).getTime()/1000)
                        : typeof item.timestamp === 'number' ? Math.floor(item.timestamp/1000)
                        : item.time;
            const open   = Number(item.open)   || 0;
            const high   = Number(item.high)   || 0;
            const low    = Number(item.low)    || 0;
            const close  = Number(item.close)  || 0;
            const volume = Number(item.volume) || 0;
            if (!Number.isFinite(time) || !Number.isFinite(open) || !Number.isFinite(close)) return null;
            return { time, open, high, low, close, volume, index };
          })
          .filter(Boolean)
          .sort((a,b) => a.time - b.time);

        if (processed.length === 0) { setChartData([]); return; }

        if (currentPrice && processed.length > 0 && isConnected) {
          const last = processed[processed.length - 1];
          if (Math.floor(Date.now()/1000) - last.time < 300) {
            last.close = currentPrice;
            last.high  = Math.max(last.high, currentPrice);
            last.low   = Math.min(last.low,  currentPrice);
          }
        }

        setChartData(processed);

        const prevLen = chartData.length;
        const changed = Math.abs(processed.length - prevLen) > 100;
        if (isAutoFollowing || changed) {
          if (processed.length > 30) {
            setViewportEnd(processed.length + 3);
            setViewportStart(Math.max(0, processed.length - 27));
          } else {
            setViewportStart(0);
            setViewportEnd(Math.min(processed.length + 5, 30));
          }
        } else {
          const maxEnd = processed.length + 500;
          if (viewportEnd > maxEnd) {
            setViewportEnd(maxEnd);
            setViewportStart(maxEnd - (viewportEnd - viewportStart));
          }
        }
      } catch (e) {
        setChartData([]);
      }
    } else {
      setChartData([]);
    }
  }, [data, pair, selectedTimeframe, currentPrice, isConnected, isAutoFollowing]);

  // ── Wheel (zoom / pan) ───────────────────────────────────────────────────────
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const extraSpace = 500;
    const maxEnd  =  chartData.length + extraSpace;
    const minStart = -extraSpace;

    if (e.ctrlKey || e.metaKey) {
      const factor = e.deltaY > 0 ? 1.1 : 0.9;
      const range  = viewportEnd - viewportStart;
      const newRange = Math.max(5, Math.min(maxEnd * 2, range * factor));
      const center   = (viewportStart + viewportEnd) / 2;
      let ns = center - newRange / 2;
      let ne = center + newRange / 2;
      if (ne > maxEnd)   { ne = maxEnd;  ns = ne - newRange; }
      if (ns < minStart) { ns = minStart; ne = ns + newRange; }
      setViewportStart(ns); setViewportEnd(ne);
    } else {
      const pan = e.deltaY > 0 ? 3 : -3;
      let ns = viewportStart + pan;
      let ne = viewportEnd   + pan;
      if (ne > maxEnd)   { ne = maxEnd;  ns = ne - (viewportEnd - viewportStart); }
      if (ns < minStart) { ns = minStart; ne = ns + (viewportEnd - viewportStart); }
      setViewportStart(ns); setViewportEnd(ne);
      const isLive = ne >= chartData.length - 3 && ne <= chartData.length + 10;
      setIsAutoFollowing(isLive);
    }
  }, [chartData, viewportStart, viewportEnd]);

  useEffect(() => {
    const el = chartContainerRef.current;
    if (!el) return;
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  // ── Drag (pan) ───────────────────────────────────────────────────────────────
  const handleMouseDown = (e) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX, viewportStart, viewportEnd });
  };
  const handleMouseMove = (e) => {
    if (!isDragging || !dragStart) return;
    const extraSpace = 500;
    const maxEnd   = chartData.length + extraSpace;
    const minStart = -extraSpace;
    const pan = (e.clientX - dragStart.x) * 0.05;
    let ns = dragStart.viewportStart - pan;
    let ne = dragStart.viewportEnd   - pan;
    const size = dragStart.viewportEnd - dragStart.viewportStart;
    if (ne > maxEnd)   { ne = maxEnd;  ns = ne - size; }
    if (ns < minStart) { ns = minStart; ne = ns + size; }
    if (ne - ns < 10)  { ne = ns + 10; }
    setViewportStart(ns); setViewportEnd(ne);
    const isLive = ne >= chartData.length - 3 && ne <= chartData.length + 10;
    setIsAutoFollowing(isLive);
  };
  const handleMouseUp = () => { setIsDragging(false); setDragStart(null); };

  // ── SVG-level crosshair mouse tracking ───────────────────────────────────────
  const handleSvgMouseMove = useCallback((e, visibleData, dataStartOffset, viewportSize) => {
    if (isDragging) { setHoverIndex(null); return; }
    const svg  = e.currentTarget.closest('svg');
    if (!svg)  return;
    const rect = svg.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left)  / rect.width)  * VW;
    const svgY = ((e.clientY - rect.top)   / rect.height) * VH;
    const frac   = (svgX - CL) / CW;
    const rawIdx = frac * viewportSize - dataStartOffset;
    const idx    = Math.max(0, Math.min(visibleData.length - 1, Math.round(rawIdx)));
    setHoverIndex(idx);
    setHoverSvgX(svgX);
    setHoverSvgY(svgY);
  }, [isDragging]);

  const clearHover = () => { setHoverIndex(null); setHoverSvgX(null); setHoverSvgY(null); };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div
      ref={chartContainerRef}
      className="w-full select-none"
      style={{
        ...(height === 'auto'
          ? { width: '100%', aspectRatio: `${VW}/${VH}` }
          : { height }),
        cursor: isDragging ? 'grabbing' : 'crosshair',
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => { handleMouseUp(); clearHover(); }}
    >
      <svg width="100%" height="100%" viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio={height === 'auto' ? 'xMidYMid meet' : 'none'} style={{ display: 'block' }}>
        <defs>
          <clipPath id="chartClip">
            <rect x={CL} y={PRICE_TOP} width={CW} height={PRICE_H} />
          </clipPath>
          <clipPath id="volClip">
            <rect x={CL} y={VOL_TOP} width={CW} height={VOL_H} />
          </clipPath>
        </defs>

        {chartData.length === 0 ? (
          <text x={VW/2} y={VH/2} fill="#555555" fontSize="18" textAnchor="middle">
            {data?.length > 0 ? 'Processing…' : 'Waiting for data…'}
          </text>
        ) : (() => {
          // ── viewport slice ──────────────────────────────────────────────────
          const actualStart = Math.floor(viewportStart);
          const actualEnd   = Math.ceil(viewportEnd);
          const viewportSize = viewportEnd - viewportStart;
          let visibleData = [];
          let dataStartOffset = 0;

          if (actualEnd <= 0 || actualStart >= chartData.length) {
            visibleData = [];
          } else if (actualStart < 0) {
            visibleData = chartData.slice(0, Math.min(chartData.length, actualEnd));
            dataStartOffset = -actualStart;
          } else if (actualEnd > chartData.length) {
            visibleData = chartData.slice(actualStart);
          } else {
            visibleData = chartData.slice(actualStart, actualEnd);
          }

          if (visibleData.length === 0) {
            return (
              <text x={VW/2} y={VH/2} fill="#555555" fontSize="18" textAnchor="middle">
                No data in this range
              </text>
            );
          }

          // ── price scaling ───────────────────────────────────────────────────
          const rawMax = Math.max(...visibleData.map(d => d.high));
          const rawMin = Math.min(...visibleData.map(d => d.low));
          const rawRange = rawMax - rawMin || rawMax * 0.01 || 1;
          const maxPrice = rawMax + rawRange * 0.10;
          const minPrice = rawMin - rawRange * 0.10;
          const priceRange = maxPrice - minPrice;

          const priceToY = (p) => PRICE_TOP + ((maxPrice - p) / priceRange) * PRICE_H;

          // ── volume scaling ──────────────────────────────────────────────────
          const maxVol = Math.max(...visibleData.map(d => d.volume), 1);
          const volToH = (v) => (v / maxVol) * VOL_H;

          // ── candle geometry ─────────────────────────────────────────────────
          const candleWidth = Math.max(5, (CW / Math.max(viewportSize, 1)) * 0.88);
          const indexToX = (adjIdx) => CL + (adjIdx / Math.max(viewportSize, 1)) * CW;

          // ── MA20 ────────────────────────────────────────────────────────────
          const ma20Points = [];
          for (let i = 0; i < visibleData.length; i++) {
            const globalIdx = actualStart + i;
            if (globalIdx < 19) continue;
            const slice = chartData.slice(globalIdx - 19, globalIdx + 1);
            const ma = slice.reduce((s, d) => s + d.close, 0) / 20;
            const adjIdx = i + dataStartOffset;
            const x = indexToX(adjIdx) + candleWidth / 2;
            const y = priceToY(ma);
            ma20Points.push(`${x},${y}`);
          }

          // ── EMA helper ──────────────────────────────────────────────────────
          const calcEMA = (period) => {
            const k = 2 / (period + 1);
            const result = new Array(chartData.length).fill(null);
            let ema = null;
            for (let i = 0; i < chartData.length; i++) {
              if (ema === null) {
                if (i < period - 1) continue;
                ema = chartData.slice(0, period).reduce((s, d) => s + d.close, 0) / period;
              } else {
                ema = chartData[i].close * k + ema * (1 - k);
              }
              result[i] = ema;
            }
            return result;
          };

          const ema9Full  = calcEMA(9);
          const ema21Full = calcEMA(21);

          const ema9Points  = [];
          const ema21Points = [];
          for (let i = 0; i < visibleData.length; i++) {
            const globalIdx = actualStart + i;
            const adjIdx = i + dataStartOffset;
            const x = indexToX(adjIdx) + candleWidth / 2;
            if (ema9Full[globalIdx] !== null) {
              ema9Points.push(`${x},${priceToY(ema9Full[globalIdx])}`);
            }
            if (ema21Full[globalIdx] !== null) {
              ema21Points.push(`${x},${priceToY(ema21Full[globalIdx])}`);
            }
          }

          // ── Bollinger Bands (20, 2σ) ────────────────────────────────────────
          const BB_PERIOD = 20;
          const BB_MULT   = 2;
          const bbUpper = [], bbMiddle = [], bbLower = [];
          for (let i = 0; i < visibleData.length; i++) {
            const globalIdx = actualStart + i;
            if (globalIdx < BB_PERIOD - 1) continue;
            const slice = chartData.slice(globalIdx - BB_PERIOD + 1, globalIdx + 1);
            const sma   = slice.reduce((s, d) => s + d.close, 0) / BB_PERIOD;
            const variance = slice.reduce((s, d) => s + (d.close - sma) ** 2, 0) / BB_PERIOD;
            const sd    = Math.sqrt(variance);
            const adjIdx = i + dataStartOffset;
            const x = indexToX(adjIdx) + candleWidth / 2;
            bbUpper.push(`${x},${priceToY(sma + BB_MULT * sd)}`);
            bbMiddle.push(`${x},${priceToY(sma)}`);
            bbLower.push(`${x},${priceToY(sma - BB_MULT * sd)}`);
          }

          // Bollinger band fill area (upper → lower reversed)
          const bbFillPoints = bbUpper.length > 1
            ? bbUpper.join(' ') + ' ' + [...bbLower].reverse().join(' ')
            : null;

          // ── live price for current-price line ───────────────────────────────
          const livePrice = (currentPrice && currentPrice > 0)
            ? currentPrice
            : visibleData[visibleData.length - 1].close;
          const livePriceY = priceToY(livePrice);
          const liveIsPositive = visibleData.length > 1
            ? livePrice >= visibleData[visibleData.length - 2].close
            : true;

          // ── hovered candle ──────────────────────────────────────────────────
          const hc = hoverIndex !== null ? visibleData[hoverIndex] : null;
          const hcAdjIdx = hoverIndex !== null ? hoverIndex + dataStartOffset : null;
          const hcCenterX = hcAdjIdx !== null ? indexToX(hcAdjIdx) + candleWidth / 2 : null;

          // tooltip position
          const tipW = 162, tipH = 130;
          const tipX = hoverSvgX != null
            ? (hoverSvgX > VW * 0.62 ? hoverSvgX - tipW - 10 : hoverSvgX + 12)
            : 0;
          const tipY = hoverSvgY != null
            ? Math.max(PRICE_TOP, Math.min(hoverSvgY - 20, PRICE_BOTTOM - tipH))
            : 0;

          // crosshair price label
          const priceAtHover = hoverSvgY != null
            ? maxPrice - ((hoverSvgY - PRICE_TOP) / PRICE_H) * priceRange
            : 0;

          return (
            <>
              {/* ── Grid lines ──────────────────────────────────────────────── */}
              {Array.from({ length: 7 }, (_, i) => {
                const y = PRICE_TOP + (i / 6) * PRICE_H;
                const price = maxPrice - (i / 6) * priceRange;
                return (
                  <g key={`hgrid-${i}`}>
                    <line x1={CL} y1={y} x2={CR} y2={y}
                          stroke="#E5E7EB" strokeWidth="0.6" strokeDasharray="4,4" />
                    <text x={Y_LABEL_X} y={y + 4} fill="#222222"
                          fontSize="11" textAnchor="start" fontFamily="monospace">
                      {formatPrice(price)}
                    </text>
                  </g>
                );
              })}
              {/* Vertical grid */}
              {Array.from({ length: 6 }, (_, i) => {
                const x = CL + (i / 5) * CW;
                return (
                  <line key={`vgrid-${i}`} x1={x} y1={PRICE_TOP} x2={x} y2={PRICE_BOTTOM}
                        stroke="#E5E7EB" strokeWidth="0.6" strokeDasharray="4,4" />
                );
              })}

              {/* ── Pair watermark ──────────────────────────────────────────── */}
              {pair && (
                <text
                  x={CL + CW / 2}
                  y={PRICE_TOP + PRICE_H / 2 + 10}
                  fill="#000000"
                  fillOpacity="0.04"
                  fontSize="64"
                  fontWeight="800"
                  textAnchor="middle"
                  fontFamily="system-ui, sans-serif"
                  style={{ userSelect: 'none', pointerEvents: 'none' }}
                >
                  {pair.replace('/', ' / ')}
                </text>
              )}

              {/* ── Volume bars ─────────────────────────────────────────────── */}
              <g clipPath="url(#volClip)">
                {/* Volume axis label */}
                <text x={Y_LABEL_X} y={VOL_TOP + 13} fill="#888888"
                      fontSize="10" textAnchor="start">Vol</text>
                {visibleData.map((candle, i) => {
                  const isBull = candle.close >= candle.open;
                  const adjIdx = i + dataStartOffset;
                  const x  = indexToX(adjIdx) + candleWidth * 0.05;
                  const h  = Math.max(1, volToH(candle.volume));
                  const y  = VOL_BOTTOM - h;
                  return (
                    <rect key={`vol-${i}`}
                          x={x} y={y}
                          width={candleWidth * 0.9} height={h}
                          fill={isBull ? '#bbf7d0' : '#fecaca'}
                    />
                  );
                })}
              </g>

              {/* ── Candlesticks ─────────────────────────────────────────────── */}
              <g clipPath="url(#chartClip)">
                {visibleData.map((candle, i) => {
                  const { open, high, low, close } = candle;
                  const isBull = close >= open;
                  const bodyColor = isBull ? '#22c55e' : '#ef4444';
                  const wickColor = isBull ? '#16a34a' : '#dc2626';
                  const adjIdx  = i + dataStartOffset;
                  const centerX = indexToX(adjIdx) + candleWidth / 2;
                  const bodyX   = indexToX(adjIdx) + candleWidth * 0.1;
                  const highY   = priceToY(high);
                  const lowY    = priceToY(low);
                  const openY   = priceToY(open);
                  const closeY  = priceToY(close);
                  const bodyTop = Math.min(openY, closeY);
                  const bodyH   = Math.max(1.5, Math.abs(openY - closeY));
                  return (
                    <g key={`c-${i}`}>
                      <line x1={centerX} y1={highY} x2={centerX} y2={lowY}
                            stroke={wickColor} strokeWidth="2" />
                      <rect x={bodyX} y={bodyTop}
                            width={candleWidth * 0.82} height={bodyH}
                            fill={bodyColor}
                            rx="1"
                      />
                    </g>
                  );
                })}
              </g>

              {/* ── Bollinger Bands fill ─────────────────────────────────────── */}
              {bbFillPoints && (
                <polygon
                  points={bbFillPoints}
                  fill="#3b82f6"
                  fillOpacity="0.06"
                  clipPath="url(#chartClip)"
                />
              )}
              {/* BB upper / middle / lower lines */}
              {bbUpper.length > 1 && (
                <polyline points={bbUpper.join(' ')} fill="none"
                  stroke="#3b82f6" strokeWidth="0.9" strokeDasharray="4,3"
                  strokeLinejoin="round" clipPath="url(#chartClip)" opacity="0.75" />
              )}
              {bbMiddle.length > 1 && (
                <polyline points={bbMiddle.join(' ')} fill="none"
                  stroke="#93c5fd" strokeWidth="0.8"
                  strokeLinejoin="round" clipPath="url(#chartClip)" opacity="0.65" />
              )}
              {bbLower.length > 1 && (
                <polyline points={bbLower.join(' ')} fill="none"
                  stroke="#3b82f6" strokeWidth="0.9" strokeDasharray="4,3"
                  strokeLinejoin="round" clipPath="url(#chartClip)" opacity="0.75" />
              )}

              {/* ── MA20 line ─────────────────────────────────────────────────── */}
              {ma20Points.length > 1 && (
                <polyline
                  points={ma20Points.join(' ')}
                  fill="none"
                  stroke="#f97316"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                  clipPath="url(#chartClip)"
                  opacity="0.85"
                />
              )}

              {/* ── EMA 9 + EMA 21 lines ─────────────────────────────────────── */}
              {ema9Points.length > 1 && (
                <polyline points={ema9Points.join(' ')} fill="none"
                  stroke="#8b5cf6" strokeWidth="1.2"
                  strokeLinejoin="round" clipPath="url(#chartClip)" opacity="0.85" />
              )}
              {ema21Points.length > 1 && (
                <polyline points={ema21Points.join(' ')} fill="none"
                  stroke="#ec4899" strokeWidth="1.2"
                  strokeLinejoin="round" clipPath="url(#chartClip)" opacity="0.85" />
              )}

              {/* ── Current price dashed line + badge ────────────────────────── */}
              {livePriceY >= PRICE_TOP && livePriceY <= PRICE_BOTTOM && (
                <>
                  <line x1={CL} y1={livePriceY} x2={CR} y2={livePriceY}
                        stroke={liveIsPositive ? '#16a34a' : '#dc2626'}
                        strokeWidth="0.8" strokeDasharray="5,3" />
                  <rect x={CR} y={livePriceY - 11}
                        width={RIGHT_PAD - 2} height={22} rx="3"
                        fill={liveIsPositive ? '#16a34a' : '#dc2626'} />
                  <text x={CR + 4} y={livePriceY + 4}
                        fill="white" fontSize="10" fontFamily="monospace" fontWeight="700">
                    {formatPrice(livePrice)}
                  </text>
                </>
              )}

              {/* ── X-axis time labels ────────────────────────────────────────── */}
              {Array.from({ length: 6 }, (_, i) => {
                const x = CL + (i / 5) * CW;
                const dataIdx = Math.floor(viewportStart + (i / 5) * viewportSize);
                let timeVal;
                if (dataIdx >= 0 && dataIdx < chartData.length) {
                  timeVal = chartData[dataIdx].time;
                } else if (chartData.length > 0) {
                  const last = chartData[chartData.length - 1];
                  const dur = { '1m':60,'5m':300,'15m':900,'1h':3600,'4h':14400,'1d':86400 }[selectedTimeframe] || 3600;
                  timeVal = last.time + (dataIdx - (chartData.length - 1)) * dur;
                } else {
                  timeVal = Date.now() / 1000;
                }
                return (
                  <g key={`xl-${i}`}>
                    <line x1={x} y1={VOL_BOTTOM} x2={x} y2={VOL_BOTTOM + 4}
                          stroke="#d1d5db" strokeWidth="1" />
                    <text x={x} y={VH - 4}
                          fill="#333333" fontSize="10" textAnchor="middle">
                      {formatTime(timeVal)}
                    </text>
                  </g>
                );
              })}

              {/* ── Legend chips ─────────────────────────────────────────────── */}
              {[
                { label: 'MA20', color: '#f97316', bg: '#fff7ed', border: '#fed7aa' },
                { label: 'EMA9', color: '#8b5cf6', bg: '#f5f3ff', border: '#ddd6fe' },
                { label: 'EMA21', color: '#ec4899', bg: '#fdf2f8', border: '#fbcfe8' },
                { label: 'BB',   color: '#3b82f6', bg: '#eff6ff', border: '#bfdbfe' },
              ].map(({ label, color, bg, border }, li) => {
                const chipW = label === 'EMA21' ? 54 : 48;
                const x0 = CL + 4 + li * (chipW + 4);
                return (
                  <g key={label}>
                    <rect x={x0} y={PRICE_TOP + 4} width={chipW} height={16} rx="3"
                          fill={bg} stroke={border} strokeWidth="0.8" />
                    <line x1={x0 + 4} y1={PRICE_TOP + 12} x2={x0 + 14} y2={PRICE_TOP + 12}
                          stroke={color} strokeWidth="1.5" />
                    <text x={x0 + 18} y={PRICE_TOP + 15}
                          fill={color} fontSize="11" fontWeight="600">{label}</text>
                  </g>
                );
              })}

              {/* ── Crosshair + OHLCV tooltip ─────────────────────────────────── */}
              {hc && hoverSvgX != null && (
                <>
                  {/* Vertical line */}
                  <line x1={hcCenterX} y1={PRICE_TOP} x2={hcCenterX} y2={VOL_BOTTOM}
                        stroke="#94a3b8" strokeWidth="0.8" strokeDasharray="4,3" />
                  {/* Horizontal line */}
                  <line x1={CL} y1={hoverSvgY} x2={CR} y2={hoverSvgY}
                        stroke="#94a3b8" strokeWidth="0.8" strokeDasharray="4,3" />
                  {/* Price badge on Y axis */}
                  {hoverSvgY >= PRICE_TOP && hoverSvgY <= PRICE_BOTTOM && (
                    <>
                      <rect x={CR} y={hoverSvgY - 11}
                            width={RIGHT_PAD - 2} height={22} rx="3" fill="#374151" />
                      <text x={CR + 4} y={hoverSvgY + 4}
                            fill="white" fontSize="10" fontFamily="monospace" fontWeight="700">
                        {formatPrice(priceAtHover)}
                      </text>
                    </>
                  )}
                  {/* Tooltip card */}
                  <g>
                    <rect x={tipX} y={tipY} width={tipW} height={tipH}
                          rx="6" fill="white"
                          stroke="#E5E7EB" strokeWidth="1"
                          style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.10))' }} />
                    {/* Header row */}
                    <rect x={tipX} y={tipY} width={tipW} height={22} rx="6" fill="#f9fafb" />
                    <rect x={tipX} y={tipY+8} width={tipW} height={14} fill="#f9fafb" />
                    <text x={tipX+8} y={tipY+15} fill="#111111" fontSize="11" fontWeight="700">
                      {formatTime(hc.time)}
                    </text>
                    <rect x={tipX + tipW - 28} y={tipY + 5} width={20} height={12} rx="3"
                          fill={hc.close >= hc.open ? '#dcfce7' : '#fee2e2'} />
                    <text x={tipX + tipW - 18} y={tipY + 14}
                          fill={hc.close >= hc.open ? '#16a34a' : '#dc2626'}
                          fontSize="10" fontWeight="700" textAnchor="middle">
                      {hc.close >= hc.open ? '▲' : '▼'}
                    </text>
                    {/* OHLCV rows */}
                    {[
                      { label: 'O', val: formatPrice(hc.open),   color: '#6b7280' },
                      { label: 'H', val: formatPrice(hc.high),   color: '#16a34a' },
                      { label: 'L', val: formatPrice(hc.low),    color: '#dc2626' },
                      { label: 'C', val: formatPrice(hc.close),  color: hc.close >= hc.open ? '#16a34a' : '#dc2626' },
                      { label: 'V', val: formatVol(hc.volume),   color: '#6b7280' },
                    ].map(({ label, val, color }, ri) => (
                      <g key={label}>
                        <text x={tipX+10}    y={tipY + 36 + ri * 18}
                              fill="#555555" fontSize="11">{label}</text>
                        <text x={tipX+tipW-10} y={tipY + 36 + ri * 18}
                              fill={color} fontSize="11" fontFamily="monospace"
                              fontWeight="700" textAnchor="end">{val}</text>
                      </g>
                    ))}
                  </g>
                </>
              )}

              {/* ── Invisible hit area for mouse tracking ──────────────────── */}
              <rect
                x={CL} y={PRICE_TOP} width={CW} height={VOL_BOTTOM - PRICE_TOP}
                fill="transparent"
                style={{ cursor: isDragging ? 'grabbing' : 'crosshair' }}
                onMouseMove={(e) => handleSvgMouseMove(e, visibleData, dataStartOffset, viewportSize)}
                onMouseLeave={clearHover}
              />
            </>
          );
        })()}
      </svg>
    </div>
  );
};

export default CandlestickChart;
