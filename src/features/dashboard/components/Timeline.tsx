import { Play, Pause, ChevronDown } from "lucide-react";
import { Star } from "lucide-react";
import { RulerTick } from "./RulerTick";
import { SPEEDS } from "../constants/dashboardData";
import type { useDashboard } from "../hooks/useDashboard";

type DashboardCtx = ReturnType<typeof useDashboard>;

interface TimelineProps {
  ctx: DashboardCtx;
}

export function Timeline({ ctx }: TimelineProps) {
  const {
    isPlaying, setIsPlaying,
    speed, setSpeed,
    showSpeedMenu, setShowSpeedMenu,
    activeFrame, frameStates, frameRefMap, framePaints, referenceImage,
    detachedReferenceFrameId,
    uncoloredFiles, timelineScrollRef,
    handleFrameChange, setContextMenu,
    paintableFrames, toggleFramePaintable,
    selectAllFrames, deselectAllFrames,
  } = ctx;

  return (
    <div style={{ background: "#11111B", borderRadius: "10px 10px 0 0", marginTop: 8, boxShadow: "0 -2px 10px rgba(0,0,0,0.04)", flexShrink: 0 }}>
       {/* Controls row */}
       <div style={{ padding: "8px 12px 5px", display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid #2A2A40" }}>
         <button
           onClick={() => setIsPlaying(!isPlaying)}
           style={{ width: 28, height: 28, borderRadius: 7, border: "none", background: "linear-gradient(135deg,#7C3AED,#FF2E9A)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 3px 10px rgba(255,46,154,0.28)", flexShrink: 0 }}
         >
           {isPlaying ? <Pause size={11} color="white" fill="white" /> : <Play size={11} color="white" fill="white" />}
         </button>

         {/* Speed selector */}
         <div style={{ position: "relative" }}>
           <button
             onClick={() => setShowSpeedMenu(!showSpeedMenu)}
             style={{ display: "flex", alignItems: "center", gap: 2, padding: "4px 7px", borderRadius: 6, border: "1px solid #2A2A40", background: "#181827", cursor: "pointer", fontSize: 10, fontWeight: 600, color: "#AAB2D5", fontFamily: "'Inter',sans-serif" }}
           >
             {speed}<ChevronDown size={9} />
           </button>
           {showSpeedMenu && (
             <div style={{ position: "absolute", bottom: "110%", left: 0, background: "#181827", borderRadius: 8, boxShadow: "0 8px 20px rgba(0,0,0,0.12)", border: "1px solid #2A2A40", overflow: "hidden", zIndex: 50, minWidth: 60 }}>
               {SPEEDS.map((s) => (
                 <button
                   key={s}
                   onClick={() => { setSpeed(s); setShowSpeedMenu(false); }}
                   style={{ display: "block", width: "100%", padding: "6px 10px", border: "none", background: speed === s ? "rgba(168,85,247,0.16)" : "#181827", cursor: "pointer", fontSize: 10, fontWeight: speed === s ? 600 : 400, color: speed === s ? "#C084FC" : "#AAB2D5", textAlign: "left", fontFamily: "'Inter',sans-serif" }}
                 >
                   {s}
                 </button>
               ))}
             </div>
           )}
         </div>

         <span style={{ fontSize: 10, color: "#7E86A4", marginLeft: 2 }}>{uncoloredFiles.length}s · 1fps</span>

         {/* Select/Deselect all buttons */}
         <div style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center" }}>
           <button
             onClick={selectAllFrames}
             style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid #A855F7", background: "#181827", cursor: "pointer", fontSize: 10, fontWeight: 500, color: "#C084FC", fontFamily: "'Inter',sans-serif" }}
           >
             Select All
           </button>
           <button
             onClick={deselectAllFrames}
             style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid #2A2A40", background: "#181827", cursor: "pointer", fontSize: 10, fontWeight: 500, color: "#AAB2D5", fontFamily: "'Inter',sans-serif" }}
           >
             Deselect All
           </button>
         </div>
       </div>

      {/* Scrollable track */}
      <div ref={timelineScrollRef} style={{ overflowX: "auto", paddingLeft: 12, paddingRight: 12, paddingBottom: 8, scrollbarWidth: "thin" }}>
        <div style={{ display: "flex", gap: 5, paddingTop: 14, marginBottom: 3 }}>
          {uncoloredFiles.map((_, i) => <RulerTick key={`t${i}`} index={i} position="top" />)}
        </div>
        <div style={{ display: "flex", gap: 5, marginBottom: 0 }}>
          {uncoloredFiles.map((_, i) => (
            <div key={`l${i}`} style={{ width: 52, minWidth: 52, height: 2, background: (i + 1) % 5 === 0 ? "#A855F7" : "#2A2A40", borderRadius: 1, flexShrink: 0 }} />
          ))}
        </div>

         {/* Frame thumbnails */}
         <div style={{ display: "flex", gap: 5, marginTop: 3, marginBottom: 3, alignItems: "flex-start" }}>
           {uncoloredFiles.map((file, i) => {
             const isActive = activeFrame === i;
             const referenceIndex = referenceImage?.id
               ? uncoloredFiles.findIndex((frame) => frame.id === referenceImage.id)
               : -1;
             const isBeforeOrReference = referenceIndex >= 0 && i <= referenceIndex;
             const isPaintable = paintableFrames.has(i) && !isBeforeOrReference;
             const state = frameStates[i] ?? "plain";
             return (
               <div key={file.id} style={{ position: "relative" }}>
                 <button
                   onClick={() => handleFrameChange(i)}
                   onContextMenu={(e) => { e.preventDefault(); setContextMenu({ frameIndex: i, x: e.clientX, y: e.clientY }); }}
                   style={{
                     width: 52, height: 48, minWidth: 52, borderRadius: 6, padding: 0,
                     flexShrink: 0, cursor: "pointer",
                     border: isActive ? "2px solid #FF2E9A" : frameRefMap[i] ? "2px solid #F59E0B" : "1.5px solid #2A2A40",
                     overflow: "hidden", background: "#181827", position: "relative",
                     boxShadow: isActive ? "0 0 0 3px rgba(255,46,154,0.28)" : frameRefMap[i] ? "0 0 0 2px rgba(245,158,11,0.2)" : "none",
                     transition: "all 0.1s",
                   }}
                 >
                   <img
                     src={(frameStates[i] === "manual" ? framePaints[i] : null) || (file.id === detachedReferenceFrameId ? file.url : file.paintUrl || file.url)}
                     alt={file.name}
                     style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                   />
                   {state !== "plain" && (
                     <div style={{ position: "absolute", top: 2, right: 2, width: 5, height: 5, borderRadius: "50%", background: state === "ai" ? "#8B5CF6" : "#F59E0B", border: "1.5px solid white" }} />
                   )}
                   {frameRefMap[i] && (
                     <div style={{ position: "absolute", bottom: 2, left: 2, display: "flex", alignItems: "center", gap: 1, background: "rgba(245,158,11,0.9)", borderRadius: 2, padding: "1px 3px", border: "1px solid white" }}>
                       <Star size={6} color="white" fill="white" />
                       <img src={frameRefMap[i].paintUrl || frameRefMap[i].url} alt="ref" style={{ width: 10, height: 10, borderRadius: 1, objectFit: "cover" }} />
                     </div>
                   )}
                 </button>
                 {/* Checkbox for paintable selection */}
                 <input
                   type="checkbox"
                   checked={isPaintable}
                   disabled={isBeforeOrReference}
                   title={isBeforeOrReference ? "Reference và frame trước nó không được tô lại trong forward propagation" : "Select this frame for Auto Color"}
                   onChange={() => {
                     if (!isBeforeOrReference) toggleFramePaintable(i);
                   }}
                   style={{
                     position: "absolute",
                     bottom: 3,
                     right: 3,
                     width: 14,
                     height: 14,
                     cursor: isBeforeOrReference ? "not-allowed" : "pointer",
                     opacity: isBeforeOrReference ? 0.45 : 1,
                     accentColor: "#A855F7",
                   }}
                 />
               </div>
             );
           })}
         </div>

        <div style={{ display: "flex", gap: 5, marginBottom: 0 }}>
          {uncoloredFiles.map((_, i) => (
            <div key={`lb${i}`} style={{ width: 52, minWidth: 52, height: 2, background: (i + 1) % 5 === 0 ? "#A855F7" : "#2A2A40", borderRadius: 1, flexShrink: 0 }} />
          ))}
        </div>
        <div style={{ display: "flex", gap: 5, marginTop: 3 }}>
          {uncoloredFiles.map((_, i) => <RulerTick key={`b${i}`} index={i} position="bottom" />)}
        </div>
      </div>
    </div>
  );
}