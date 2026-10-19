import { useEffect, useState } from "react";

import { fetchHealth, type HealthResponse } from "../../services/api";

type State =
  | { kind: "loading" }
  | { kind: "ok"; data: HealthResponse }
  | { kind: "error"; message: string };

export function HealthStatus() {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    fetchHealth(controller.signal)
      .then((data) => setState({ kind: "ok", data }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState({
          kind: "error",
          message: error instanceof Error ? error.message : "خطای نامشخص",
        });
      });
    return () => controller.abort();
  }, []);

  return (
    <section className="card" aria-live="polite">
      <h2>وضعیت سامانه</h2>
      {state.kind === "loading" && <p className="muted">در حال بررسی…</p>}
      {state.kind === "error" && (
        <p className="alert alert-error">اتصال به سرور برقرار نشد: {state.message}</p>
      )}
      {state.kind === "ok" && (
        <p className="alert alert-success">
          سرویس فعال است — پایگاه داده: {state.data.database}
        </p>
      )}
    </section>
  );
}
