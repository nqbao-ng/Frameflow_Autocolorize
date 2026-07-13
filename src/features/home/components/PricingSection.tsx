import { Link } from "react-router";
import { ArrowRight, Check } from "lucide-react";

const FREE_FEATURES = [
  "5 projects",
  "PNG sequence export",
  "Keyframe-guided color propagation",
  "Human review and segment correction",
  "Standard processing",
];

const PRO_FEATURES = [
  "Unlimited projects",
  "Higher-resolution exports",
  "Faster sequence processing",
  "Expanded storage and project limits",
  "Priority support",
];

export function PricingSection() {
  return (
    <section id="pricing" className="landing-section landing-pricing-section">
      <div className="landing-section-heading">
        <div className="landing-section-eyebrow">PRICING</div>
        <h2>Simple, transparent pricing</h2>
        <p>Start free now. The Pro checkout can be connected when your payment flow is ready.</p>
      </div>

      <div className="landing-pricing-grid">
        <article className="landing-pricing-card">
          <div className="landing-pricing-plan">Free Plan</div>
          <div className="landing-pricing-price"><strong>$0</strong><span>/month</span></div>
          <div className="landing-pricing-features">
            {FREE_FEATURES.map((feature) => (
              <div key={feature}><Check size={16} /> <span>{feature}</span></div>
            ))}
          </div>
          <Link to="/signup" className="landing-pricing-button landing-pricing-button-secondary">
            Get Started Free
          </Link>
        </article>

        <article className="landing-pricing-card landing-pricing-card-pro">
          <div className="landing-pricing-badge">COMING SOON</div>
          <div className="landing-pricing-plan landing-pricing-plan-pro">Pro Plan</div>
          <div className="landing-pricing-price"><strong>$20</strong><span>/month</span></div>
          <div className="landing-pricing-features landing-pricing-features-pro">
            {PRO_FEATURES.map((feature) => (
              <div key={feature}><Check size={16} /> <span>{feature}</span></div>
            ))}
          </div>
          <Link to="/signup?plan=pro" className="landing-pricing-button landing-pricing-button-primary">
            Choose Pro <ArrowRight size={16} />
          </Link>
        </article>
      </div>
    </section>
  );
}
