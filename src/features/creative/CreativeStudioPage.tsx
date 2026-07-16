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
  X,
} from "lucide-react";
import { ProjectsHeader } from "@/features/projects/components/ProjectsHeader";
import { useEntitlements } from "@/features/account/hooks/useEntitlements";
import { UsageCard } from "@/features/account/components/UsageCard";
import {
  analyzeSketch,
  getBedrockStabilityStatus,
  type SketchAnalysisResponse,
} from "./services/stability.api";
import {
  cancelCreativeJob,
  createCreativeJob,
  getCreativeJob,
  type CreativeJob,
} from "./services/creativeJobs.api";
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
  projectId?: string | null;
  frameId?: string | null;
  returnTo?: string | null;
};

type StyleConfig = {
  id: string;
  label: string;
  stylePreset: string;
  promptStyle: string;
  defaultPalette: string;
  defaultEnvironment: string;
  defaultLighting: string;
  defaultMood: string;
  defaultAdditional: string;
  negativeAddon: string;
};

type SketchDetails = {
  subject: string;
  composition: string;
  preserveDetails: string;
  colorPalette: string;
  environment: string;
  lighting: string;
  mood: string;
  additionalInstructions: string;
};

const SKETCH_STYLES: StyleConfig[] = [
  {
    id: "anime",
    label: "Modern Anime",
    stylePreset: "anime",
    promptStyle: "Modern anime illustration with clean 2D lineart, polished cel shading, and a presentation-quality character design finish.",
    defaultPalette: "Use a modern anime palette with clear local colors, appealing contrast, and simple cel-shaded color blocking.",
    defaultEnvironment: "Keep the background simple and unobtrusive so the subject remains the focus.",
    defaultLighting: "Use soft, even lighting with restrained cel shading and no realistic heavy shadows.",
    defaultMood: "Polished, expressive, and clean.",
    defaultAdditional: "Preserve the recognizable design and keep the rendering crisp, readable, and production-friendly.",
    negativeAddon: "realistic skin pores, live-action cinematic rendering",
  },
  {
    id: "webtoon",
    label: "Webtoon",
    stylePreset: "comic-book",
    promptStyle: "Clean webtoon illustration with crisp linework, readable silhouettes, and polished 2D comic rendering.",
    defaultPalette: "Use a clean webtoon palette with controlled flats, subtle gradients only when helpful, and strong visual readability.",
    defaultEnvironment: "Keep the environment simple and elegant, suitable for a refined webtoon panel.",
    defaultLighting: "Use clear soft lighting with limited shading complexity.",
    defaultMood: "Stylish, approachable, and readable.",
    defaultAdditional: "Prioritize clear facial features, clean shapes, and a webtoon-friendly finish.",
    negativeAddon: "oil painting, gritty texture, chaotic shadows",
  },
  {
    id: "manga",
    label: "Manga Color",
    stylePreset: "line-art",
    promptStyle: "Colored manga illustration with refined ink lines, controlled flats, and a polished editorial finish.",
    defaultPalette: "Use a disciplined manga color palette with clean flat colors and tasteful accent colors.",
    defaultEnvironment: "Maintain a minimal illustrated background that supports the main subject without clutter.",
    defaultLighting: "Use soft editorial lighting with minimal complex shading.",
    defaultMood: "Refined, illustrative, and clean.",
    defaultAdditional: "Preserve the inked drawing character and avoid over-rendering.",
    negativeAddon: "watercolor bleeding, painterly brush strokes, thick impasto texture",
  },
  {
    id: "anime90",
    label: "90s Anime",
    stylePreset: "anime",
    promptStyle: "1990s anime cel-animation style with clean lineart, nostalgic color treatment, and a classic hand-crafted feel.",
    defaultPalette: "Use a nostalgic cel-animation palette with warm classic anime colors and clean flat fills.",
    defaultEnvironment: "Keep the background simple with a classic animation sensibility.",
    defaultLighting: "Use warm gentle lighting with limited cel-style shadow shapes.",
    defaultMood: "Nostalgic, warm, and charming.",
    defaultAdditional: "Retain a classic anime feel without making the output look old or degraded.",
    negativeAddon: "modern hyper-rendering, glossy 3D look",
  },
  {
    id: "chibi",
    label: "Chibi",
    stylePreset: "anime",
    promptStyle: "Cute chibi illustration with simplified proportions, clean shapes, and polished flat-color rendering.",
    defaultPalette: "Use bright friendly colors with soft pastel accents and high clarity.",
    defaultEnvironment: "Keep the environment minimal, playful, and uncluttered.",
    defaultLighting: "Use bright soft lighting with very simple shadows.",
    defaultMood: "Cute, cheerful, and lighthearted.",
    defaultAdditional: "If appropriate, slightly simplify small details to keep the design adorable and readable.",
    negativeAddon: "grim realism, dark gritty rendering",
  },
  {
    id: "cinematic",
    label: "Cinematic",
    stylePreset: "cinematic",
    promptStyle: "Cinematic animation concept art with clean lineart, strong composition, and polished key-visual quality.",
    defaultPalette: "Use a cinematic animation palette with thoughtful contrast, clean local colors, and tasteful atmosphere.",
    defaultEnvironment: "Allow simple atmospheric background support while keeping the main sketch composition readable.",
    defaultLighting: "Use soft directional lighting with tasteful depth but avoid photorealism.",
    defaultMood: "Atmospheric, story-driven, and polished.",
    defaultAdditional: "Create a key-visual feel while preserving the uploaded sketch structure.",
    negativeAddon: "photographic realism, lens artifacts, live-action look",
  },
];

const OUTPAINT_PRESETS = [
  { id: "16:9", label: "Animation 16:9", hint: "Widescreen shot" },
  { id: "4:5", label: "Poster 4:5", hint: "Cover / social" },
  { id: "9:16", label: "Vertical 9:16", hint: "Webtoon / short video" },
  { id: "1:1", label: "Square 1:1", hint: "Thumbnail / card" },
] as const;

const BASE_NEGATIVE_PROMPT = [
  "photorealistic",
  "3D render",
  "hyper-detailed realistic rendering",
  "blurry lines",
  "messy linework",
  "scratchy strokes",
  "unfinished sketch",
  "heavy gradients",
  "complex realistic lighting",
  "distorted anatomy",
  "extra limbs",
  "duplicated elements",
  "unrelated objects",
  "text",
  "watermark",
  "logo",
  "low resolution",
].join(", ");

function getStyleConfig(styleId: string) {
  return SKETCH_STYLES.find((item) => item.id === styleId) || SKETCH_STYLES[0];
}

function buildNegativePrompt(styleId: string) {
  const style = getStyleConfig(styleId);
  return `${BASE_NEGATIVE_PROMPT}, ${style.negativeAddon}`;
}

function fallbackAnalysis(styleId: string): SketchAnalysisResponse {
  const style = getStyleConfig(styleId);
  return {
    ok: true,
    provider: "frameflow_fallback",
    model_id: null,
    subject: "The uploaded image appears to be a hand-drawn sketch of a character or scene.",
    composition: "Preserve the original composition, pose, proportions, and placement of the main elements from the sketch.",
    preserve_details: [
      "Preserve the recognizable silhouette and important defining features",
      "Keep the visible pose and placement of the main subject",
      "Maintain the overall structure of the uploaded sketch",
    ],
    suggested_palette: style.defaultPalette,
    environment: style.defaultEnvironment,
    lighting: style.defaultLighting,
    mood: style.defaultMood,
    confidence: 0.45,
    uncertain_details: ["The automatic sketch analysis used a generic fallback."],
  };
}

function mergeStyleGuidance(template: string, detected?: string | null) {
  const extra = String(detected || "").trim();
  if (!extra || extra === template) return template;
  return `${template} Subject-specific guidance: ${extra}`;
}

function detailsFromAnalysis(analysis: SketchAnalysisResponse, styleId: string): SketchDetails {
  const style = getStyleConfig(styleId);
  return {
    subject: analysis.subject,
    composition: analysis.composition,
    preserveDetails: (analysis.preserve_details || []).join("\n"),
    colorPalette: mergeStyleGuidance(style.defaultPalette, analysis.suggested_palette),
    environment: mergeStyleGuidance(style.defaultEnvironment, analysis.environment),
    lighting: mergeStyleGuidance(style.defaultLighting, analysis.lighting),
    mood: mergeStyleGuidance(style.defaultMood, analysis.mood),
    additionalInstructions: style.defaultAdditional,
  };
}

function buildSketchPrompt(details: SketchDetails, styleId: string) {
  const style = getStyleConfig(styleId);
  const preserve = details.preserveDetails
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join(", ");

  return [
    "Create a polished clean-line 2D concept illustration based on the uploaded sketch.",
    `Main subject: ${details.subject}`,
    `Composition: ${details.composition}`,
    `Important visible details to preserve: ${preserve || "Preserve the important visible details from the sketch."}`,
    "Lineart: Refine the rough sketch into precise, clean, defined lineart with smooth, consistent contours and neat inked lines while preserving the original structure.",
    `Art style: ${style.promptStyle}`,
    `Color treatment: Use simple flat colors, controlled color blocking, and restrained cel shading. ${details.colorPalette}`,
    `Environment: ${details.environment}`,
    `Lighting: ${details.lighting}`,
    `Mood: ${details.mood}`,
    details.additionalInstructions ? `Additional direction: ${details.additionalInstructions}` : "",
    "Output quality: High-definition, presentation-quality concept art with a clean 2D illustration finish. Do not add unrelated objects or significantly change the original sketch design.",
  ].filter(Boolean).join("\n\n");
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
  const { entitlements, refresh: refreshEntitlements } = useEntitlements();
  const initialState = (location.state || {}) as LocationState;
  const [mode, setMode] = useState<StudioMode>(initialState.mode || "sketch");
  const [source, setSource] = useState<string | null>(initialState.sourceImage || null);
  const [sourceName, setSourceName] = useState(initialState.sourceName || "FrameFlow frame");
  const [dimensions, setDimensions] = useState<ImageDimensions | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [activeJob, setActiveJob] = useState<CreativeJob | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<SketchAnalysisResponse | null>(null);
  const [bedrockRegion, setBedrockRegion] = useState<string | null>(null);
  const [backendMessage, setBackendMessage] = useState<string | null>(null);
  const [apiStatus, setApiStatus] = useState<"checking" | "ready" | "missing">("checking");

  const [styleId, setStyleId] = useState("anime");
  const [negativePrompt, setNegativePrompt] = useState(buildNegativePrompt("anime"));
  const [controlStrength, setControlStrength] = useState(0.9);
  const [details, setDetails] = useState<SketchDetails>(() => detailsFromAnalysis(fallbackAnalysis("anime"), "anime"));

  const [ratio, setRatio] = useState<"16:9" | "4:5" | "9:16" | "1:1">("16:9");
  const [creativity, setCreativity] = useState(0.45);
  const [outpaintPrompt, setOutpaintPrompt] = useState("Continue the environment naturally in the same animation style, lighting, perspective, and color palette.");
  const [manualExpansion, setManualExpansion] = useState({ left: 256, right: 256, up: 0, down: 0 });

  const sourceRef = useRef<string | null>(null);
  const resultRef = useRef<string | null>(null);
  const activeJobStorageKey = "frameflow.creative.activeJob";

  const activeStyle = useMemo(() => getStyleConfig(styleId), [styleId]);
  const promptPreview = useMemo(() => buildSketchPrompt(details, styleId), [details, styleId]);
  const isGenerating = activeJob?.status === "queued" || activeJob?.status === "processing";
  const isBusy = isSubmitting || isGenerating || isAnalyzing;
  const generationProgress = activeJob?.progress ?? 0;
  const creditCost = mode === "sketch" ? (entitlements?.creativeCosts.sketch ?? 15) : (entitlements?.creativeCosts.outpaint ?? 20);
  const creditsRemaining = entitlements?.usage.creativeCreditsRemaining ?? 0;
  const hasEnoughCredits = Boolean(entitlements && creditsRemaining >= creditCost);

  useEffect(() => {
    sourceRef.current = source;
  }, [source]);

  useEffect(() => {
    resultRef.current = result;
  }, [result]);

  useEffect(() => {
    return () => {
      if (sourceRef.current?.startsWith("blob:")) URL.revokeObjectURL(sourceRef.current);
      if (resultRef.current?.startsWith("blob:")) URL.revokeObjectURL(resultRef.current);
    };
  }, []);

  useEffect(() => {
    getBedrockStabilityStatus()
      .then((data) => {
        setBedrockRegion(data.region);
        const worker = data.creative_worker;
        if (worker && (!worker.enabled || !worker.queue_configured || !worker.supabase_configured || !worker.running)) {
          setApiStatus("missing");
          setBackendMessage("Async Creative Worker is not ready. Check ECS queue and Supabase environment variables.");
          return;
        }
        setApiStatus("ready");
        setBackendMessage(null);
      })
      .catch((statusError) => {
        setApiStatus("missing");
        setBackendMessage((statusError as Error).message || "Creative backend is unavailable.");
      });
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function resumeActiveJob() {
      const raw = window.localStorage.getItem(activeJobStorageKey);
      if (!raw) return;
      try {
        const stored = JSON.parse(raw) as { jobId?: string; projectId?: string | null };
        if (!stored.jobId) return;
        if (stored.projectId && initialState.projectId && stored.projectId !== initialState.projectId) return;
        const response = await getCreativeJob(stored.jobId);
        if (cancelled) return;
        setActiveJob(response.job);
      void refreshEntitlements(true);
        setMode(response.job.jobType);
        if (response.job.status === "completed" && response.job.resultUrl) {
          setResult(response.job.resultUrl);
        } else if (response.job.status === "failed") {
          setError(response.job.error || "The previous generation failed.");
          window.localStorage.removeItem(activeJobStorageKey);
        } else if (response.job.status === "cancelled") {
          window.localStorage.removeItem(activeJobStorageKey);
        }
      } catch {
        window.localStorage.removeItem(activeJobStorageKey);
      }
    }
    resumeActiveJob();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!activeJob || !["queued", "processing"].includes(activeJob.status)) return;
    let cancelled = false;
    let timeoutId: number | null = null;

    const poll = async () => {
      try {
        const response = await getCreativeJob(activeJob.id);
        if (cancelled) return;
        const next = response.job;
        setActiveJob(next);
        if (next.status === "completed" && next.resultUrl) {
          setResult(next.resultUrl);
          setError(null);
          void refreshEntitlements(true);
          return;
        }
        if (next.status === "failed") {
          setError(next.error || "Generation failed.");
          window.localStorage.removeItem(activeJobStorageKey);
          return;
        }
        if (next.status === "cancelled") {
          setError("Generation cancelled. Reserved credits were returned.");
      void refreshEntitlements(true);
          window.localStorage.removeItem(activeJobStorageKey);
          return;
        }
        timeoutId = window.setTimeout(poll, 2000);
      } catch (pollError) {
        if (cancelled) return;
        setError((pollError as Error).message || "Unable to refresh generation status.");
        timeoutId = window.setTimeout(poll, 4000);
      }
    };

    timeoutId = window.setTimeout(poll, 1200);
    return () => {
      cancelled = true;
      if (timeoutId !== null) window.clearTimeout(timeoutId);
    };
  }, [activeJob?.id, activeJob?.status, refreshEntitlements]);

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
  }, [source, mode, ratio]);

  useEffect(() => {
    if (mode === "outpaint" && dimensions) setManualExpansion(calculateExpansion(dimensions, ratio));
  }, [ratio, dimensions, mode]);

  useEffect(() => {
    setNegativePrompt(buildNegativePrompt(styleId));
    const styled = detailsFromAnalysis(analysis || fallbackAnalysis(styleId), styleId);
    setDetails((current) => ({
      ...current,
      colorPalette: styled.colorPalette,
      environment: styled.environment,
      lighting: styled.lighting,
      mood: styled.mood,
      additionalInstructions: styled.additionalInstructions,
    }));
  }, [styleId, activeStyle, analysis]);

  useEffect(() => {
    let cancelled = false;
    async function runAnalysis() {
      if (mode !== "sketch" || !source) return;
      setIsAnalyzing(true);
      setAnalysisError(null);
      try {
        const optimized = await optimizeImageSource(source);
        if (cancelled) return;
        setDimensions(optimized.dimensions);
        const response = await analyzeSketch({ imageDataUrl: optimized.dataUrl, styleHint: styleId });
        if (cancelled) return;
        setAnalysis(response);
        setDetails(detailsFromAnalysis(response, styleId));
      } catch (analysisIssue) {
        if (cancelled) return;
        const fallback = fallbackAnalysis(styleId);
        setAnalysis(fallback);
        setDetails(detailsFromAnalysis(fallback, styleId));
        setAnalysisError((analysisIssue as Error).message || "Sketch analysis is temporarily unavailable.");
      } finally {
        if (!cancelled) setIsAnalyzing(false);
      }
    }
    runAnalysis();
    return () => {
      cancelled = true;
    };
  }, [source, mode]);

  const outputSize = useMemo(() => {
    if (!dimensions) return null;
    return {
      width: dimensions.width + manualExpansion.left + manualExpansion.right,
      height: dimensions.height + manualExpansion.up + manualExpansion.down,
    };
  }, [dimensions, manualExpansion]);

  function clearActiveJob() {
    setActiveJob(null);
    window.localStorage.removeItem(activeJobStorageKey);
  }

  function switchMode(nextMode: StudioMode) {
    if (isGenerating || isSubmitting) return;
    if (result?.startsWith("blob:")) URL.revokeObjectURL(result);
    setResult(null);
    clearActiveJob();
    setMode(nextMode);
    setError(null);
  }

  function handleFile(file: File) {
    try {
      if (isGenerating && activeJob) cancelCreativeJob(activeJob.id).catch(() => null);
      clearActiveJob();
      if (source?.startsWith("blob:")) URL.revokeObjectURL(source);
      if (result?.startsWith("blob:")) URL.revokeObjectURL(result);
      setResult(null);
      const objectUrl = fileToObjectUrl(file);
      setSource(objectUrl);
      setSourceName(file.name);
      setError(null);
      setAnalysis(null);
      setAnalysisError(null);
    } catch (fileError) {
      setError((fileError as Error).message);
    }
  }

  async function handleGenerate() {
    if (isBusy) return;
    if (!source) {
      setError("Upload an image first.");
      return;
    }
    if (!hasEnoughCredits) {
      setError(`This action requires ${creditCost} Creative Credits. You currently have ${creditsRemaining}.`);
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const optimized = await optimizeImageSource(source);
      setDimensions(optimized.dimensions);
      if (result?.startsWith("blob:")) URL.revokeObjectURL(result);
      setResult(null);
      const expansion = dimensions ? manualExpansion : calculateExpansion(optimized.dimensions, ratio);

      const response = await createCreativeJob({
        jobType: mode,
        imageDataUrl: optimized.dataUrl,
        prompt: mode === "sketch" ? promptPreview : outpaintPrompt,
        negativePrompt: mode === "sketch" ? negativePrompt : null,
        controlStrength: mode === "sketch" ? controlStrength : undefined,
        stylePreset: mode === "sketch" ? activeStyle.stylePreset : null,
        styleId: mode === "sketch" ? styleId : null,
        visualStyleLabel: mode === "sketch" ? activeStyle.label : null,
        left: mode === "outpaint" ? expansion.left : undefined,
        right: mode === "outpaint" ? expansion.right : undefined,
        up: mode === "outpaint" ? expansion.up : undefined,
        down: mode === "outpaint" ? expansion.down : undefined,
        creativity: mode === "outpaint" ? creativity : undefined,
        sourceName,
        projectId: initialState.projectId || null,
        frameId: initialState.frameId || null,
        analysis: mode === "sketch" ? analysis : null,
      });

      setActiveJob(response.job);
      window.localStorage.setItem(activeJobStorageKey, JSON.stringify({
        jobId: response.job.id,
        projectId: initialState.projectId || null,
      }));
    } catch (generationError) {
      setError((generationError as Error).message || "Unable to start generation.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCancelGeneration() {
    if (!activeJob || !isGenerating) return;
    try {
      const response = await cancelCreativeJob(activeJob.id);
      setActiveJob(response.job);
      window.localStorage.removeItem(activeJobStorageKey);
      setError("Generation cancelled. Reserved credits were returned.");
      void refreshEntitlements(true);
    } catch (cancelError) {
      setError((cancelError as Error).message || "Unable to cancel generation.");
    }
  }

  function useResultForOutpaint() {
    if (!result) return;
    if (source?.startsWith("blob:")) URL.revokeObjectURL(source);
    setSource(result);
    setSourceName("AI sketch output.png");
    clearActiveJob();
    setMode("outpaint");
    setResult(null);
    setError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="creative-page">
      <ProjectsHeader />

      <main className="creative-shell">
        {entitlements && <div style={{ marginBottom: 22 }}><UsageCard entitlements={entitlements} /></div>}
        <section className="creative-hero">
          <div>
            <span className="creative-kicker"><WandSparkles size={15} /> AI Creative Studio</span>
            <h1>Creative generation tools for animation workflows.</h1>
            <p>Explore a finished visual from a rough sketch, or expand a FrameFlow output into a cinematic shot, cover, or key visual.</p>
          </div>
          <div className={`creative-api-status ${apiStatus}`}>
            {apiStatus === "checking" && <Loader2 size={16} className="creative-spin" />}
            {apiStatus === "ready" && <CheckCircle2 size={16} />}
            {apiStatus === "missing" && <span className="creative-status-dot" />}
            <div>
              <strong>{apiStatus === "ready" ? "Async backend ready" : apiStatus === "checking" ? "Checking API" : "Setup required"}</strong>
              <span>{apiStatus === "ready" ? `Queue worker · ${bedrockRegion || "configured region"}` : backendMessage || "Verifying FrameFlow backend"}</span>
            </div>
          </div>
        </section>

        <section className="creative-mode-tabs" aria-label="Creative tools">
          <button disabled={isGenerating || isSubmitting} className={mode === "sketch" ? "active" : ""} onClick={() => switchMode("sketch")}>
            <Sparkles size={20} />
            <span><strong>AI Sketch Studio</strong><small>Sketch → finished concept artwork</small></span>
          </button>
          <button disabled={isGenerating || isSubmitting} className={mode === "outpaint" ? "active" : ""} onClick={() => switchMode("outpaint")}>
            <Expand size={20} />
            <span><strong>Cinematic Scene Expander</strong><small>Finished frame → wider scene asset</small></span>
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
              {mode === "sketch" && source && (
                <div className={`creative-analysis-note ${analysisError ? "warning" : ""}`}>
                  {isAnalyzing ? (
                    <><Loader2 size={14} className="creative-spin" /><span>Analyzing your sketch with Amazon Nova…</span></>
                  ) : analysis ? (
                    <><CheckCircle2 size={14} /><span>Sketch analysis ready {analysis.provider === "amazon_bedrock_nova" ? "· Amazon Nova" : "· fallback template"}</span></>
                  ) : null}
                </div>
              )}
              {mode === "sketch" && analysisError && <div className="creative-inline-note">{analysisError}</div>}
            </div>

            <div className="creative-card">
              <div className="creative-card-heading">
                <span className="creative-step">2</span>
                <div><h2>{mode === "sketch" ? "Set the visual direction" : "Choose the new canvas"}</h2><p>{mode === "sketch" ? "Select a style, control how closely the sketch is followed, and optionally adjust AI-detected details." : "The original image remains in the center while AI creates the new borders."}</p></div>
              </div>

              {mode === "sketch" ? (
                <div className="creative-form-stack">
                  <div>
                    <span className="creative-label-title">Visual Style</span>
                    <div className="creative-style-grid">
                      {SKETCH_STYLES.map((style) => (
                        <button key={style.id} type="button" className={styleId === style.id ? "active" : ""} onClick={() => setStyleId(style.id)}>
                          <Palette size={14} /> {style.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <label className="creative-range-label">
                    <span><strong>Follow Sketch</strong><em>{Math.round(controlStrength * 100)}%</em></span>
                    <input type="range" min="0.6" max="1" step="0.01" value={controlStrength} onChange={(event) => setControlStrength(Number(event.target.value))} />
                    <small>Higher values follow the uploaded sketch more closely.</small>
                  </label>

                  <details className="creative-advanced creative-details-panel">
                    <summary>Customize Details</summary>
                    <div className="creative-detail-grid">
                      <label className="creative-label">Detected Subject<textarea rows={3} value={details.subject} onChange={(event) => setDetails((current) => ({ ...current, subject: event.target.value }))} /></label>
                      <label className="creative-label">Composition<textarea rows={3} value={details.composition} onChange={(event) => setDetails((current) => ({ ...current, composition: event.target.value }))} /></label>
                      <label className="creative-label">Details to Preserve<textarea rows={5} value={details.preserveDetails} onChange={(event) => setDetails((current) => ({ ...current, preserveDetails: event.target.value }))} /><small>Use one line per detail for easier editing.</small></label>
                      <label className="creative-label">Color Palette<textarea rows={4} value={details.colorPalette} onChange={(event) => setDetails((current) => ({ ...current, colorPalette: event.target.value }))} /></label>
                      <label className="creative-label">Environment<textarea rows={3} value={details.environment} onChange={(event) => setDetails((current) => ({ ...current, environment: event.target.value }))} /></label>
                      <div className="creative-inline-fields">
                        <label className="creative-label">Lighting<textarea rows={2} value={details.lighting} onChange={(event) => setDetails((current) => ({ ...current, lighting: event.target.value }))} /></label>
                        <label className="creative-label">Mood<textarea rows={2} value={details.mood} onChange={(event) => setDetails((current) => ({ ...current, mood: event.target.value }))} /></label>
                      </div>
                      <label className="creative-label">Additional Instructions<textarea rows={3} value={details.additionalInstructions} onChange={(event) => setDetails((current) => ({ ...current, additionalInstructions: event.target.value }))} /></label>
                      <label className="creative-label">Prompt Preview<textarea rows={10} value={promptPreview} readOnly /><small>The final prompt is generated automatically from the fields above and the selected visual style.</small></label>
                    </div>
                  </details>

                  <details className="creative-advanced">
                    <summary>Advanced Controls</summary>
                    <label className="creative-label">Negative Prompt<textarea rows={4} value={negativePrompt} onChange={(event) => setNegativePrompt(event.target.value)} /></label>
                  </details>
                </div>
              ) : (
                <div className="creative-form-stack">
                  <div>
                    <span className="creative-label-title">Target format</span>
                    <div className="creative-ratio-grid">
                      {OUTPAINT_PRESETS.map((preset) => (
                        <button key={preset.id} type="button" className={ratio === preset.id ? "active" : ""} onClick={() => setRatio(preset.id)}>
                          <strong>{preset.label}</strong><small>{preset.hint}</small>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="creative-dimensions">
                    {(["left", "right", "up", "down"] as const).map((direction) => (
                      <label key={direction}>
                        <span>{direction}</span>
                        <input type="number" min={0} max={2000} value={manualExpansion[direction]} onChange={(event) => setManualExpansion((current) => ({ ...current, [direction]: Math.max(0, Math.min(2000, Number(event.target.value) || 0)) }))} />
                        <small>px</small>
                      </label>
                    ))}
                  </div>
                  {dimensions && outputSize && <div className="creative-output-size">Source {dimensions.width} × {dimensions.height} → Output approximately {outputSize.width} × {outputSize.height}</div>}
                  <label className="creative-label">Scene direction<textarea rows={4} value={outpaintPrompt} onChange={(event) => setOutpaintPrompt(event.target.value)} /></label>
                  <label className="creative-range-label">
                    <span><strong>Creativity</strong><em>{Math.round(creativity * 100)}%</em></span>
                    <input type="range" min="0.1" max="1" step="0.01" value={creativity} onChange={(event) => setCreativity(Number(event.target.value))} />
                    <small>Lower values usually create a safer, more continuous extension.</small>
                  </label>
                </div>
              )}
            </div>

            {error && <div className="creative-error">{error}</div>}

            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, margin: "12px 0 8px", fontSize: 12, color: "#AAB2D5" }}>
              <span>{mode === "sketch" ? "Generate Artwork" : "Expand Scene"}: <strong style={{ color: "#F5F3FF" }}>{creditCost} Creative Credits</strong></span>
              <span>Available: <strong style={{ color: hasEnoughCredits ? "#4ADE80" : "#FB7185" }}>{creditsRemaining}</strong></span>
            </div>
            <button className="creative-generate-button" onClick={handleGenerate} disabled={isBusy || !source || apiStatus === "missing" || !hasEnoughCredits}>
              {isBusy ? <Loader2 size={19} className="creative-spin" /> : mode === "sketch" ? <Sparkles size={19} /> : <Expand size={19} />}
              {isSubmitting ? "Starting job…" : isGenerating ? `${activeJob?.status === "queued" ? "Queued" : "Generating"} · ${generationProgress}%` : isAnalyzing ? "Analyzing sketch…" : mode === "sketch" ? "Generate Artwork" : "Expand Scene"}
              {!isBusy && <ArrowRight size={18} />}
            </button>
          </div>

          <div className="creative-column creative-result-column">
            <div className="creative-result-card">
              <div className="creative-result-header">
                <div><span className="creative-step">3</span><div><h2>Generated result</h2><p>Jobs continue in the background, even if you reload this page.</p></div></div>
                {result && <button onClick={() => downloadDataUrl(result, mode === "sketch" ? "frameflow-ai-sketch.png" : "frameflow-expanded-scene.png")}><Download size={15} /> Download</button>}
              </div>

              <div className={`creative-result-stage ${result ? "has-result" : ""}`}>
                {isSubmitting || isGenerating ? (
                  <div className="creative-loading-state">
                    <span><Loader2 size={34} className="creative-spin" /></span>
                    <strong>{isSubmitting ? "Preparing your job" : activeJob?.status === "queued" ? "Waiting for the creative worker" : mode === "sketch" ? "Creating your artwork" : "Expanding your scene"}</strong>
                    <p>Your job is safely stored. Reloading the page will not lose the generation.</p>
                    <div className="creative-job-progress"><span style={{ width: `${Math.max(5, generationProgress)}%` }} /></div>
                    <small>{isSubmitting ? "Uploading optimized source…" : `${generationProgress}% complete · attempt ${activeJob?.attemptCount || 0}`}</small>
                    {activeJob && isGenerating && <button type="button" className="creative-cancel-job" onClick={handleCancelGeneration}><X size={14} /> Cancel generation</button>}
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
                  <button onClick={() => downloadDataUrl(result, mode === "sketch" ? "frameflow-ai-sketch.png" : "frameflow-expanded-scene.png")}><Download size={16} /> Download PNG</button>
                  {mode === "sketch" && <button className="primary" onClick={useResultForOutpaint}><Expand size={16} /> Expand this artwork</button>}
                  <button onClick={handleGenerate} disabled={isBusy}><RefreshCw size={16} /> Generate another</button>
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
