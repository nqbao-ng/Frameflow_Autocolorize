export function RulerTick({
  index,
  position,
}: {
  index: number;
  position: "top" | "bottom";
}) {
  const isFive = (index + 1) % 5 === 0;
  const isFirst = index === 0;

  return (
    <div
      style={{
        width: 52,
        minWidth: 52,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: position === "top" ? "flex-end" : "flex-start",
        height: isFive ? 18 : 12,
        flexShrink: 0,
        position: "relative",
      }}
    >
      <div
        style={{
          width: isFive ? 2 : 1,
          height: isFive ? "100%" : "60%",
          background: isFive ? "#3B82F6" : "#CBD5E1",
          borderRadius: 2,
        }}
      />
      {(isFive || isFirst) && (
        <div
          style={{
            position: "absolute",
            [position === "top" ? "bottom" : "top"]: "100%",
            fontSize: 9,
            fontWeight: isFive ? 700 : 500,
            color: isFive ? "#3B82F6" : "#94A3B8",
            whiteSpace: "nowrap",
            lineHeight: 1,
            marginTop: position === "bottom" ? 2 : 0,
            marginBottom: position === "top" ? 2 : 0,
          }}
        >
          {isFirst && !isFive ? "1s" : `${index + 1}s`}
        </div>
      )}
    </div>
  );
}