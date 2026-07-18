interface ActivityDotsProps {
  label?: string;
}

export function ActivityDots({ label = "Working" }: ActivityDotsProps) {
  return (
    <span className="ff-activity-dots" role="status" aria-label={label}>
      <span aria-hidden="true" />
      <span aria-hidden="true" />
      <span aria-hidden="true" />
    </span>
  );
}
