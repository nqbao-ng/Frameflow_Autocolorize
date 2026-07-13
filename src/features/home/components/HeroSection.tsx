import { Link } from "react-router";
import {
  ArrowRight,
  Check,
  CircleCheck,
  Layers3,
  Play,
  ScanSearch,
  Sparkles,
} from "lucide-react";
import { HERO_IMG, HERO_TRUST_BADGES } from "../constants/homeData";
import { FloatingSketch } from "./FloatingSketch";

export function HeroSection() {
  return (
    <section className="landing-hero">
      <FloatingSketch
        src="/landing/sketch-princess-white.png"
        className="landing-sketch-hero"
      />

      <div className="landing-hero-grid">
        <div className="landing-hero-copy">
          <div className="landing-kicker">
            <Sparkles size={14} />
            Keyframe-guided color propagation
          </div>

          <h1 className="landing-hero-title">
            Color one keyframe.
            <span> Keep the whole sequence consistent.</span>
          </h1>

          <p className="landing-hero-subtitle">
            FrameFlow preserves your original sketch, propagates color with Computer Vision,
            and pauses for human correction whenever confidence drops.
          </p>

          <div className="landing-hero-actions">
            <Link to="/signup" className="landing-button landing-button-primary">
              Start a project <ArrowRight size={17} />
            </Link>
            <a href="#workflow" className="landing-button landing-button-ghost">
              <Play size={16} fill="currentColor" /> View workflow
            </a>
          </div>

          <div className="landing-trust-row">
            {HERO_TRUST_BADGES.map((text) => (
              <div key={text} className="landing-trust-item">
                <Check size={14} strokeWidth={2.8} />
                <span>{text}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="landing-editor-wrap">
          <div className="landing-editor-glow" />
          <div className="landing-editor-card">
            <div className="landing-editor-titlebar">
              <div className="landing-window-dots" aria-hidden="true">
                <span /><span /><span />
              </div>
              <span>FrameFlow — Sequence Editor</span>
              <div className="landing-editor-status">
                <CircleCheck size={13} /> Reference ready
              </div>
            </div>

            <div className="landing-editor-body">
              <aside className="landing-mock-sidebar">
                <div className="landing-mock-label">FRAMES</div>
                {[0, 1, 2, 3].map((item) => (
                  <div
                    key={item}
                    className={`landing-mock-thumb ${item === 0 ? "is-active" : ""}`}
                  >
                    <img src={HERO_IMG} alt="" />
                    <span>{item + 1}</span>
                  </div>
                ))}
              </aside>

              <div className="landing-mock-canvas-area">
                <div className="landing-mock-canvas">
                  <img src={HERO_IMG} alt="Sketch character in the FrameFlow editor" />
                  <div className="landing-segment-highlight" />
                </div>
                <div className="landing-mock-timeline">
                  {[0, 1, 2, 3, 4].map((item) => (
                    <div key={item} className={`landing-timeline-frame ${item === 2 ? "is-review" : ""}`}>
                      <img src={HERO_IMG} alt="" />
                    </div>
                  ))}
                </div>
              </div>

              <aside className="landing-mock-panel">
                <div className="landing-panel-heading">
                  <ScanSearch size={15} /> Segment Recolor
                </div>
                <div className="landing-panel-note">Lineart-preserving propagation completed.</div>
                <div className="landing-panel-metrics">
                  <div><small>FRAME</small><strong>#3</strong></div>
                  <div><small>CONFIDENCE</small><strong>95%</strong></div>
                </div>
                <div className="landing-panel-field">Segment 1 · hair · 98%</div>
                <div className="landing-panel-field">Role preset · Hair</div>
                <div className="landing-palette-row">
                  {["#F7A77F", "#19243A", "#3B82F6", "#8B5CF6", "#10B981", "#F59E0B"].map((color) => (
                    <span key={color} style={{ background: color }} />
                  ))}
                </div>
                <button type="button" className="landing-panel-button">Apply Correction & Continue</button>
              </aside>
            </div>
          </div>

          <div className="landing-floating-badge landing-floating-badge-top">
            <Layers3 size={16} /> Original lineart preserved
          </div>
          <div className="landing-floating-badge landing-floating-badge-bottom">
            <ScanSearch size={16} /> Confidence-aware review
          </div>
        </div>
      </div>
    </section>
  );
}
