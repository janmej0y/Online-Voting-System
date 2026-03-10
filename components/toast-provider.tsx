"use client";

import { CheckCircle2, Info, TriangleAlert, X } from "lucide-react";
import { createContext, useContext, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/utils";

type ToastTone = "success" | "error" | "info";

type Toast = {
  id: number;
  title: string;
  description?: string;
  tone: ToastTone;
};

type ToastContextValue = {
  pushToast: (toast: Omit<Toast, "id">) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const toneClassMap: Record<ToastTone, string> = {
  success: "border-emerald-500/30 bg-emerald-500/10",
  error: "border-rose-500/30 bg-rose-500/10",
  info: "border-primary/30 bg-primary/10"
};

function ToneIcon({ tone }: { tone: ToastTone }) {
  if (tone === "success") return <CheckCircle2 className="size-4 text-emerald-500" />;
  if (tone === "error") return <TriangleAlert className="size-4 text-rose-500" />;
  return <Info className="size-4 text-primary" />;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const value = useMemo<ToastContextValue>(
    () => ({
      pushToast(toast) {
        const id = ++idRef.current;
        setToasts((current) => [...current, { ...toast, id }]);
        window.setTimeout(() => {
          setToasts((current) => current.filter((item) => item.id !== id));
        }, 3600);
      }
    }),
    []
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-4 z-[60] flex justify-center px-4">
        <div className="grid w-full max-w-md gap-3">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={cn(
                "pointer-events-auto rounded-2xl border p-4 shadow-soft backdrop-blur-xl",
                toneClassMap[toast.tone]
              )}
              role="status"
              aria-live="polite"
            >
              <div className="flex items-start gap-3">
                <ToneIcon tone={toast.tone} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold">{toast.title}</div>
                  {toast.description ? <div className="mt-1 text-xs text-muted-foreground">{toast.description}</div> : null}
                </div>
                <button
                  type="button"
                  aria-label="Dismiss notification"
                  className="rounded-full p-1 text-muted-foreground transition hover:bg-background/70"
                  onClick={() => setToasts((current) => current.filter((item) => item.id !== toast.id))}
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within ToastProvider.");
  return context;
}
