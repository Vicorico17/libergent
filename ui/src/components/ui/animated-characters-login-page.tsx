"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Eye, EyeOff } from "lucide-react";

// ─── Animated mascot ──────────────────────────────────────────────────────────
// Renders the pixel-art mascot with mouse-tracking pupils and body tilt.
// Pupils are dark divs overlaid exactly over the white V-eye areas in the SVG.

function AnimatedMascot({
  size = 280,
  mouseX,
  mouseY,
  isHiding,
  isExposed,
  isBlinking,
}: {
  size?: number;
  mouseX: number;
  mouseY: number;
  isHiding: boolean;
  isExposed: boolean;
  isBlinking: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [bounds, setBounds] = useState<DOMRect | null>(null);
  // Real logo viewBox: 848.88 × 838.5 → aspect ≈ 0.988 (nearly square)
  const h = Math.round(size * 0.988);

  useEffect(() => {
    if (ref.current) {
      setBounds(ref.current.getBoundingClientRect());
    }
  }, [mouseX, mouseY, size]);

  // Body skew — leans toward the cursor
  const skew = (() => {
    if (!bounds || mouseX === 0) return 0;
    return Math.max(-10, Math.min(10, -(mouseX - (bounds.left + bounds.width / 2)) / 70));
  })();

  // Eye centers derived from real logo PNG pixel analysis
  const lx = size * 0.307; // left  eye ~30.7% from left
  const rx = size * 0.693; // right eye ~69.3% from left
  const py = h * 0.378;    // both eyes ~37.8% from top
  const ps = Math.max(8, Math.round(size * 0.04)); // pupil size ~12px at size=300

  const pupilFor = (eyeX: number) => {
    if (isHiding) return { x: 0, y: -4 };
    if (isExposed) return { x: 5, y: 2 };
    if (!bounds || mouseX === 0) return { x: 0, y: 0 };
    const ex = bounds.left + eyeX;
    const ey = bounds.top + py;
    const dx = mouseX - ex;
    const dy = mouseY - ey;
    const dist = Math.min(Math.sqrt(dx * dx + dy * dy), 5);
    const a = Math.atan2(dy, dx);
    return { x: Math.cos(a) * dist, y: Math.sin(a) * dist };
  };

  const lp = pupilFor(lx);
  const rp = pupilFor(rx);

  return (
    <div
      ref={ref}
      className="relative transition-all duration-500 ease-in-out"
      style={{
        width: size,
        height: h,
        transform: isHiding
          ? `skewX(${skew - 10}deg) translateX(-18px)`
          : `skewX(${skew}deg)`,
        transformOrigin: "bottom center",
      }}
    >
      {/* Real logo image */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo.svg"
        width={size}
        height={h}
        alt=""
        aria-hidden="true"
        style={{ display: "block", width: size, height: h }}
      />

      {/* Pupils — pixel-art squares overlaid on the transparent eye cutouts */}
      {!isBlinking && (
        <>
          <div
            className="absolute pointer-events-none"
            style={{
              width: ps, height: ps,
              backgroundColor: "#111111",
              imageRendering: "pixelated",
              left: lx - ps / 2,
              top:  py - ps / 2,
              transform: `translate(${lp.x}px, ${lp.y}px)`,
              transition: "transform 0.1s ease-out",
            }}
          />
          <div
            className="absolute pointer-events-none"
            style={{
              width: ps, height: ps,
              backgroundColor: "#111111",
              imageRendering: "pixelated",
              left: rx - ps / 2,
              top:  py - ps / 2,
              transform: `translate(${rp.x}px, ${rp.y}px)`,
              transition: "transform 0.1s ease-out",
            }}
          />
        </>
      )}
    </div>
  );
}

// ─── Login page ───────────────────────────────────────────────────────────────

export function AnimatedLoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [mouseX, setMouseX] = useState(0);
  const [mouseY, setMouseY] = useState(0);
  const [isBlinking, setIsBlinking]   = useState(false);
  const [isTyping, setIsTyping]       = useState(false);

  useEffect(() => {
    const handle = (e: MouseEvent) => { setMouseX(e.clientX); setMouseY(e.clientY); };
    window.addEventListener("mousemove", handle);
    return () => window.removeEventListener("mousemove", handle);
  }, []);

  // Random blinking
  useEffect(() => {
    const scheduleBlink = () => {
      const t = setTimeout(() => {
        setIsBlinking(true);
        setTimeout(() => { setIsBlinking(false); scheduleBlink(); }, 150);
      }, Math.random() * 4000 + 3000);
      return t;
    };
    const t = scheduleBlink();
    return () => clearTimeout(t);
  }, []);

  const hiding  = isTyping || (password.length > 0 && !showPassword);
  const exposed = password.length > 0 && showPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    await new Promise((r) => setTimeout(r, 800));
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">

      {/* ── Left — mascot panel ─────────────────────────────────────────── */}
      <div
        className="relative hidden lg:flex flex-col justify-between p-12 text-white overflow-hidden"
        style={{ background: "linear-gradient(135deg, rgba(79,124,255,0.92) 0%, #4F7CFF 50%, #3d6aec 100%)" }}
      >
        {/* Brand */}
        <Link href="/" className="relative z-20 flex items-center gap-3">
          <span className="font-pixel text-white" style={{ fontSize: "13px" }}>LiberGent</span>
        </Link>

        {/* Mascot — centered */}
        <div className="relative z-20 flex flex-col items-center justify-center gap-10">
          <AnimatedMascot
            size={300}
            mouseX={mouseX}
            mouseY={mouseY}
            isHiding={hiding}
            isExposed={exposed}
            isBlinking={isBlinking}
          />
          <p className="font-pixel text-white/70 text-center" style={{ fontSize: "9px", lineHeight: 2 }}>
            {hiding
              ? "Nu mă uit, promit..."
              : exposed
              ? "Hmm, e parola ta?"
              : "Eu am grijă de\nofertele tale"}
          </p>
        </div>

        {/* Footer links */}
        <div className="relative z-20 flex items-center gap-8 text-sm text-white/60">
          <a href="#" className="hover:text-white transition-colors">Confidențialitate</a>
          <a href="#" className="hover:text-white transition-colors">Termeni</a>
          <a href="#" className="hover:text-white transition-colors">Contact</a>
        </div>

        {/* Decorative */}
        <div className="absolute inset-0"
          style={{ backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.07) 1px, transparent 1px)", backgroundSize: "20px 20px" }} />
        <div className="absolute top-1/4 right-1/4 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-white/5 rounded-full blur-3xl" />
      </div>

      {/* ── Right — form ────────────────────────────────────────────────── */}
      <div className="flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-[420px]">

          {/* Mobile logo */}
          <div className="lg:hidden flex items-center justify-center gap-2 mb-12">
            <span className="font-pixel text-[#111111]" style={{ fontSize: "13px" }}>LiberGent</span>
          </div>

          {/* Header */}
          <div className="text-center mb-10">
            <h1 className="text-3xl font-bold tracking-tight mb-2 text-[#111111]">Bine ai revenit!</h1>
            <p className="text-[#6B6B6B] text-sm">Intră în contul tău LiberGent</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-[#111111]">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="ion@example.com"
                value={email}
                autoComplete="off"
                onChange={(e) => setEmail(e.target.value)}
                onFocus={() => setIsTyping(true)}
                onBlur={() => setIsTyping(false)}
                required
                className="h-12 border-[#D9D9D9] focus-visible:ring-[#4F7CFF] text-[#111111]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-[#111111]">Parolă</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-12 pr-10 border-[#D9D9D9] focus-visible:ring-[#4F7CFF] text-[#111111]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B6B6B] hover:text-[#111111] transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Checkbox id="remember" />
                <Label htmlFor="remember" className="text-sm font-normal cursor-pointer text-[#111111]">
                  Ține-mă minte
                </Label>
              </div>
              <a href="#" className="text-sm text-[#4F7CFF] hover:underline font-medium">
                Ai uitat parola?
              </a>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 rounded-xl bg-[#4F7CFF] text-white text-sm font-semibold hover:bg-[#3d6aec] disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
            >
              {isLoading && (
                <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="3" strokeDasharray="60" strokeDashoffset="15" />
                </svg>
              )}
              {isLoading ? "Se încarcă..." : "Intră în cont"}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-[#D9D9D9]" />
            <span className="text-xs text-[#6B6B6B]">sau continuă cu</span>
            <div className="flex-1 h-px bg-[#D9D9D9]" />
          </div>

          {/* Google */}
          <button
            type="button"
            className="w-full h-10 rounded-xl border border-[#D9D9D9] flex items-center justify-center gap-2.5 text-sm font-medium text-[#111111] hover:bg-[#F8F9FA] transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Google
          </button>

          <p className="text-center text-xs text-[#6B6B6B] mt-6">
            Nu ai cont?{" "}
            <a href="#" className="text-[#4F7CFF] font-medium hover:underline">Înregistrează-te</a>
          </p>
          <p className="text-center text-xs text-[#6B6B6B] mt-3">
            Prin continuare accepți{" "}
            <a href="#" className="hover:underline">Termenii</a> și{" "}
            <a href="#" className="hover:underline">Politica de confidențialitate</a>.
          </p>
        </div>
      </div>
    </div>
  );
}
