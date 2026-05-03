import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback } from "react";

export const Route = createFileRoute("/")({
  component: Index,
});

type Burst = {
  id: number;
  x: number;
  y: number;
  char: string;
  hue: number;
  shape: "circle" | "star" | "bubble" | "ring";
};

type Particle = {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  hue: number;
  size: number;
};

const FRIENDLY_HUES = [10, 30, 50, 130, 180, 200, 270, 320];
const SHAPES: Burst["shape"][] = ["circle", "star", "bubble", "ring"];

// Web Audio: pleasant pentatonic notes
const PENTATONIC = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99];

function Index() {
  const [bursts, setBursts] = useState<Burst[]>([]);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [bgHue, setBgHue] = useState(260);
  const [showExit, setShowExit] = useState(false);
  const [locked, setLocked] = useState(false);
  const [mathQ, setMathQ] = useState({ a: 0, b: 0 });
  const [mathAns, setMathAns] = useState("");
  const [mathErr, setMathErr] = useState(false);

  const idRef = useRef(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const ctrlSeqRef = useRef<{ ctrl: boolean; e: boolean; time: number }>({
    ctrl: false,
    e: false,
    time: 0,
  });

  const ensureAudio = useCallback(() => {
    if (!audioCtxRef.current) {
      const Ctx =
        (window.AudioContext as typeof AudioContext) ||
        ((window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext);
      audioCtxRef.current = new Ctx();
    }
    if (audioCtxRef.current.state === "suspended") {
      void audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  }, []);

  const playNote = useCallback(
    (key: string) => {
      const ctx = ensureAudio();
      const noteIdx =
        Math.abs(
          key.split("").reduce((a, c) => a + c.charCodeAt(0), 0)
        ) % PENTATONIC.length;
      const freq = PENTATONIC[noteIdx];

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const now = ctx.currentTime;

      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.5, now + 0.05);
      osc.frequency.exponentialRampToValueAtTime(freq, now + 0.15);

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.18, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.65);
    },
    [ensureAudio]
  );

  const spawnBurst = useCallback((char: string) => {
    const id = ++idRef.current;
    const hue = FRIENDLY_HUES[Math.floor(Math.random() * FRIENDLY_HUES.length)];
    const shape = SHAPES[Math.floor(Math.random() * SHAPES.length)];
    const x = 10 + Math.random() * 80;
    const y = 15 + Math.random() * 70;
    setBgHue(hue);
    setBursts((b) => [...b.slice(-8), { id, x, y, char, hue, shape }]);

    // particles
    const newParticles: Particle[] = Array.from({ length: 14 }, (_, i) => {
      const angle = (Math.PI * 2 * i) / 14 + Math.random() * 0.5;
      const speed = 1 + Math.random() * 2.5;
      return {
        id: id * 100 + i,
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        hue: hue + (Math.random() * 40 - 20),
        size: 0.6 + Math.random() * 1.4,
      };
    });
    setParticles((p) => [...p.slice(-150), ...newParticles]);

    setTimeout(() => {
      setBursts((b) => b.filter((x) => x.id !== id));
    }, 1100);
  }, []);

  // animate particles
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      setParticles((ps) =>
        ps
          .map((p) => ({
            ...p,
            x: p.x + p.vx * 0.4,
            y: p.y + p.vy * 0.4,
            vy: p.vy + 0.05,
            life: p.life - 0.02,
          }))
          .filter((p) => p.life > 0)
      );
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // keydown listener
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // exit combo: Ctrl+E
      if (e.ctrlKey && (e.key === "e" || e.key === "E")) {
        e.preventDefault();
        const now = Date.now();
        ctrlSeqRef.current = { ctrl: true, e: true, time: now };
        const a = Math.floor(Math.random() * 8) + 2;
        const b = Math.floor(Math.random() * 8) + 2;
        setMathQ({ a, b });
        setMathAns("");
        setMathErr(false);
        setShowExit(true);
        return;
      }

      // block common shortcuts
      if (
        (e.ctrlKey || e.metaKey) &&
        ["t", "w", "n", "r", "p", "s", "f", "l", "j", "h"].includes(e.key.toLowerCase())
      ) {
        e.preventDefault();
      }
      if (e.key === "F5" || (e.key === "Tab" && e.altKey)) e.preventDefault();
      if (e.key === "Backspace") e.preventDefault();

      if (showExit) return;

      e.preventDefault();
      const char =
        e.key.length === 1
          ? e.key.toUpperCase()
          : e.key === " "
          ? "★"
          : e.key.replace("Arrow", "↑").slice(0, 3);
      ensureAudio();
      playNote(e.key);
      spawnBurst(char);
    };

    const prevent = (ev: Event) => ev.preventDefault();
    window.addEventListener("keydown", handler);
    window.addEventListener("contextmenu", prevent);
    window.addEventListener("dragstart", prevent);
    window.addEventListener("selectstart", prevent);
    window.addEventListener("wheel", prevent, { passive: false });

    return () => {
      window.removeEventListener("keydown", handler);
      window.removeEventListener("contextmenu", prevent);
      window.removeEventListener("dragstart", prevent);
      window.removeEventListener("selectstart", prevent);
      window.removeEventListener("wheel", prevent);
    };
  }, [ensureAudio, playNote, spawnBurst, showExit]);

  const enterPlay = useCallback(async () => {
    ensureAudio();
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      // ignore
    }
    setLocked(true);
  }, [ensureAudio]);

  const confirmExit = () => {
    if (parseInt(mathAns, 10) === mathQ.a + mathQ.b) {
      setShowExit(false);
      setLocked(false);
      if (document.fullscreenElement) void document.exitFullscreen();
    } else {
      setMathErr(true);
    }
  };

  return (
    <main
      className="relative h-screen w-screen overflow-hidden select-none cursor-none"
      style={{
        background: `radial-gradient(ellipse at center, oklch(0.35 0.18 ${bgHue}) 0%, oklch(0.15 0.08 ${
          bgHue + 40
        }) 70%, oklch(0.08 0.04 ${bgHue + 80}) 100%)`,
        transition: "background 0.4s ease",
      }}
    >
      {/* twinkle stars */}
      <div className="pointer-events-none absolute inset-0 opacity-40">
        {Array.from({ length: 30 }).map((_, i) => (
          <span
            key={i}
            className="absolute rounded-full bg-white animate-pulse"
            style={{
              left: `${(i * 37) % 100}%`,
              top: `${(i * 53) % 100}%`,
              width: `${(i % 3) + 2}px`,
              height: `${(i % 3) + 2}px`,
              animationDelay: `${i * 0.2}s`,
              animationDuration: `${2 + (i % 4)}s`,
            }}
          />
        ))}
      </div>

      {/* particles */}
      {particles.map((p) => (
        <span
          key={p.id}
          className="pointer-events-none absolute rounded-full"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: `${p.size}rem`,
            height: `${p.size}rem`,
            background: `oklch(0.85 0.25 ${p.hue})`,
            boxShadow: `0 0 ${20 * p.life}px oklch(0.8 0.3 ${p.hue})`,
            opacity: p.life,
            transform: `translate(-50%, -50%) scale(${p.life})`,
          }}
        />
      ))}

      {/* bursts */}
      {bursts.map((b) => (
        <BurstFx key={b.id} burst={b} />
      ))}

      {/* start screen */}
      {!locked && !showExit && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center cursor-default">
          <div className="mb-8 text-8xl animate-bounce">🧸</div>
          <h1 className="mb-4 text-6xl font-black tracking-tight text-foreground drop-shadow-[0_4px_20px_rgba(255,255,255,0.3)]">
            Baby Keys Playground
          </h1>
          <p className="mb-10 max-w-md text-lg text-foreground/70">
            Press any key to make magic happen ✨
            <br />
            <span className="text-sm opacity-70">Parents: press Ctrl + E to exit</span>
          </p>
          <button
            onClick={enterPlay}
            className="rounded-full bg-gradient-to-r from-[oklch(0.75_0.2_30)] via-[oklch(0.75_0.2_180)] to-[oklch(0.75_0.2_300)] px-12 py-5 text-2xl font-bold text-background shadow-[0_10px_40px_-5px_oklch(0.7_0.25_280)] transition hover:scale-105 active:scale-95 cursor-pointer"
          >
            Start Playing 🎉
          </button>
        </div>
      )}

      {/* exit modal */}
      {showExit && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md cursor-default">
          <div className="w-[min(90vw,420px)] rounded-3xl bg-[oklch(0.22_0.04_280)] p-8 shadow-2xl">
            <h2 className="mb-2 text-2xl font-bold text-foreground">Exit play mode?</h2>
            <p className="mb-6 text-sm text-foreground/70">
              Solve to confirm you're a grown-up:
            </p>
            <div className="mb-4 rounded-2xl bg-background/40 p-5 text-center text-3xl font-bold text-foreground">
              {mathQ.a} + {mathQ.b} = ?
            </div>
            <input
              autoFocus
              type="number"
              value={mathAns}
              onChange={(e) => {
                setMathAns(e.target.value);
                setMathErr(false);
              }}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter") confirmExit();
              }}
              className={`mb-4 w-full rounded-xl border-2 ${
                mathErr ? "border-destructive" : "border-foreground/20"
              } bg-background/40 px-4 py-3 text-center text-2xl text-foreground outline-none focus:border-foreground/60`}
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowExit(false)}
                className="flex-1 rounded-xl bg-foreground/10 py-3 font-semibold text-foreground hover:bg-foreground/20"
              >
                Keep playing
              </button>
              <button
                onClick={confirmExit}
                className="flex-1 rounded-xl bg-destructive py-3 font-semibold text-destructive-foreground hover:opacity-90"
              >
                Exit
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function BurstFx({ burst }: { burst: Burst }) {
  const color = `oklch(0.8 0.25 ${burst.hue})`;
  const glow = `oklch(0.7 0.3 ${burst.hue})`;

  return (
    <>
      {/* expanding ring */}
      <span
        className="pointer-events-none absolute rounded-full"
        style={{
          left: `${burst.x}%`,
          top: `${burst.y}%`,
          width: "10rem",
          height: "10rem",
          border: `4px solid ${color}`,
          transform: "translate(-50%, -50%)",
          animation: "burstRing 1s ease-out forwards",
          boxShadow: `0 0 60px ${glow}`,
        }}
      />
      {/* big letter */}
      <span
        className="pointer-events-none absolute font-black"
        style={{
          left: `${burst.x}%`,
          top: `${burst.y}%`,
          fontSize: "10rem",
          color,
          textShadow: `0 0 40px ${glow}, 0 0 80px ${glow}`,
          transform: "translate(-50%, -50%)",
          animation: "burstLetter 1s ease-out forwards",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        {burst.char}
      </span>
      <style>{`
        @keyframes burstRing {
          0% { transform: translate(-50%, -50%) scale(0.2); opacity: 1; }
          100% { transform: translate(-50%, -50%) scale(2.5); opacity: 0; }
        }
        @keyframes burstLetter {
          0% { transform: translate(-50%, -50%) scale(0.3) rotate(-15deg); opacity: 0; }
          30% { transform: translate(-50%, -50%) scale(1.2) rotate(5deg); opacity: 1; }
          100% { transform: translate(-50%, -50%) scale(1) rotate(0deg); opacity: 0; }
        }
      `}</style>
    </>
  );
}
