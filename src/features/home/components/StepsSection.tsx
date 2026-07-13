import { STEPS } from "../constants/homeData";

export function StepsSection() {
  return (
    <section id="workflow" className="landing-workflow-section">
      <div className="landing-section landing-workflow-inner">
        <div className="landing-section-heading">
          <span className="landing-section-eyebrow">HOW IT WORKS</span>
          <h2>From raw sketches to an export-ready sequence</h2>
          <p>A clear five-step workflow built around one colored reference keyframe.</p>
        </div>

        <div className="landing-step-grid">
          {STEPS.map((step, index) => (
            <article key={step.number} className="landing-step-card">
              {index < STEPS.length - 1 && <span className="landing-step-connector" />}
              <div className="landing-step-icon" style={{ color: step.color, borderColor: `${step.color}55`, background: `${step.color}16` }}>
                {step.icon}
              </div>
              <span className="landing-step-number" style={{ color: step.color }}>STEP {step.number}</span>
              <h3>{step.title}</h3>
              <p>{step.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
