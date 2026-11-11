import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertCircle, ArrowRight, Camera, Lock } from "lucide-react";
import { publicApi, tokenStore } from "../lib/api";

export function PublicAccessPage() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const cleaned = code.trim().toUpperCase();
    if (cleaned.length !== 10 || !/^[A-Z0-9]{10}$/.test(cleaned)) {
      setError("Invalid event code.");
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      const res = await publicApi.accessEvent(cleaned);
      tokenStore.setEventSession(res.session_token);
      navigate("/capture", { state: { event: res.event } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to verify event code.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col justify-between bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 px-4 py-8 text-white">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/20 ring-1 ring-indigo-400/40">
            <Camera className="h-5 w-5 text-indigo-300" aria-hidden="true" />
          </span>
          <span className="text-lg font-bold tracking-tight">EventLens</span>
        </div>
        <Link
          to="/admin/login"
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/10"
        >
          <Lock className="h-4 w-4 text-indigo-300" aria-hidden="true" />
          Super Admin
        </Link>
      </header>

      <main className="mx-auto my-auto w-full max-w-md py-10">
        <div className="rounded-3xl border border-white/15 bg-white/10 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
          <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500/25 ring-1 ring-indigo-400/40">
            <Camera className="h-7 w-7 text-indigo-200" aria-hidden="true" />
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Welcome to Event Photography
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-indigo-100/80">
            Enter your 10-character event access code to continue.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-5" noValidate>
            <div>
              <label htmlFor="event-access-code" className="block text-sm font-medium text-indigo-100">
                Event Access Code
              </label>
              <p id="code-hint" className="mt-0.5 text-xs text-indigo-200/70">
                10 uppercase letters and numbers (example: A7K9P2X5M8)
              </p>
              <input
                id="event-access-code"
                name="access_code"
                type="text"
                required
                maxLength={10}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="characters"
                spellCheck={false}
                enterKeyHint="go"
                aria-describedby="code-hint"
                aria-invalid={error ? "true" : "false"}
                value={code}
                onChange={(e) => {
                  const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
                  setCode(val);
                  if (error) setError(null);
                }}
                placeholder="A7K9P2X5M8"
                className="mt-2 w-full rounded-2xl border border-white/20 bg-slate-900/70 px-4 py-3.5 text-center font-mono text-xl font-bold tracking-[0.28em] text-white placeholder:tracking-[0.2em] placeholder:text-slate-500 focus:border-indigo-400 focus:outline-none"
              />
            </div>

            {error && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-2xl border border-rose-400/40 bg-rose-500/15 px-4 py-3 text-sm text-rose-100"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-indigo-500 px-5 py-3 text-base font-semibold text-white shadow-lg shadow-indigo-500/30 transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span>{submitting ? "Verifying Code..." : "Continue"}</span>
              {!submitting && <ArrowRight className="h-5 w-5" aria-hidden="true" />}
            </button>
          </form>
        </div>
      </main>

      <footer className="mx-auto w-full max-w-5xl text-center text-xs text-slate-400">
        Dedicated event storage powered by Cloudflare R2
      </footer>
    </div>
  );
}

