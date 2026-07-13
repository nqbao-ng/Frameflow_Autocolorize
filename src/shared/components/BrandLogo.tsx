import { Link } from "react-router";
import type { CSSProperties } from "react";

interface BrandLogoProps {
  height?: number;
  to?: string | null;
  className?: string;
  style?: CSSProperties;
  ariaLabel?: string;
}

export function BrandLogo({
  height = 40,
  to = "/",
  className,
  style,
  ariaLabel = "FrameFlow home",
}: BrandLogoProps) {
  const image = (
    <img
      src="/frameflow-logo.png"
      alt="FrameFlow"
      draggable={false}
      style={{
        display: "block",
        height,
        width: "auto",
        maxWidth: "100%",
        objectFit: "contain",
        userSelect: "none",
        ...style,
      }}
    />
  );

  if (!to) return image;

  return (
    <Link
      to={to}
      aria-label={ariaLabel}
      className={className}
      style={{ display: "inline-flex", alignItems: "center", textDecoration: "none" }}
    >
      {image}
    </Link>
  );
}
