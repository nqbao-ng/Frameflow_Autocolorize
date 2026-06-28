import {
  Brush, Eraser, Pipette, Sliders, Contrast,
  Palette, ChevronUp, ChevronDown, Check, Plus,
  Sun, Droplets, Wind, X, RefreshCw, Wand2, Sparkles,
} from "lucide-react";
import { ColorPickerWheel } from "./ColorPickerWheel";
import { Slider } from "./Slider";
import { ReviewCorrectionPanel } from "./ReviewCorrectionPanel";
import { TOOLS, BLEND_MODES, PALETTE_ROWS } from "../constants/dashboardData";
import type { useDashboard } from "../hooks/useDashboard";

type DashboardCtx = ReturnType<typeof useDashboard>;

interface RightPanelProps {
  ctx: DashboardCtx;
}

export function RightPanel({ ctx }: RightPanelProps) {
  const {
    panelOpen, togglePanel,
    activeTool, setActiveTool,
    activeColor, setActiveColor,
    secondaryColor, setSecondaryColor,
    recentColors, setRecentColors,
    brushSize, setBrushSize,
    opacity, setOpacity,
    hardness, setHardness,
    blendMode, setBlendMode,
    flow, setFlow,
    spacing, setSpacing,
    fillTolerance, setFillTolerance,
    gapClose, setGapClose,
    improveEdge, setImproveEdge,
    preserveLines, setPreserveLines,
    skinTone, setSkinTone,
    brightness, setBrightness,
    contrastVal, setContrastVal,
    saturation, setSaturation,
    blur, setBlur,
    spill, setSpill,
    tones, setTones,
    handleColorCurrentFrame,
    handleAutoColor,
    referenceImage,
    paintableFrames,
    addToast,
  } = ctx;

  const handleColorChange = (c: string) => {
    setActiveColor(c);
    setRecentColors((prev) => [c, ...prev.filter((x) => x !== c)].slice(0, 10));
  };

  return (
    <aside style={{ width: 298, minWidth: 298, background: "#FAFBFC", borderLeft: "1px solid #E2E8F0", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ flex: 1, overflowY: "auto", scrollbarWidth: "thin" }}>

        {/* ── TOOLS PANEL ─────────────────────────────── */}
        <div style={{ borderBottom: "1px solid #F1F5F9" }}>
          <button onClick={() => togglePanel("tools")} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "none", border: "none", cursor: "pointer", fontFamily: "'Inter',sans-serif" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Brush size={12} color="#8B5CF6" />
              <span style={{ fontSize: 11, fontWeight: 700, color: "#1E293B" }}>Tools</span>
              <span style={{ fontSize: 9, color: "#8B5CF6", background: "#F3F0FF", padding: "1px 6px", borderRadius: 4, textTransform: "capitalize" }}>{activeTool}</span>
            </div>
            {panelOpen.tools ? <ChevronUp size={12} color="#94A3B8" /> : <ChevronDown size={12} color="#94A3B8" />}
          </button>

          {panelOpen.tools && (
            <div style={{ padding: "0 12px 12px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 4, marginBottom: 10 }}>
                {TOOLS.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setActiveTool(t.id)}
                    title={`${t.label} (${t.shortcut})`}
                    style={{
                      padding: "8px 3px", borderRadius: 8,
                      border: activeTool === t.id ? "none" : "1.5px solid #E2E8F0",
                      background: activeTool === t.id ? "#EFF6FF" : "white",
                      cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                      color: activeTool === t.id ? "#3B82F6" : "#64748B",
                      transition: "all 0.1s",
                      boxShadow: activeTool === t.id ? "0 0 0 2px rgba(59,130,246,0.2)" : "none",
                      position: "relative",
                    }}
                  >
                    {t.icon}
                    <span style={{ fontSize: 8, fontWeight: activeTool === t.id ? 700 : 500 }}>{t.label}</span>
                    <span style={{ position: "absolute", top: 3, right: 4, fontSize: 7, color: activeTool === t.id ? "#93C5FD" : "#CBD5E1", fontFamily: "monospace", fontWeight: 700 }}>{t.shortcut}</span>
                  </button>
                ))}
              </div>

              <button
                onClick={() => {
                  if (!referenceImage) {
                    addToast("❌ Vui lòng chọn ảnh tham chiếu trước!", "error");
                    return;
                  }
                  if (paintableFrames.size === 0) {
                    addToast("❌ Vui lòng chọn frame cần tô màu!", "error");
                    return;
                  }
                  handleColorCurrentFrame();
                  addToast("⏳ Đang tô màu frame...", "info", 5000);
                }}
                style={{ width: "100%", padding: "7px", borderRadius: 8, border: "none", background: "linear-gradient(135deg,#8B5CF6,#3B82F6)", color: "white", fontWeight: 700, fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5, boxShadow: "0 2px 8px rgba(139,92,246,0.3)", fontFamily: "'Inter',sans-serif", marginBottom: 5 }}
              >
                <Wand2 size={12} />AI Color This Frame
              </button>

                <button
                  onClick={() => {
                    if (!referenceImage) {
                      addToast("❌ Vui lòng chọn ảnh tham chiếu trước!", "error");
                      return;
                    }
                    if (paintableFrames.size === 0) {
                      addToast("❌ Vui lòng chọn frame cần tô màu!", "error");
                      return;
                    }
                    handleAutoColor();
                    addToast("⏳ Đang tô màu tất cả frame...", "info", 5000);
                  }}
                  style={{ width: "100%", padding: "7px", borderRadius: 8, border: "1.5px solid #E2E8F0", background: "white", color: "#3B82F6", fontWeight: 600, fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5, fontFamily: "'Inter',sans-serif" }}
                >
                  <Sparkles size={12} />Auto Color Sequence
                </button>
            </div>
          )}
        </div>

        {/* ── REVIEW / CORRECTION PANEL ───────────────── */}
        <ReviewCorrectionPanel ctx={ctx} />

        {/* ── COLOR PANEL ──────────────────────────────── */}
        <div style={{ borderBottom: "1px solid #F1F5F9" }}>
          <button onClick={() => togglePanel("color")} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "none", border: "none", cursor: "pointer", fontFamily: "'Inter',sans-serif" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Palette size={12} color="#F59E0B" />
              <span style={{ fontSize: 11, fontWeight: 700, color: "#1E293B" }}>Color</span>
              <div style={{ position: "relative", width: 28, height: 20 }}>
                <div style={{ position: "absolute", bottom: 0, right: 0, width: 16, height: 16, borderRadius: 3, background: secondaryColor, border: "1.5px solid white" }} />
                <div style={{ position: "absolute", top: 0, left: 0, width: 18, height: 18, borderRadius: 4, background: activeColor, border: "1.5px solid white", boxShadow: "0 1px 3px rgba(0,0,0,0.15)" }} />
              </div>
            </div>
            {panelOpen.color ? <ChevronUp size={12} color="#94A3B8" /> : <ChevronDown size={12} color="#94A3B8" />}
          </button>

          {panelOpen.color && (
            <div style={{ padding: "0 12px 14px" }}>
              {/* Swatches swap */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <div
                  style={{ position: "relative", width: 42, height: 38, cursor: "pointer", flexShrink: 0 }}
                  onClick={() => { const t = activeColor; setActiveColor(secondaryColor); setSecondaryColor(t); }}
                >
                  <div style={{ position: "absolute", bottom: 0, right: 0, width: 26, height: 26, borderRadius: 6, background: secondaryColor, border: "2.5px solid white", boxShadow: "0 1px 4px rgba(0,0,0,0.12)" }} />
                  <div style={{ position: "absolute", top: 0, left: 0, width: 30, height: 30, borderRadius: 8, background: activeColor, border: "2.5px solid white", boxShadow: "0 2px 8px rgba(0,0,0,0.2)" }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 9, color: "#94A3B8", marginBottom: 3 }}>Click swatches to swap</div>
                  <div style={{ display: "flex", gap: 4 }}>
                    <div style={{ flex: 1, fontSize: 9, background: "#F1F5F9", borderRadius: 4, padding: "3px 6px", color: "#475569", fontFamily: "monospace", fontWeight: 600 }}>{activeColor.toUpperCase()}</div>
                    <div style={{ flex: 1, fontSize: 9, background: "#F1F5F9", borderRadius: 4, padding: "3px 6px", color: "#475569", fontFamily: "monospace" }}>{secondaryColor.toUpperCase()}</div>
                  </div>
                </div>
              </div>

              <ColorPickerWheel color={activeColor} onChange={handleColorChange} />

              {/* Palette */}
              <div style={{ marginTop: 12, marginBottom: 4 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 }}>Palette</div>
                {PALETTE_ROWS.map((row, ri) => (
                  <div key={ri} style={{ display: "flex", gap: 2, marginBottom: 2 }}>
                    {row.map((c) => (
                      <button
                        key={c}
                        onClick={() => handleColorChange(c)}
                        title={c}
                        style={{ flex: 1, aspectRatio: "1", borderRadius: 3, background: c, border: activeColor === c ? "2px solid #3B82F6" : c === "#FFFFFF" ? "1px solid #E2E8F0" : "none", cursor: "pointer", outline: "none", transition: "transform 0.08s", minWidth: 0, padding: 0 }}
                      />
                    ))}
                  </div>
                ))}
              </div>

              {/* Recent colors */}
              {recentColors.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 5 }}>Recent</div>
                  <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                    {recentColors.map((c, i) => (
                      <button key={i} onClick={() => setActiveColor(c)} title={c}
                        style={{ width: 18, height: 18, borderRadius: 4, background: c, border: activeColor === c ? "2px solid #3B82F6" : "1px solid #E2E8F0", cursor: "pointer", flexShrink: 0, padding: 0 }} />
                    ))}
                  </div>
                </div>
              )}

              <button style={{ width: "100%", marginTop: 10, padding: "6px", borderRadius: 7, border: "1.5px dashed #CBD5E1", background: "white", cursor: "pointer", fontSize: 10, fontWeight: 500, color: "#64748B", display: "flex", alignItems: "center", justifyContent: "center", gap: 4, fontFamily: "'Inter',sans-serif" }}>
                <Plus size={10} />Add to Palette
              </button>
            </div>
          )}
        </div>

        {/* ── STROKE / FILL SETTINGS ─────────────────── */}
        <div style={{ borderBottom: "1px solid #F1F5F9" }}>
          <button onClick={() => togglePanel("brush")} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "none", border: "none", cursor: "pointer", fontFamily: "'Inter',sans-serif" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Sliders size={12} color="#22D3EE" />
              <span style={{ fontSize: 11, fontWeight: 700, color: "#1E293B" }}>
                {activeTool === "fill" ? "Fill Settings" : "Stroke Settings"}
              </span>
              <span style={{ fontSize: 9, color: "#64748B", background: "#F1F5F9", padding: "1px 5px", borderRadius: 3, fontFamily: "monospace", letterSpacing: 0.5 }}>
                {activeTool === "brush" ? "B" : activeTool === "pencil" ? "P" : activeTool === "eraser" ? "E" : activeTool === "picker" ? "I" : activeTool === "fill" ? "F" : ""}
              </span>
            </div>
            {panelOpen.brush ? <ChevronUp size={12} color="#94A3B8" /> : <ChevronDown size={12} color="#94A3B8" />}
          </button>

          {panelOpen.brush && (
            <div style={{ padding: "0 14px 14px", display: "flex", flexDirection: "column", gap: 10 }}>

              {/* Fill tool settings */}
              {activeTool === "fill" && (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#1E293B", borderRadius: 8, padding: "10px 12px", border: "1px solid #2D3748" }}>
                    <div style={{ width: 28, height: 28, borderRadius: 6, background: activeColor, flexShrink: 0, border: "2px solid rgba(255,255,255,0.15)" }} />
                    <div>
                      <div style={{ fontSize: 9, color: "rgba(255,255,255,0.4)" }}>Fill Preview</div>
                      <div style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.9)" }}>{activeColor.toUpperCase()} · {opacity}% opacity</div>
                      <div style={{ fontSize: 9, color: "rgba(255,255,255,0.4)" }}>Tolerance {fillTolerance} · Gap close {gapClose ? "ON" : "OFF"}</div>
                    </div>
                  </div>
                  <Slider label="Opacity" value={opacity} onChange={setOpacity} />
                  <Slider label="Tolerance" value={fillTolerance} onChange={setFillTolerance} min={0} max={128} unit="" />
                  <div style={{ background: "#F8FAFF", borderRadius: 7, padding: "8px 10px", border: "1px solid #E2E8F0" }}>
                    <div style={{ fontSize: 9, color: "#64748B", marginBottom: 6, lineHeight: 1.5 }}>
                      <strong style={{ color: "#374151" }}>Tolerance</strong> — how similar a pixel's color must be to get filled.
                    </div>
                    <div style={{ fontSize: 9, color: "#64748B", lineHeight: 1.5 }}>
                      <strong style={{ color: "#374151" }}>Gap Close</strong> — seals hairline gaps so fill can't bleed through thin outlines.
                    </div>
                  </div>
                  <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", padding: "7px 10px", borderRadius: 8, border: `1.5px solid ${gapClose ? "#3B82F6" : "#E2E8F0"}`, background: gapClose ? "#EFF6FF" : "white", transition: "all 0.15s" }}>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: gapClose ? "#1D4ED8" : "#374151" }}>Gap Closing</div>
                      <div style={{ fontSize: 9, color: "#94A3B8", marginTop: 1 }}>Prevent bleed through thin lines</div>
                    </div>
                    <div onClick={() => setGapClose(!gapClose)} style={{ width: 32, height: 18, borderRadius: 9, background: gapClose ? "#3B82F6" : "#E2E8F0", position: "relative", flexShrink: 0, transition: "background 0.2s", cursor: "pointer" }}>
                      <div style={{ position: "absolute", top: 2, left: gapClose ? 16 : 2, width: 14, height: 14, borderRadius: "50%", background: "white", boxShadow: "0 1px 3px rgba(0,0,0,0.2)", transition: "left 0.2s" }} />
                    </div>
                  </label>
                </>
              )}

               {/* Brush / Pencil / Eraser settings */}
               {activeTool === "brush" || activeTool === "pencil" || activeTool === "eraser" ? (
                 <>
                   <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#1E293B", borderRadius: 8, padding: "10px 12px", border: "1px solid #2D3748" }}>
                     <div style={{
                       width: Math.max(6, Math.min(44, brushSize)),
                       height: Math.max(6, Math.min(44, brushSize)),
                       borderRadius: activeTool === "pencil" ? "3px" : "50%",
                       background: activeColor, opacity: opacity / 100, flexShrink: 0,
                       transition: "all 0.15s",
                       boxShadow: activeTool === "brush" && hardness < 70 ? `0 0 ${brushSize * (1 - hardness / 100) * 0.5}px ${activeColor}88` : "none",
                     }} />
                     <div>
                       <div style={{ fontSize: 9, color: "rgba(255,255,255,0.4)" }}>
                         {activeTool === "brush" ? "Smooth Brush" : activeTool === "pencil" ? "Hard Pencil" : "Eraser"}
                       </div>
                       <div style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.9)" }}>{brushSize}px · {opacity}% opacity</div>
                       <div style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", textTransform: "capitalize" }}>
                         {blendMode.replace("source-over", "Normal")}
                         {activeTool === "brush" ? " · Smooth ON" : activeTool === "pencil" ? " · Hard edges" : ""}
                       </div>
                     </div>
                   </div>
                   <Slider label="Size" value={brushSize} onChange={setBrushSize} min={1} max={100} unit="px" />
                   <Slider label="Opacity" value={opacity} onChange={setOpacity} />
                   {activeTool === "brush" && <Slider label="Hardness" value={hardness} onChange={setHardness} />}
                   <Slider label="Flow" value={flow} onChange={setFlow} />
                   <Slider label="Spacing" value={spacing} onChange={setSpacing} max={50} unit="%" />
                   <div>
                     <div style={{ fontSize: 11, color: "#64748B", fontWeight: 500, marginBottom: 4 }}>Blend Mode</div>
                     <select
                       value={blendMode}
                       onChange={(e) => setBlendMode(e.target.value as typeof blendMode)}
                       style={{ width: "100%", padding: "5px 8px", borderRadius: 7, border: "1px solid #E2E8F0", background: "white", fontSize: 11, color: "#1E293B", fontFamily: "'Inter',sans-serif", cursor: "pointer" }}
                     >
                       {BLEND_MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                     </select>
                   </div>
                 </>
               ) : activeTool === "smudge" || activeTool === "dodge" || activeTool === "burn" ? (
                 <>
                   <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#1E293B", borderRadius: 8, padding: "10px 12px", border: "1px solid #2D3748" }}>
                     <div style={{
                       width: Math.max(6, Math.min(44, brushSize)),
                       height: Math.max(6, Math.min(44, brushSize)),
                       borderRadius: "50%",
                       background: activeTool === "smudge" ? "#8B5CF6" : activeTool === "dodge" ? "#FCD34D" : "#A78BFA",
                       opacity: 0.7,
                       flexShrink: 0,
                       boxShadow: `0 0 ${brushSize * 0.3}px ${activeTool === "smudge" ? "#8B5CF6" : activeTool === "dodge" ? "#FCD34D" : "#A78BFA"}66`,
                     }} />
                     <div>
                       <div style={{ fontSize: 9, color: "rgba(255,255,255,0.4)" }}>
                         {activeTool === "smudge" ? "Smudge / Blend" : activeTool === "dodge" ? "Dodge / Lighten" : "Burn / Darken"}
                       </div>
                       <div style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.9)" }}>{brushSize}px · {activeTool === "smudge" ? `${ctx.smudgeStrength}% Strength` : `${ctx.dodgeExposure}% Exposure`}</div>
                       <div style={{ fontSize: 9, color: "rgba(255,255,255,0.4)" }}>Non-destructive · Samples all layers</div>
                     </div>
                   </div>
                   <Slider label="Size" value={brushSize} onChange={setBrushSize} min={1} max={100} unit="px" />
                   {activeTool === "smudge" && (
                     <Slider label="Strength" value={ctx.smudgeStrength} onChange={ctx.setSmudgeStrength} min={1} max={100} unit="%" />
                   )}
                   {(activeTool === "dodge" || activeTool === "burn") && (
                     <Slider label="Exposure" value={activeTool === "dodge" ? ctx.dodgeExposure : ctx.burnExposure} onChange={activeTool === "dodge" ? ctx.setDodgeExposure : ctx.setBurnExposure} min={1} max={100} unit="%" />
                   )}
                   <Slider label="Opacity" value={opacity} onChange={setOpacity} />
                   <div style={{ background: "#F8FAFF", borderRadius: 7, padding: "8px 10px", border: "1px solid #E2E8F0" }}>
                     <div style={{ fontSize: 9, color: "#64748B", lineHeight: 1.5 }}>
                       {activeTool === "smudge" && (
                         <>
                           <strong style={{ color: "#374151" }}>Smudge</strong> — Blend pixels from the base layer. Strength controls the intensity of the blur effect.
                         </>
                       )}
                       {activeTool === "dodge" && (
                         <>
                           <strong style={{ color: "#374151" }}>Dodge</strong> — Lighten areas non-destructively. Exposure controls how bright the effect is.
                         </>
                       )}
                       {activeTool === "burn" && (
                         <>
                           <strong style={{ color: "#374151" }}>Burn</strong> — Darken areas non-destructively. Exposure controls how dark the effect is.
                         </>
                       )}
                     </div>
                   </div>
                 </>
               ) : null}

              {/* Color picker hint */}
              {activeTool === "picker" && (
                <div style={{ background: "#F8FAFF", borderRadius: 8, padding: "12px", border: "1px solid #E2E8F0", textAlign: "center" }}>
                  <Pipette size={18} color="#3B82F6" style={{ margin: "0 auto 6px" }} />
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#374151", marginBottom: 3 }}>Color Picker</div>
                  <div style={{ fontSize: 10, color: "#94A3B8", lineHeight: 1.5 }}>Click anywhere on the canvas to sample that color as your primary color.</div>
                </div>
              )}

              {/* AI Options */}
              <div style={{ paddingTop: 4, borderTop: "1px solid #F1F5F9" }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 7 }}>AI Options</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {([
                    { label: "Improve Edge Detection", val: improveEdge, set: setImproveEdge },
                    { label: "Preserve Line Art", val: preserveLines, set: setPreserveLines },
                    { label: "Smart Skin Tone", val: skinTone, set: setSkinTone },
                  ] as const).map(({ label, val, set }) => (
                    <label key={label} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11, color: "#374151", cursor: "pointer" }}>
                      <div onClick={() => set(!val)} style={{ width: 14, height: 14, borderRadius: 3, border: val ? "none" : "1.5px solid #CBD5E1", background: val ? "#3B82F6" : "white", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
                        {val && <Check size={8} color="white" strokeWidth={3} />}
                      </div>
                      {label}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── IMAGE ADJUSTMENTS ─────────────────────────── */}
        <div>
          <button onClick={() => togglePanel("adjust")} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "none", border: "none", cursor: "pointer", fontFamily: "'Inter',sans-serif" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Contrast size={12} color="#F59E0B" />
              <span style={{ fontSize: 11, fontWeight: 700, color: "#1E293B" }}>Image Adjustments</span>
            </div>
            {panelOpen.adjust ? <ChevronUp size={12} color="#94A3B8" /> : <ChevronDown size={12} color="#94A3B8" />}
          </button>

          {panelOpen.adjust && (
            <div style={{ padding: "0 14px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
              {([
                { label: "Brightness", icon: <Sun size={10} color="#F59E0B" />, val: brightness, set: setBrightness },
                { label: "Contrast",   icon: <Contrast size={10} color="#3B82F6" />, val: contrastVal, set: setContrastVal },
                { label: "Saturation", icon: <Droplets size={10} color="#8B5CF6" />, val: saturation, set: setSaturation },
                { label: "Blur Areas", icon: <Wind size={10} color="#22D3EE" />, val: blur, set: setBlur },
                { label: "Color Spill", icon: <X size={10} color="#EF4444" />, val: spill, set: setSpill },
                { label: "Rebalance",  icon: <RefreshCw size={10} color="#10B981" />, val: tones, set: setTones },
              ] as const).map(({ label, icon, val, set }) => (
                <div key={label}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      {icon}
                      <span style={{ fontSize: 11, color: "#374151", fontWeight: 500 }}>{label}</span>
                    </div>
                    <span style={{ fontSize: 9, color: "#94A3B8", fontVariantNumeric: "tabular-nums" }}>{val}%</span>
                  </div>
                  <input type="range" min={0} max={100} value={val} onChange={(e) => set(Number(e.target.value))} style={{ width: "100%", accentColor: "#3B82F6", height: 3, cursor: "pointer" }} />
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </aside>
  );
}