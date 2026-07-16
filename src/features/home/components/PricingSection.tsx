import { useEffect, useState } from "react";
import { Link } from "react-router";
import { ArrowRight, Check } from "lucide-react";
import { fetchBillingPlans, formatVnd, type BillingPlan } from "@/features/billing/services/billing.api";

const FALLBACK_PLANS: BillingPlan[] = [
  {
    code: "free", name: "Free", description: "Keep creating after your Pro trial ends.", priceVnd: 0,
    durationDays: 30, creditsGrant: 5, projectLimit: 2, processingFrameLimit: 50,
    creativeCreditLimit: 5, creativeDailyLimit: 3, creativeConcurrentLimit: 1, trialDays: 0,
    priorityQueue: false, highQualityExport: false, versionHistoryDays: 3, sortOrder: 10,
    features: ["3-day Pro trial for new accounts", "2 active projects", "50 Processing Frames/month", "5 Creative Credits/month", "Manual correction and standard export"],
  },
  {
    code: "pro", name: "Pro Beta", description: "For individual artists producing frame sequences regularly.", priceVnd: 499000,
    durationDays: 30, creditsGrant: 200, projectLimit: 50, processingFrameLimit: 1000,
    creativeCreditLimit: 200, creativeDailyLimit: 40, creativeConcurrentLimit: 2, trialDays: 0,
    priorityQueue: true, highQualityExport: true, versionHistoryDays: 30, sortOrder: 20,
    features: ["50 active projects", "1,000 Processing Frames/month", "200 Creative Credits/month", "2 concurrent Creative jobs", "Priority processing and high-quality export"],
  },
];

export function PricingSection() {
  const [plans, setPlans] = useState<BillingPlan[]>(FALLBACK_PLANS);
  useEffect(() => {
    let cancelled = false;
    fetchBillingPlans().then((remote) => { if (!cancelled && remote.length) setPlans(remote); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  return (
    <section id="pricing" className="landing-section landing-pricing-section">
      <div className="landing-section-heading">
        <div className="landing-section-eyebrow">PRICING</div>
        <h2>Start with the full workflow</h2>
        <p>New accounts receive a 3-day Pro trial. After that, continue on Free or upgrade securely with payOS.</p>
      </div>
      <div className="landing-pricing-grid">
        {plans.map((plan) => {
          const free = plan.priceVnd === 0;
          const pro = plan.code === "pro";
          return (
            <article key={plan.code} className={`landing-pricing-card ${pro ? "landing-pricing-card-pro" : ""}`}>
              {pro && <div className="landing-pricing-badge">PRO BETA</div>}
              <div className={`landing-pricing-plan ${pro ? "landing-pricing-plan-pro" : ""}`}>{plan.name}</div>
              <div className="landing-pricing-price"><strong>{formatVnd(plan.priceVnd)}</strong><span>{free ? "forever" : "/month"}</span></div>
              <div className={`landing-pricing-features ${pro ? "landing-pricing-features-pro" : ""}`}>
                {plan.features.map((feature) => <div key={feature}><Check size={16} /><span>{feature}</span></div>)}
              </div>
              <Link to={free ? "/signup" : `/settings?tab=billing&plan=${plan.code}`} className={`landing-pricing-button ${pro ? "landing-pricing-button-primary" : "landing-pricing-button-secondary"}`}>
                {free ? "Start 3-day Pro Trial" : "Choose Pro"} {!free && <ArrowRight size={16} />}
              </Link>
            </article>
          );
        })}
      </div>
    </section>
  );
}
