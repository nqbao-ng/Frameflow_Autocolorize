import { STEPS } from "../constants/homeData";

export function StepsSection() {
  return (
    <section style={{ background: "#F8FAFF", padding: "80px 40px", marginBottom: 120 }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div className="text-center mb-16">
          <h2 style={{ fontSize: 36, fontWeight: 800, color: "#1E293B", letterSpacing: "-1px", marginBottom: 12 }}>
            How It Works
          </h2>
          <p style={{ fontSize: 16, color: "#64748B" }}>
            From raw sketches to fully colored animations in three simple steps.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {STEPS.map((step, idx) => (
            <div key={idx} className="relative flex flex-col items-center text-center">
              {/* Connector line between steps */}
              {idx < STEPS.length - 1 && (
                <div
                  className="hidden md:block absolute top-8 left-[60%] w-[80%] h-px"
                  style={{ background: "linear-gradient(90deg, #CBD5E1, transparent)" }}
                />
              )}

              {/* Icon circle */}
              <div
                style={{
                  width: 64, height: 64, borderRadius: "50%",
                  background: `${step.color}15`,
                  border: `2px solid ${step.color}30`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  marginBottom: 20, position: "relative", zIndex: 1,
                }}
              >
                {step.icon}
              </div>

              <div
                style={{
                  fontSize: 11, fontWeight: 700, color: step.color,
                  letterSpacing: 2, marginBottom: 8, textTransform: "uppercase",
                }}
              >
                STEP {step.number}
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: "#1E293B", marginBottom: 10 }}>
                {step.title}
              </h3>
              <p style={{ fontSize: 14, color: "#64748B", lineHeight: 1.7 }}>
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}