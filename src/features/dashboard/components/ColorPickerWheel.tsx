import { useRef, useState, useEffect } from "react";
import { hexToHsv, hsvToHex } from "../utils/colorUtils";

export function ColorPickerWheel({
  color,
  onChange,
}: {
  color: string;
  onChange: (c: string) => void;
}) {
  const svRef = useRef<HTMLCanvasElement>(null);
  const [hsv, setHsv] = useState<[number, number, number]>(() => hexToHsv(color));
  const [draggingSV, setDraggingSV] = useState(false);
  const [draggingH, setDraggingH] = useState(false);
  const SV = 160;

  useEffect(() => {
    setHsv(hexToHsv(color));
  }, [color]);

  useEffect(() => {
    const cv = svRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d")!;
    const [h] = hsv;
    const gH = ctx.createLinearGradient(0, 0, SV, 0);
    gH.addColorStop(0, "#fff");
    gH.addColorStop(1, `hsl(${h},100%,50%)`);
    ctx.fillStyle = gH;
    ctx.fillRect(0, 0, SV, SV);
    const gV = ctx.createLinearGradient(0, 0, 0, SV);
    gV.addColorStop(0, "rgba(0,0,0,0)");
    gV.addColorStop(1, "#000");
    ctx.fillStyle = gV;
    ctx.fillRect(0, 0, SV, SV);
    const cx = (hsv[1] / 100) * SV,
      cy = (1 - hsv[2] / 100) * SV;
    ctx.beginPath();
    ctx.arc(cx, cy, 6, 0, Math.PI * 2);
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, 6, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(0,0,0,0.4)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }, [hsv]);

  const updateSV = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = svRef.current!.getBoundingClientRect();
    const s = Math.max(0, Math.min(1, (e.clientX - rect.left) / SV)) * 100;
    const v = (1 - Math.max(0, Math.min(1, (e.clientY - rect.top) / SV))) * 100;
    const next: [number, number, number] = [hsv[0], s, v];
    setHsv(next);
    onChange(hsvToHex(...next));
  };

  const updateHue = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const h = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) * 360;
    const next: [number, number, number] = [h, hsv[1], hsv[2]];
    setHsv(next);
    onChange(hsvToHex(...next));
  };

  const hueGrad = Array.from({ length: 360 }, (_, i) => `hsl(${i},100%,50%)`).join(",");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, userSelect: "none" }}>
      <canvas
        ref={svRef}
        width={SV}
        height={SV}
        style={{
          width: SV,
          height: SV,
          borderRadius: 8,
          cursor: "crosshair",
          border: "1px solid #E2E8F0",
          display: "block",
        }}
        onMouseDown={(e) => { setDraggingSV(true); updateSV(e); }}
        onMouseMove={(e) => { if (draggingSV) updateSV(e); }}
        onMouseUp={() => setDraggingSV(false)}
        onMouseLeave={() => setDraggingSV(false)}
      />
      <div
        style={{
          position: "relative",
          height: 14,
          borderRadius: 6,
          border: "1px solid #E2E8F0",
          background: `linear-gradient(to right,${hueGrad})`,
          cursor: "crosshair",
        }}
        onMouseDown={(e) => { setDraggingH(true); updateHue(e); }}
        onMouseMove={(e) => { if (draggingH) updateHue(e); }}
        onMouseUp={() => setDraggingH(false)}
        onMouseLeave={() => setDraggingH(false)}
      >
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: `${(hsv[0] / 360) * 100}%`,
            transform: "translate(-50%,-50%)",
            width: 14,
            height: 14,
            borderRadius: "50%",
            border: "2px solid white",
            background: `hsl(${hsv[0]},100%,50%)`,
            boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
            pointerEvents: "none",
          }}
        />
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: "#F8FAFF",
            borderRadius: 7,
            padding: "5px 8px",
            border: "1px solid #E2E8F0",
          }}
        >
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: 3,
              background: color,
              border: "1px solid #E2E8F0",
              flexShrink: 0,
            }}
          />
          <input
            value={color.toUpperCase()}
            onChange={(e) => {
              if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) {
                onChange(e.target.value);
                setHsv(hexToHsv(e.target.value));
              }
            }}
            style={{
              border: "none",
              background: "transparent",
              fontSize: 11,
              fontFamily: "'JetBrains Mono',monospace",
              color: "#1E293B",
              outline: "none",
              width: "100%",
              letterSpacing: 1,
            }}
          />
        </div>
      </div>
    </div>
  );
}