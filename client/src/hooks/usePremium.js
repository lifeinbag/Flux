import { useEffect, useRef, useState } from "react";

/**
 * usePremium — subscribes to premium updates for one AccountSet.
 * @param {object} p
 * @param {string} p.accountSetId
 * @param {string} p.futureSymbol
 * @param {string} p.spotSymbol
 * @param {string} [p.wsUrl]  e.g. ws://localhost:5000/ws  (optional)
 */
export default function usePremium({ accountSetId, futureSymbol, spotSymbol, wsUrl }) {
  const url = wsUrl || process.env.REACT_APP_BACKEND_WS || "ws://localhost:5000/ws";

  const wsRef = useRef(null);
  const alive = useRef(true);
  const backoff = useRef(400);
  const [status, setStatus] = useState("connecting");
  const [premium, setPremium] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    alive.current = true;

    function open() {
      if (!alive.current) return;
      try {
        const ws = new WebSocket(url);
        wsRef.current = ws;

        ws.onopen = () => {
          setStatus("connected");
          setError(null);
          backoff.current = 400;

          ws.send(JSON.stringify({ action: "subscribe_set", accountSetId }));
          ws.send(JSON.stringify({
            action: "subscribe_premium",
            accountSetId,
            futureSymbol,
            spotSymbol
          }));
        };

        ws.onmessage = (e) => {
          try {
            const msg = JSON.parse(e.data);
            if (msg?.type === "premium_update") {
              // (Optional) filter to our symbols if backend ever multiplexes
              if (
                msg.data?.accountSetId === accountSetId &&
                msg.data?.futureSymbol === futureSymbol &&
                msg.data?.spotSymbol === spotSymbol
              ) {
                setPremium(msg.data);
              } else if (!msg.data?.accountSetId) {
                // older payloads without id — accept
                setPremium(msg.data);
              }
            }
          } catch {}
        };

        ws.onerror = () => {
          setError("ws_error");
        };

        ws.onclose = () => {
          setStatus("closed");
          if (!alive.current) return;
          // simple backoff reconnect
          const delay = Math.min(backoff.current, 5000);
          backoff.current = Math.min(backoff.current * 1.8, 5000);
          setTimeout(open, delay);
        };
      } catch (e) {
        setError(String(e?.message || e));
        setTimeout(open, Math.min(backoff.current, 5000));
        backoff.current = Math.min(backoff.current * 1.8, 5000);
      }
    }

    open();

    return () => {
      alive.current = false;
      try { wsRef.current?.close(); } catch {}
    };
  }, [url, accountSetId, futureSymbol, spotSymbol]);

  return { status, premium, error };
}
