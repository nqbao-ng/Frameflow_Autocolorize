import { FEATURES } from "../constants/homeData";

export function FeaturesSection() {
  return (
    <section style={{ maxWidth: 1200, margin: "0 auto", padding: "0 40px 120px" }}>
      <div className="text-center mb-16">
        <h2 style={{ fontSize: 36, fontWeight: 800, color: "#1E293B", letterSpacing: "-1px", marginBottom: 12 }}>
          Everything you need to colorize animations
        </h2>
        <p style={{ fontSize: 16, color: "#64748B", maxWidth: 500, margin: "0 auto" }}>
          Professional-grade tools combined with cutting-edge AI to make your workflow faster than ever.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {FEATURES.map((feature, idx) => (
          <div
            key={idx}
            style={{
              background: "white", borderRadius: 20, padding: 32,
              boxShadow: "0 10px 30px rgba(0,0,0,0.06)",
              border: "1px solid rgba(0,0,0,0.04)",
            }}
          >
            <div
              style={{
                width: 56, height: 56, borderRadius: 14,
                background: feature.bg,
                display: "flex", alignItems: "center", justifyContent: "center",
                marginBottom: 20,
              }}
            >
              {feature.icon}
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: "#1E293B", marginBottom: 10 }}>
              {feature.title}
            </h3>
            <p style={{ fontSize: 14, color: "#64748B", lineHeight: 1.7 }}>
              {feature.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}