import { useEffect, useState } from "react";
import { Link } from "react-router";
import { ArrowRight, Check } from "lucide-react";
import { fetchBillingPlans, formatVnd, type BillingPlan } from "@/features/billing/services/billing.api";

const FALLBACK_PLANS: BillingPlan[] = [
  {
    code: "free",
    name: "Free",
    description: "For trying the core FrameFlow workflow",
    priceVnd: 0,
    durationDays: 0,
    creditsGrant: 0,
    projectLimit: 5,
    creativeDailyLimit: 10,
    creativeConcurrentLimit: 1,
    sortOrder: 10,
    features: ["5 projects", "Standard processing", "10 Creative Studio jobs/day", "PNG and ZIP export"],
  },
  {
    code: "pro",
    name: "Pro",
    description: "For individual artists and frequent animation work",
    priceVnd: 499000,
    durationDays: 30,
    creditsGrant: 500,
    projectLimit: 50,
    creativeDailyLimit: 40,
    creativeConcurrentLimit: 2,
    sortOrder: 20,
    features: ["50 projects", "Faster processing", "40 Creative Studio jobs/day", "500 bonus credits"],
  },
  {
    code: "studio",
    name: "Studio",
    description: "For small teams and production workloads",
    priceVnd: 249000,
    durationDays: 30,
    creditsGrant: 1500,
    projectLimit: null,
    creativeDailyLimit: 120,
    creativeConcurrentLimit: 4,
    sortOrder: 30,
    features: ["Unlimited projects", "Highest processing limits", "120 Creative Studio jobs/day", "1,500 bonus credits"],
  },
];

export function PricingSection() {
  const [plans, setPlans] = useState<BillingPlan[]>(FALLBACK_PLANS);

  useEffect(() => {
    let cancelled = false;
    fetchBillingPlans()
      .then((remotePlans) => {
        if (!cancelled && remotePlans.length) {
          setPlans(remotePlans.map((plan) => (
            plan.code === "pro" ? { ...plan, priceVnd: 499000 } : plan
          )));
        }
      })
      .catch(() => {
        // Keep build-time fallback when billing has not been deployed yet.
      });
    return () => { cancelled = true; };
  }, []);

  return (
    <section id="pricing" className="landing-section landing-pricing-section">
      <div className="landing-section-heading">
        <div className="landing-section-eyebrow">PRICING</div>
        <h2>Simple, transparent pricing</h2>
        <p>Start free, then upgrade to Pro monthly with payOS and VietQR. Paid plans do not auto-renew.</p>
      </div>

      <div className="landing-pricing-grid">
        {plans.map((plan) => {
          const isFree = plan.priceVnd === 0;
          const isPro = plan.code === "pro";
          const isStudio = plan.code === "studio";
          return (
            <article key={plan.code} className={`landing-pricing-card ${isPro ? "landing-pricing-card-pro" : ""}`}>
              {isPro && <div className="landing-pricing-badge">MOST POPULAR</div>}
              <div className={`landing-pricing-plan ${isPro ? "landing-pricing-plan-pro" : ""}`}>{plan.name} Plan</div>
              <div className="landing-pricing-price">
                <strong>{isStudio ? "Coming Soon" : formatVnd(plan.priceVnd)}</strong>
                <span>{isFree ? "forever" : isPro ? "/month" : ""}</span>
              </div>
              <div className={`landing-pricing-features ${isPro ? "landing-pricing-features-pro" : ""}`}>
                {plan.features.map((feature) => (
                  <div key={feature}><Check size={16} /> <span>{feature}</span></div>
                ))}
              </div>
              {isStudio ? (
                <button
                  type="button"
                  disabled
                  className="landing-pricing-button landing-pricing-button-secondary"
                  style={{ cursor: "not-allowed", opacity: 0.65 }}
                >
                  Coming Soon
                </button>
              ) : (
                <Link
                  to={isFree ? "/signup" : `/settings?tab=billing&plan=${plan.code}`}
                  className={`landing-pricing-button ${isPro ? "landing-pricing-button-primary" : "landing-pricing-button-secondary"}`}
                >
                  {isFree ? "Get Started Free" : `Choose ${plan.name}`} {!isFree && <ArrowRight size={16} />}
                </Link>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
