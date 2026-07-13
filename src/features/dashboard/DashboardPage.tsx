
import { Brush, Sparkles } from "lucide-react";
import { PaintCanvas } from "./components/PaintCanvas";
import { LeftSidebar } from "./components/LeftSidebar";
import { RightPanel } from "./components/RightPanel";
import { Toolbar } from "./components/Toolbar";
import { Timeline } from "./components/Timeline";
import { ContextMenu } from "./components/ContextMenu";
import { ReferenceModal } from "./components/ReferenceModal";
import { Toast } from "./components/Toast";
import { useDashboard } from "./hooks/useDashboard";
import { useParams } from "react-router";
import { useEffect, useState } from "react";
import { getProject } from "./services/project.api";
export function Dashboard() {
  const ctx = useDashboard();
  const { projectId } = useParams();
  const [projectName, setProjectName] = useState<string>("");

  useEffect(() => {
    if (!projectId) return;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout

    async function loadProject() {
      try {
        const project = await getProject(projectId!);
        setProjectName(project.name);
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          console.error('getProject timeout - API took too long');
        } else {
          console.error('Error loading project:', error);
        }
      } finally {
        clearTimeout(timeoutId);
      }
    }

    loadProject();
    
    return () => {
      controller.abort();
      clearTimeout(timeoutId);
    };
  }, [projectId]);
  const {
    activeFrame, frameStates, referenceImage,
    activeTool, activeColor, brushSize, opacity, hardness,
    blendMode, fillTolerance, gapClose,
    uncoloredFiles,
    framePaints,
    canvasRef, paintCanvasRef, uncoloredInputRef, customColoredInputRef,
    handleColorPicked, handleStroke, pushUndoSnapshot,
    handleImportUncolored, handleCustomColoredUpload,
    setContextMenu,
  } = ctx;

  return (
    <div
      style={{ height: "100vh", background: "#F1F5F9", display: "flex", fontFamily: "'Inter',sans-serif", overflow: "hidden" }}
      onMouseDown={() => setContextMenu(null)}
    >
      {/* Hidden file inputs */}
      <input ref={uncoloredInputRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={handleImportUncolored} />
      <input ref={customColoredInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleCustomColoredUpload} />

      {/* Left sidebar */}
      <LeftSidebar ctx={ctx} projectName={projectName} />

      {/* Main content */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
        <Toolbar ctx={ctx} projectName={projectName} />

        <div style={{ flex: 1, padding: "12px 12px 0", display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
          {/* Canvas area */}
          <div style={{ flex: 1, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", background: "#0F172A", position: "relative", minHeight: 0, borderRadius: 14, overflow: "hidden" }}>
            <PaintCanvas
              ref={paintCanvasRef}
              imageUrl={uncoloredFiles[activeFrame]?.url ?? null}
              paintUrl={framePaints[activeFrame] || uncoloredFiles[activeFrame]?.paintUrl || null}
              tool={activeTool}
              color={activeColor}
              brushSize={brushSize}
              opacity={opacity}
              hardness={hardness}
              blendMode={blendMode}
              fillTolerance={fillTolerance}
              gapClose={gapClose}
              onColorPicked={handleColorPicked}
              onStroke={handleStroke}
              onBeforeStroke={pushUndoSnapshot}
              canvasRef={canvasRef}
              smudgeStrength={ctx.smudgeStrength}
              dodgeExposure={ctx.dodgeExposure}
              burnExposure={ctx.burnExposure}
              segmentMapUrl={ctx.frameReview?.job_frame?.labels_asset_url || null}
              selectedSegmentId={ctx.selectedSegmentId}
              segmentPickMode={ctx.segmentPickMode}
              onSegmentPicked={ctx.handleSegmentPicked}
              lowConfidenceOverlayUrl={ctx.frameReview?.job_frame?.low_confidence_overlay_url || null}
              showLowConfidenceOverlay={ctx.showLowConfidenceOverlay}
            />

            {/* Frame counter badge */}
            <div style={{ position: "absolute", bottom: 12, left: "50%", transform: "translateX(-50%)", background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)", borderRadius: 100, padding: "4px 12px", pointerEvents: "none" }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: "white" }}>
                Frame {activeFrame + 1} of {uncoloredFiles.length || 0}
              </span>
            </div>

            {/* Reference badge */}
            {referenceImage && (
              <div style={{ position: "absolute", top: 12, right: 12, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(8px)", borderRadius: 9, padding: "4px 9px", display: "flex", alignItems: "center", gap: 6, border: "1px solid rgba(255,255,255,0.1)", pointerEvents: "none" }}>
                <img src={referenceImage.paintUrl || referenceImage.url} alt="ref" style={{ width: 22, height: 22, borderRadius: 4, objectFit: "cover" }} />
                <div>
                  <div style={{ fontSize: 8, color: "rgba(255,255,255,0.45)", marginBottom: 1 }}>Reference</div>
                  <div style={{ fontSize: 9, fontWeight: 600, color: "white", maxWidth: 90, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{referenceImage.name}</div>
                </div>
              </div>
            )}

            {/* AI colored badge */}
            {frameStates[activeFrame] === "ai" && (
              <div style={{ position: "absolute", top: 12, left: 12, background: "rgba(139,92,246,0.85)", borderRadius: 100, padding: "3px 9px", display: "flex", alignItems: "center", gap: 3, pointerEvents: "none" }}>
                <Sparkles size={9} color="white" />
                <span style={{ fontSize: 9, fontWeight: 600, color: "white" }}>AI Colored</span>
              </div>
            )}

            {/* Manual edit badge */}
            {frameStates[activeFrame] === "manual" && (
              <div style={{ position: "absolute", top: 12, left: 12, background: "rgba(245,158,11,0.85)", borderRadius: 100, padding: "3px 9px", display: "flex", alignItems: "center", gap: 3, pointerEvents: "none" }}>
                <Brush size={9} color="white" />
                <span style={{ fontSize: 9, fontWeight: 600, color: "white" }}>Manual Edit</span>
              </div>
            )}


            {/* Tool indicator */}
            <div style={{ position: "absolute", bottom: 12, right: 12, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(6px)", borderRadius: 7, padding: "3px 8px", display: "flex", alignItems: "center", gap: 5, pointerEvents: "none" }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: activeColor, border: "1px solid rgba(255,255,255,0.5)", flexShrink: 0 }} />
              <span style={{ fontSize: 9, fontWeight: 600, color: "rgba(255,255,255,0.8)", textTransform: "capitalize" }}>
                {activeTool} · {brushSize}px · {opacity}%
              </span>
            </div>
          </div>

          {/* Timeline */}
          <Timeline ctx={ctx} />
        </div>
      </main>

      {/* Right panel */}
      <RightPanel ctx={ctx} />

      {/* Overlays */}
      <ContextMenu ctx={ctx} />
      <ReferenceModal ctx={ctx} />
      <Toast toasts={ctx.toasts} onRemove={ctx.removeToast} />
    </div>
  );
}
