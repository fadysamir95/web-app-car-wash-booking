export function BurnoutLoader({ label = "Loading" }: { label?: string }) {
  return (
    <div className="burnout-loader" role="status" aria-live="polite">
      <div className="burnout-track">
        <div className="burnout-smoke burnout-smoke-one" />
        <div className="burnout-smoke burnout-smoke-two" />
        <div className="burnout-smoke burnout-smoke-three" />
        <div className="burnout-car" aria-hidden="true">
          <div className="burnout-car-body" />
          <div className="burnout-window" />
          <div className="burnout-wheel burnout-wheel-front" />
          <div className="burnout-wheel burnout-wheel-back" />
          <div className="burnout-spark burnout-spark-one" />
          <div className="burnout-spark burnout-spark-two" />
        </div>
      </div>
      <p>{label}</p>
    </div>
  );
}
