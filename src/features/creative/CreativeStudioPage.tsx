import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router";
import {
  ArrowRight,
  CheckCircle2,
  Download,
  Expand,
  ImagePlus,
  Loader2,
  Palette,
  RefreshCw,
  Sparkles,
  Upload,
  WandSparkles,
} from "lucide-react";
import { ProjectsHeader } from "@/features/projects/components/ProjectsHeader";
import {
  expandScene,
  generateSketchConcept,
  getBedrockStabilityStatus,
} from "./services/stability.api";
import {
  calculateExpansion,
  downloadDataUrl,
  fileToObjectUrl,
  optimizeImageSource,
  type ImageDimensions,
} from "./services/image.utils";
import "./creative-studio.css";

type StudioMode = "sketch" | "outpaint";
type LocationState = {
  mode?: StudioMode;
  sourceImage?: string | null;
  sourceName?: string | null;
};

const SKETCH_STYLES = [
  {
    id: "anime",
    label: "Modern Anime",
    suffix: "modern anime production art, polished cel shading, clean color design, expressive lighting",
  },
  {
    id: "webtoon",
    label: "Webtoon",
    suffix: "clean Korean webtoon illustration, crisp linework, flat colors, subtle gradients, polished character rendering",
  },
  {
    id: "manga",
    label: "Manga Color",
    suffix: "Japanese manga color illustration, refined ink lines, vibrant controlled palette, editorial finish",
  },
  {
    id: "anime90",
    label: "90s Anime",
    suffix: "1990s anime cel animation aesthetic, hand-painted background, warm film grain, classic color palette",
  },
  {
    id: "chibi",
    label: "Chibi",
    suffix: "cute chibi anime style, simplified shapes, bright colors, clean cel shading",
  },
  {
    id: "cinematic",
    label: "Cinematic",
    suffix: "cinematic animation concept art, dramatic composition, atmospheric lighting, high-end key visual",
  },
] as const;

const OUTPAINT_PRESETS = [
  { id: "16:9", label: "Animation 16:9", hint: "Widescreen shot" },
  { id: "4:5", label: "Poster 4:5", hint: "Cover / social" },
  { id: "9:16", label: "Vertical 9:16", hint: "Webtoon / short video" },
  { id: "1:1", label: "Square 1:1", hint: "Thumbnail / card" },
] as const;

function combinePrompt(prompt: string, styleId: string) {
  const style = SKETCH_STYLES.find((item) => item.id === styleId) || SKETCH_STYLES[0];
  return [prompt.trim(), style.suffix, "preserve the original pose and overall composition"].filter(Boolean).join(", ");
}

function UploadPanel({
  source,
  sourceName,
  onFile,
}: {
  source: string | null;
  sourceName: string;
  onFile: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  return (
    <div
      className={`creative-upload ${dragging ? "is-dragging" : ""}`}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        const file = event.dataTransfer.files?.[0];
        if (file) onFile(file);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onFile(file);
          event.currentTarget.value = "";
        }}
      />

      {source ? (
        <>
          <img src={source} alt="Creative source" className="creative-source-image" />
          <div className="creative-source-overlay">
            <div>
              <strong>{sourceName}</strong>
              <span>PNG, JPEG or WebP</span>
            </div>
            <button type="button" onClick={() => inputRef.current?.click()}>
              <RefreshCw size={15} /> Replace
            </button>
          </div>
        </>
      ) : (
        <button type="button" className="creative-empty-upload" onClick={() => inputRef.current?.click()}>
          <span className="creative-upload-icon"><Upload size={25} /></span>
          <strong>Upload a sketch or finished frame</strong>
          <span>Drop an image here or click to browse</span>
        </button>
      )}
    </div>
  );
}

export function CreativeStudioPage() {
  const location = useLocation();
  const initialState = (location.state || {}) as LocationState;
  const [mode, setMode] = useState<StudioMode>(initialState.mode || "sketch");
  const [source, setSource] = useState<string | null>(initialState.sourceImage || null);
  const [sourceName, setSourceName] = useState(initialState.sourceName || "FrameFlow frame");
  const [dimensions, setDimensions] = useState<ImageDimensions | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bedrockRegion, setBedrockRegion] = useState<string | null>(null);
  const [apiStatus, setApiStatus] = useState<"checking" | "ready" | "missing">("checking");

  const [prompt, setPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("blurry, malformed hands, extra fingers, duplicated objects, text, watermark");
  const [styleId, setStyleId] = useState("anime");
  const [controlStrength, setControlStrength] = useState(0.78);

  const [ratio, setRatio] = useState<"16:9" | "4:5" | "9:16" | "1:1">("16:9");
  const [creativity, setCreativity] = useState(0.45);
  const [outpaintPrompt, setOutpaintPrompt] = useState("Continue the environment naturally in the same animation style, lighting, perspective, and color palette.");
  const [manualExpansion, setManualExpansion] = useState({ left: 256, right: 256, up: 0, down: 0 });

  useEffect(() => {
    getBedrockStabilityStatus()
      .then((data) => {
        setBedrockRegion(data.region);
        setApiStatus("ready");
      })
      .catch(() => setApiStatus("missing"));
  }, []);

  useEffect(() => {
    if (!source) {
      setDimensions(null);
      return;
    }
    const image = new Image();
    image.onload = () => {
      const next = { width: image.naturalWidth, height: image.naturalHeight };
      setDimensions(next);
      if (mode === "outpaint") setManualExpansion(calculateExpansion(next, ratio));
    };
    image.src = source;
  }, [source]);

  useEffect(() => {
    if (mode === "outpaint" && dimensions) {
      setManualExpansion(calculateExpansion(dimensions, ratio));
    }
  }, [ratio, dimensions, mode]);

  const outputSize = useMemo(() => {
    if (!dimensions) return null;
    return {
      width: dimensions.width + manualExpansion.left + manualExpansion.right,
      height: dimensions.height + manualExpansion.up + manualExpansion.down,
    };
  }, [dimensions, manualExpansion]);

  function handleFile(file: File) {
    try {
      if (source?.startsWith("blob:")) URL.revokeObjectURL(source);
      const objectUrl = fileToObjectUrl(file);
      setSource(objectUrl);
      setSourceName(file.name);
      setResult(null);
      setError(null);
    } catch (fileError) {
      setError((fileError as Error).message);
    }
  }

  async function handleGenerate() {
    if (!source) {
      setError("Upload an image first.");
      return;
    }
    if (mode === "sketch" && !prompt.trim()) {
      setError("Describe the character, colors, clothing, or scene you want to generate.");
      return;
    }

    setIsGenerating(true);
    setError(null);
    try {
      const optimized = await optimizeImageSource(source);
      setDimensions(optimized.dimensions);

      if (mode === "sketch") {
        const response = await generateSketchConcept({
          imageDataUrl: optimized.dataUrl,
          prompt: combinePrompt(prompt, styleId),
          negativePrompt,
          controlStrength,
        });
        setResult(response.imageDataUrl);
      } else {
        const expansion = dimensions
          ? manualExpansion
          : calculateExpansion(optimized.dimensions, ratio);
        const response = await expandScene({
          imageDataUrl: optimized.dataUrl,
          prompt: outpaintPrompt,
          creativity,
          ...expansion,
        });
        setResult(response.imageDataUrl);
      }
    } catch (generationError) {
      setError((generationError as Error).message || "Generation failed");
    } finally {
      setIsGenerating(false);
    }
  }

  function useResultForOutpaint() {
    if (!result) return;
    setSource(result);
    setSourceName("AI sketch concept.png");
    setMode("outpaint");
    setResult(null);
    setError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="creative-page">
      <ProjectsHeader />

      <main className="creative-shell">
        <section className="creative-hero">
          <div>
            <span className="creative-kicker"><WandSparkles size={15} /> AI Creative Studio</span>
            <h1>Creative generation tools for animation workflows.</h1>
            <p>
              Explore a finished visual from a rough sketch, or expand a FrameFlow output into a cinematic shot, cover, or key visual.
            </p>
          </div>
          <div className={`creative-api-status ${apiStatus}`}>
            {apiStatus === "checking" && <Loader2 size={16} className="creative-spin" />}
            {apiStatus === "ready" && <CheckCircle2 size={16} />}
            {apiStatus === "missing" && <span className="creative-status-dot" />}
            <div>
              <strong>{apiStatus === "ready" ? "Bedrock backend ready" : apiStatus === "checking" ? "Checking API" : "Setup required"}</strong>
              <span>{apiStatus === "ready" ? `Stability Image Services · ${bedrockRegion || "configured region"}` : apiStatus === "missing" ? "Check ECS Task Role and Vercel backend URL" : "Verifying FrameFlow backend"}</span>
            </div>
          </div>
        </section>

        <section className="creative-mode-tabs" aria-label="Creative tools">
          <button className={mode === "sketch" ? "active" : ""} onClick={() => { setMode("sketch"); setResult(null); setError(null); }}>
            <Sparkles size={20} />
            <span><strong>AI Sketch Studio</strong><small>Rough sketch → finished color concept</small></span>
          </button>
          <button className={mode === "outpaint" ? "active" : ""} onClick={() => { setMode("outpaint"); setResult(null); setError(null); }}>
            <Expand size={20} />
            <span><strong>Cinematic Scene Expander</strong><small>Finished frame → wider animation asset</small></span>
          </button>
        </section>

        <section className="creative-workspace">
          <div className="creative-column">
            <div className="creative-card">
              <div className="creative-card-heading">
                <span className="creative-step">1</span>
                <div><h2>{mode === "sketch" ? "Upload a rough sketch" : "Choose a finished frame"}</h2><p>{mode === "sketch" ? "The sketch guides pose and composition." : "Use a FrameFlow output or upload another animation frame."}</p></div>
              </div>
              <UploadPanel source={source} sourceName={sourceName} onFile={handleFile} />
            </div>

            <div className="creative-card">
              <div className="creative-card-heading">
                <span className="creative-step">2</span>
                <div><h2>{mode === "sketch" ? "Direct the visual" : "Choose the new canvas"}</h2><p>{mode === "sketch" ? "Vietnamese prompts work best when you also include concrete visual details." : "The original image remains in the center while AI creates the new borders."}</p></div>
              </div>

              {mode === "sketch" ? (
                <div className="creative-form-stack">
                  <label className="creative-label">
                    Prompt
                    <textarea
                      value={prompt}
                      onChange={(event) => setPrompt(event.target.value)}
                      placeholder="Ví dụ: Nữ kiếm sĩ tóc đen, áo khoác đỏ, đứng trong ga tàu lúc hoàng hôn..."
                      rows={4}
                    />
                    <small>You may write Vietnamese or English. Style keywords are added in English automatically.</small>
                  </label>

                  <div>
                    <span className="creative-label-title">Animation style</span>
                    <div className="creative-style-grid">
                      {SKETCH_STYLES.map((style) => (
                        <button key={style.id} className={styleId === style.id ? "active" : ""} onClick={() => setStyleId(style.id)}>
                          <Palette size={14} /> {style.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <label className="creative-range-label">
                    <span><strong>Follow sketch</strong><em>{Math.round(controlStrength * 100)}%</em></span>
                    <input type="range" min="0" max="1" step="0.01" value={controlStrength} onChange={(event) => setControlStrength(Number(event.target.value))} />
                    <small>Higher values follow the uploaded sketch more closely.</small>
                  </label>

                  <details className="creative-advanced">
                    <summary>Advanced controls</summary>
                    <label className="creative-label">
                      Negative prompt
                      <textarea rows={3} value={negativePrompt} onChange={(event) => setNegativePrompt(event.target.value)} />
                    </label>
                  </details>
                </div>
              ) : (
                <div className="creative-form-stack">
                  <div>
                    <span className="creative-label-title">Target format</span>
                    <div className="creative-ratio-grid">
                      {OUTPAINT_PRESETS.map((preset) => (
                        <button key={preset.id} className={ratio === preset.id ? "active" : ""} onClick={() => setRatio(preset.id)}>
                          <strong>{preset.label}</strong><small>{preset.hint}</small>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="creative-dimensions">
                    {(["left", "right", "up", "down"] as const).map((direction) => (
                      <label key={direction}>
                        <span>{direction}</span>
                        <input
                          type="number"
                          min={0}
                          max={2000}
                          value={manualExpansion[direction]}
                          onChange={(event) => setManualExpansion((current) => ({ ...current, [direction]: Math.max(0, Math.min(2000, Number(event.target.value) || 0)) }))}
                        />
                        <small>px</small>
                      </label>
                    ))}
                  </div>

                  {dimensions && outputSize && (
                    <div className="creative-output-size">
                      Source {dimensions.width} × {dimensions.height} → Output approximately {outputSize.width} × {outputSize.height}
                    </div>
                  )}

                  <label className="creative-label">
                    Scene direction
                    <textarea rows={4} value={outpaintPrompt} onChange={(event) => setOutpaintPrompt(event.target.value)} />
                  </label>

                  <label className="creative-range-label">
                    <span><strong>Creativity</strong><em>{Math.round(creativity * 100)}%</em></span>
                    <input type="range" min="0.1" max="1" step="0.01" value={creativity} onChange={(event) => setCreativity(Number(event.target.value))} />
                    <small>Lower values usually create a safer, more continuous extension.</small>
                  </label>
                </div>
              )}
            </div>

            {error && <div className="creative-error">{error}</div>}

            <button
              className="creative-generate-button"
              onClick={handleGenerate}
              disabled={isGenerating || !source || apiStatus === "missing"}
            >
              {isGenerating ? <Loader2 size={19} className="creative-spin" /> : mode === "sketch" ? <Sparkles size={19} /> : <Expand size={19} />}
              {isGenerating ? "Generating…" : mode === "sketch" ? "Generate color concept" : "Expand animation scene"}
              {!isGenerating && <ArrowRight size={18} />}
            </button>
          </div>

          <div className="creative-column creative-result-column">
            <div className="creative-result-card">
              <div className="creative-result-header">
                <div><span className="creative-step">3</span><div><h2>Generated result</h2><p>Review before downloading or using it in another creative tool.</p></div></div>
                {result && <button onClick={() => downloadDataUrl(result, mode === "sketch" ? "frameflow-ai-sketch.png" : "frameflow-expanded-scene.png")}><Download size={15} /> Download</button>}
              </div>

              <div className={`creative-result-stage ${result ? "has-result" : ""}`}>
                {isGenerating ? (
                  <div className="creative-loading-state">
                    <span><Loader2 size={34} className="creative-spin" /></span>
                    <strong>Creating your animation asset</strong>
                    <p>FrameFlow is sending the optimized image to Stability AI through Amazon Bedrock.</p>
                  </div>
                ) : result ? (
                  <img src={result} alt="Generated creative result" />
                ) : (
                  <div className="creative-placeholder-state">
                    {mode === "sketch" ? <ImagePlus size={38} /> : <Expand size={38} />}
                    <strong>{mode === "sketch" ? "Your finished concept will appear here" : "Your expanded scene will appear here"}</strong>
                    <p>The generated image is a creative asset, not a replacement for FrameFlow's deterministic sequence-coloring output.</p>
                  </div>
                )}
              </div>

              {result && (
                <div className="creative-result-actions">
                  <button onClick={() => downloadDataUrl(result, mode === "sketch" ? "frameflow-ai-sketch.png" : "frameflow-expanded-scene.png")}>
                    <Download size={16} /> Download PNG
                  </button>
                  {mode === "sketch" && (
                    <button className="primary" onClick={useResultForOutpaint}>
                      <Expand size={16} /> Expand this concept
                    </button>
                  )}
                  <button onClick={handleGenerate}><RefreshCw size={16} /> Generate another</button>
                </div>
              )}
            </div>

            <div className="creative-safety-note">
              <WandSparkles size={18} />
              <div><strong>Creative side tool</strong><p>These features intentionally allow generative changes. Keep using Auto Color Sequence for lineart-preserving production frames.</p></div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
