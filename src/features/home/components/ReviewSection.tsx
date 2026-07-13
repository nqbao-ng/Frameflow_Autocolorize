import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Link } from "react-router";
import { REVIEW_POINTS } from "../constants/homeData";

export function ReviewSection() {
  return (
    <section id="review" className="landing-section landing-review-section">
      <div className="landing-review-grid">
        <div className="landing-review-copy">
          <span className="landing-section-eyebrow">HUMAN IN THE LOOP</span>
          <h2>Stop color drift before it spreads to the next frame.</h2>
          <p>
            A low-confidence result never becomes a trusted reference automatically.
            FrameFlow pauses, shows the uncertain area, and lets the artist approve the correction.
          </p>

          <div className="landing-review-points">
            {REVIEW_POINTS.map((point) => (
              <div key={point.title} className="landing-review-point">
                <div>{point.icon}</div>
                <span><strong>{point.title}</strong>{point.text}</span>
              </div>
            ))}
          </div>

          <Link to="/signup" className="landing-inline-link">
            Try the correction workflow <ArrowRight size={16} />
          </Link>
        </div>

        <div className="landing-review-visual">
          <div className="landing-review-window">
            <div className="landing-review-window-head">
              <span>SEGMENT RECOLOR</span>
              <span className="landing-review-mode">edit mode</span>
            </div>
            <div className="landing-review-success">
            </div>
            <div className="landing-review-stat-grid">
              <div><small>FRAME</small><strong>#3</strong></div>
              <div><small>CONFIDENCE</small><strong>95%</strong></div>
            </div>
            <div className="landing-review-action-row">
              <button type="button">Pick segment</button>
              <button type="button">Low-conf overlay</button>
            </div>
            <label>SELECTED SEGMENT</label>
            <div className="landing-review-select">Segment 1 · hair · 98%</div>
            <label>ROLE PRESET</label>
            <div className="landing-review-select">Hair</div>
            <label>REFERENCE PALETTE</label>
            <div className="landing-review-colors">
              {["#F5A982", "#1C2940", "#3B82F6", "#8B5CF6", "#12B981", "#F59E0B", "#EF4444"].map((color) => (
                <span key={color} style={{ background: color }} />
              ))}
            </div>
            <div className="landing-review-lock"><span /> Palette lock enabled</div>
            <button type="button" className="landing-review-apply">Apply Correction & Continue</button>
          </div>
        </div>
      </div>
    </section>
  );
}
