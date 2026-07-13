interface FloatingSketchProps {
  src: string;
  className: string;
}

export function FloatingSketch({ src, className }: FloatingSketchProps) {
  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      className={`landing-floating-sketch ${className}`}
      draggable={false}
    />
  );
}
