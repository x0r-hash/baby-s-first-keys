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
  size: number;
  showLetter: boolean;
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

type Level = 1 | 2 | 3 | 4 | 5;

const LEVEL_INFO: Record<
  Level,
  { age: string; title: string; tag: string; emoji: string; hue: number }
> = {
  1: { age: "16 months", title: "Sensory", tag: "Press → boop", emoji: "🟡", hue: 60 },
  2: { age: "18 months", title: "Variation", tag: "Different every time", emoji: "🟢", hue: 140 },
  3: { age: "20 months", title: "Patterns", tag: "Same key, same magic", emoji: "🔵", hue: 220 },
  4: { age: "22 months", title: "Control", tag: "Build your scene", emoji: "🟣", hue: 290 },
  5: { age: "24 months", title: "Music Play", tag: "Letters & notes", emoji: "🔴", hue: 20 },
};

const FRIENDLY_HUES = [10, 30, 50, 130, 180, 200, 270, 320];
const SHAPES: Burst["shape"][] = ["circle", "star", "bubble", "ring"];
const PENTATONIC = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99];
const FUN_FREQS = [180, 240, 320]; // boop sounds
const SURPRISE_EMOJI = ["🐶", "🐱", "🌟", "🌈", "🎈", "🍎", "🦄", "🐝", "🌸", "🐳", "🦋", "🍓"];

const LEVEL_KEY = "babykeys.level";

function Index() {
  const [bursts, setBursts] = useState<Burst[]>([]);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [bgHue, setBgHue] = useState(260);
  const [showExit, setShowExit] = useState(false);
  const [locked, setLocked] = useState(false);
  const [level, setLevel] = useState<Level>(1);
  const [mathQ, setMathQ] = useState({ a: 0, b: 0 });
  const [mathAns, setMathAns] = useState("");
  const [mathErr, setMathErr] = useState(false);
  const [flash, setFlash] = useState<{ id: number; hue: number } | null>(null);
  const [melody, setMelody] = useState<string[]>([]);

  const [isTouch, setIsTouch] = useState(false);
  const [tapeActive, setTapeActive] = useState<string | null>(null);

  const idRef = useRef(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const lastKeyRef = useRef<{ key: string; count: number; time: number }>({
    key: "",
    count: 0,
    time: 0,
  });
  const heldKeysRef = useRef<Map<string, number>>(new Map());

  // Load persisted level
  useEffect(() => {
    const saved = localStorage.getItem(LEVEL_KEY);
    if (saved) {
      const n = parseInt(saved, 10) as Level;
      if (n >= 1 && n <= 5) setLevel(n);
    }
    // Detect touch device
    const touch =
      "ontouchstart" in window ||
      navigator.maxTouchPoints > 0 ||
      window.matchMedia("(pointer: coarse)").matches;
    setIsTouch(touch);
  }, []);

  const [tapeKeys, setTapeKeys] = useState<{ id: number; char: string; hue: number }[]>([]);

  const saveLevel = (l: Level) => {
    setLevel(l);
    setMelody([]);
    localStorage.setItem(LEVEL_KEY, String(l));
  };

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

  const playSound = useCallback(
    (key: string, lvl: Level) => {
      const ctx = ensureAudio();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      const keySum = key.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
      let freq: number;
      let type: OscillatorType = "triangle";
      let dur = 0.5;
      let vol = 0.18;

      if (lvl === 1) {
        // single soft boop
        freq = 320;
        type = "sine";
        dur = 0.25;
        vol = 0.16;
      } else if (lvl === 2) {
        // 2-3 different soft sounds
        freq = FUN_FREQS[keySum % FUN_FREQS.length];
        type = "sine";
        dur = 0.35;
      } else if (lvl === 3) {
        // numbers → fun sounds, letters → notes
        if (/[0-9]/.test(key)) {
          freq = FUN_FREQS[keySum % FUN_FREQS.length];
          type = "square";
          vol = 0.12;
        } else {
          freq = PENTATONIC[keySum % PENTATONIC.length];
        }
      } else if (lvl === 4) {
        // letters → notes, numbers → sounds; rhythm builds via repetition
        freq = /[0-9]/.test(key)
          ? FUN_FREQS[keySum % FUN_FREQS.length]
          : PENTATONIC[keySum % PENTATONIC.length];
        dur = 0.4;
      } else {
        // level 5 — full scale, allow rich layering
        freq = PENTATONIC[keySum % PENTATONIC.length];
        dur = 0.7;
      }

      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      if (lvl >= 2) {
        osc.frequency.exponentialRampToValueAtTime(freq * 1.3, now + 0.04);
        osc.frequency.exponentialRampToValueAtTime(freq, now + 0.12);
      }

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(vol, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + dur + 0.05);

      // Level 5 — soft chord (perfect fifth) for richer musical feel
      if (lvl === 5) {
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = "sine";
        osc2.frequency.setValueAtTime(freq * 1.5, now);
        gain2.gain.setValueAtTime(0, now);
        gain2.gain.linearRampToValueAtTime(vol * 0.6, now + 0.01);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + dur);
        osc2.connect(gain2).connect(ctx.destination);
        osc2.start(now);
        osc2.stop(now + dur + 0.05);
      }
    },
    [ensureAudio]
  );

  const spawnBurst = useCallback(
    (key: string, lvl: Level) => {
      const id = ++idRef.current;
      const upper = key.length === 1 ? key.toUpperCase() : key === " " ? "★" : "✦";
      const isDigit = /^[0-9]$/.test(key);
      const isLetter = /^[a-zA-Z]$/.test(key);

      // repetition tracking
      const now = Date.now();
      if (lastKeyRef.current.key === key && now - lastKeyRef.current.time < 1500) {
        lastKeyRef.current.count++;
      } else {
        lastKeyRef.current = { key, count: 1, time: now };
      }
      lastKeyRef.current.time = now;
      const repCount = lastKeyRef.current.count;

      let hue: number;
      let shape: Burst["shape"];
      let size = 1;
      let showLetter = false;
      let particleCount = 0;
      let maxBursts = 1;

      let displayChar = upper;

      if (lvl === 1) {
        // identical-style response, single big blob, replaces previous
        // FEATURE: full-screen soft color wash flash on every press
        hue = FRIENDLY_HUES[Math.floor(Math.random() * FRIENDLY_HUES.length)];
        shape = "circle";
        size = 1.4;
        maxBursts = 0; // replace
        setFlash({ id, hue });
        setTimeout(() => setFlash((f) => (f && f.id === id ? null : f)), 320);
      } else if (lvl === 2) {
        // random color/size, 1-2 elements, simple
        // FEATURE: surprise friendly emoji ~30% of the time
        hue = FRIENDLY_HUES[Math.floor(Math.random() * FRIENDLY_HUES.length)];
        shape = "circle";
        size = 0.7 + Math.random() * 0.9;
        maxBursts = 1;
        if (Math.random() < 0.3) {
          displayChar = SURPRISE_EMOJI[Math.floor(Math.random() * SURPRISE_EMOJI.length)];
          showLetter = true;
        }
      } else if (lvl === 3) {
        // consistent per key — hash key to hue/shape
        // FEATURE: ALWAYS show pressed letter/number for early recognition
        const keySum = key.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
        hue = FRIENDLY_HUES[keySum % FRIENDLY_HUES.length];
        shape = SHAPES[keySum % SHAPES.length];
        size = 1;
        showLetter = isLetter || isDigit;
        maxBursts = 2;
      } else if (lvl === 4) {
        // letters → shapes, numbers → sound emphasis; repetition grows
        // FEATURE: streak fireworks — 3+ same-key presses trigger a big bloom + show char
        const keySum = key.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
        hue = FRIENDLY_HUES[keySum % FRIENDLY_HUES.length];
        shape = isDigit ? "ring" : SHAPES[keySum % SHAPES.length];
        size = Math.min(0.8 + repCount * 0.15, 2);
        particleCount = Math.min(8 + repCount * 4, 30);
        maxBursts = 4;
        if (repCount >= 3) {
          particleCount = 50;
          showLetter = isLetter || isDigit;
        }
      } else {
        // level 5 — rich, persistent, letter+note pairing
        // FEATURE: melody trail HUD records last pressed keys
        const keySum = key.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
        hue = FRIENDLY_HUES[keySum % FRIENDLY_HUES.length];
        shape = SHAPES[keySum % SHAPES.length];
        size = 1.1;
        showLetter = isLetter || isDigit;
        particleCount = 18;
        maxBursts = 7;
        if (isLetter || isDigit) {
          setMelody((m) => [...m.slice(-11), upper]);
        }
      }

      const x = 10 + Math.random() * 80;
      const y = 15 + Math.random() * 70;
      setBgHue(hue);

      setBursts((b) => {
        const next = [...b.slice(-maxBursts), { id, x, y, char: displayChar, hue, shape, size, showLetter }];
        return next;
      });

      if (particleCount > 0) {
        const newParticles: Particle[] = Array.from({ length: particleCount }, (_, i) => {
          const angle = (Math.PI * 2 * i) / particleCount + Math.random() * 0.5;
          const speed = 1 + Math.random() * 2.5;
          return {
            id: id * 100 + i,
            x,
            y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 1,
            hue: hue + (Math.random() * 40 - 20),
            size: 0.4 + Math.random() * 1.2,
          };
        });
        setParticles((p) => [...p.slice(-200), ...newParticles]);
      }

      // persistence by level
      const lifetime =
        lvl === 1 ? 700 : lvl === 2 ? 1000 : lvl === 3 ? 1500 : lvl === 4 ? 2000 : 2800;
      setTimeout(() => {
        setBursts((b) => b.filter((x) => x.id !== id));
      }, lifetime);
    },
    []
  );

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

  // Level 5 — held key continuous effect
  useEffect(() => {
    if (level !== 5 || !locked) return;
    const interval = setInterval(() => {
      heldKeysRef.current.forEach((startTime, key) => {
        if (Date.now() - startTime > 200) {
          spawnBurst(key, 5);
          playSound(key, 5);
        }
      });
    }, 220);
    return () => clearInterval(interval);
  }, [level, locked, spawnBurst, playSound]);

  // keydown listener
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && (e.key === "e" || e.key === "E")) {
        e.preventDefault();
        const a = Math.floor(Math.random() * 8) + 2;
        const b = Math.floor(Math.random() * 8) + 2;
        setMathQ({ a, b });
        setMathAns("");
        setMathErr(false);
        setShowExit(true);
        return;
      }

      // If exit modal is open or not locked, let the input/browser handle keys normally
      if (showExit || !locked) return;

      if (
        (e.ctrlKey || e.metaKey) &&
        ["t", "w", "n", "r", "p", "s", "f", "l", "j", "h"].includes(e.key.toLowerCase())
      ) {
        e.preventDefault();
      }
      if (e.key === "F5" || (e.key === "Tab" && e.altKey)) e.preventDefault();
      if (e.key === "Backspace" || e.key === "Escape") e.preventDefault();

      e.preventDefault();
      if (e.repeat) return; // we handle continuous via held map for level 5

      if (level === 5 && !heldKeysRef.current.has(e.key)) {
        heldKeysRef.current.set(e.key, Date.now());
      }

      triggerKey(e.key);
    };

    const triggerKeyRef = triggerKey;
    void triggerKeyRef;

    const upHandler = (e: KeyboardEvent) => {
      heldKeysRef.current.delete(e.key);
    };

    const prevent = (ev: Event) => ev.preventDefault();
    window.addEventListener("keydown", handler);
    window.addEventListener("keyup", upHandler);
    window.addEventListener("contextmenu", prevent);
    window.addEventListener("dragstart", prevent);
    window.addEventListener("selectstart", prevent);

    return () => {
      window.removeEventListener("keydown", handler);
      window.removeEventListener("keyup", upHandler);
      window.removeEventListener("contextmenu", prevent);
      window.removeEventListener("dragstart", prevent);
      window.removeEventListener("selectstart", prevent);
    };
  }, [ensureAudio, playSound, spawnBurst, showExit, locked, level]);

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

  const current = LEVEL_INFO[level];

  return (
    <main
      className="relative h-screen w-screen overflow-hidden select-none"
      style={{
        background: `radial-gradient(ellipse at center, oklch(0.35 0.18 ${bgHue}) 0%, oklch(0.15 0.08 ${
          bgHue + 40
        }) 70%, oklch(0.08 0.04 ${bgHue + 80}) 100%)`,
        transition: "background 0.4s ease",
        cursor: locked ? "none" : "default",
      }}
    >
      {/* L1 full-screen color wash */}
      {flash && (
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: `radial-gradient(circle, oklch(0.7 0.2 ${flash.hue} / 0.45), transparent 70%)`,
            animation: "flashWash 320ms ease-out forwards",
          }}
        />
      )}
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

      {bursts.map((b) => (
        <BurstFx key={b.id} burst={b} />
      ))}

      {/* start screen */}
      {!locked && !showExit && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 overflow-y-auto py-10">
          <div className="mb-4 text-7xl animate-bounce">🧸</div>
          <h1 className="mb-3 text-5xl md:text-6xl font-black tracking-tight text-foreground drop-shadow-[0_4px_20px_rgba(255,255,255,0.3)]">
            Baby Keys Playground
          </h1>
          <p className="mb-8 text-base text-foreground/70">
            Pick a level for your little one ✨
          </p>

          <div className="grid w-full max-w-3xl grid-cols-2 gap-3 md:grid-cols-5 mb-8">
            {([1, 2, 3, 4, 5] as Level[]).map((l) => {
              const info = LEVEL_INFO[l];
              const active = l === level;
              return (
                <button
                  key={l}
                  onClick={() => saveLevel(l)}
                  className={`group rounded-2xl p-4 text-left transition-all ${
                    active
                      ? "scale-105 shadow-[0_10px_40px_-5px_oklch(0.7_0.25_280)]"
                      : "hover:scale-105 opacity-70 hover:opacity-100"
                  }`}
                  style={{
                    background: active
                      ? `linear-gradient(135deg, oklch(0.45 0.2 ${info.hue}), oklch(0.3 0.15 ${info.hue + 40}))`
                      : "oklch(0.25 0.04 280)",
                  }}
                >
                  <div className="text-3xl mb-1">{info.emoji}</div>
                  <div className="text-xs uppercase tracking-wider text-foreground/60">
                    Level {l}
                  </div>
                  <div className="text-lg font-bold text-foreground">{info.title}</div>
                  <div className="text-xs text-foreground/70 mt-1">{info.age}</div>
                  <div className="text-[11px] text-foreground/50 mt-1">{info.tag}</div>
                </button>
              );
            })}
          </div>

          <button
            onClick={enterPlay}
            className="rounded-full bg-gradient-to-r from-[oklch(0.75_0.2_30)] via-[oklch(0.75_0.2_180)] to-[oklch(0.75_0.2_300)] px-12 py-5 text-2xl font-bold text-background shadow-[0_10px_40px_-5px_oklch(0.7_0.25_280)] transition hover:scale-105 active:scale-95"
          >
            Start Level {level} {current.emoji}
          </button>
          <p className="mt-6 text-xs text-foreground/50">
            Parents: press <kbd className="px-2 py-0.5 rounded bg-foreground/10">Ctrl</kbd> +{" "}
            <kbd className="px-2 py-0.5 rounded bg-foreground/10">E</kbd> anytime to exit
          </p>
        </div>
      )}

      {/* exit modal */}
      {showExit && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md cursor-default">
          <div className="w-[min(90vw,420px)] rounded-3xl bg-[oklch(0.22_0.04_280)] p-8 shadow-2xl">
            <h2 className="mb-2 text-2xl font-bold text-foreground">Parent menu</h2>
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

            {/* Quick level switch */}
            <div className="mb-4">
              <p className="text-xs text-foreground/60 mb-2">Switch level (no exit needed):</p>
              <div className="flex gap-1">
                {([1, 2, 3, 4, 5] as Level[]).map((l) => (
                  <button
                    key={l}
                    onClick={() => {
                      if (parseInt(mathAns, 10) === mathQ.a + mathQ.b) {
                        saveLevel(l);
                        setShowExit(false);
                      } else {
                        setMathErr(true);
                      }
                    }}
                    className={`flex-1 rounded-lg py-2 text-sm font-bold ${
                      l === level
                        ? "bg-foreground text-background"
                        : "bg-foreground/10 text-foreground hover:bg-foreground/20"
                    }`}
                  >
                    {LEVEL_INFO[l].emoji}
                    <div className="text-[10px] font-normal opacity-70">L{l}</div>
                  </button>
                ))}
              </div>
            </div>

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

      {/* tiny level indicator while playing */}
      {locked && !showExit && (
        <div className="pointer-events-none absolute bottom-3 right-4 text-xs text-foreground/30">
          L{level} {current.emoji}
        </div>
      )}

      {/* L5 melody trail HUD */}
      {locked && !showExit && level === 5 && melody.length > 0 && (
        <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 px-4 py-2 rounded-full bg-foreground/10 backdrop-blur-sm">
          {melody.map((c, i) => (
            <span
              key={i}
              className="text-foreground/80 font-bold text-base"
              style={{ opacity: 0.4 + (i / melody.length) * 0.6 }}
            >
              {c}
            </span>
          ))}
        </div>
      )}

      <style>{`
        @keyframes flashWash {
          0% { opacity: 0; }
          30% { opacity: 1; }
          100% { opacity: 0; }
        }
      `}</style>
    </main>
  );
}

function BurstFx({ burst }: { burst: Burst }) {
  const color = `oklch(0.8 0.25 ${burst.hue})`;
  const glow = `oklch(0.7 0.3 ${burst.hue})`;
  const sizeRem = 10 * burst.size;

  const shapeEl = () => {
    if (burst.shape === "star") {
      return (
        <span
          className="pointer-events-none absolute font-black"
          style={{
            left: `${burst.x}%`,
            top: `${burst.y}%`,
            fontSize: `${sizeRem}rem`,
            color,
            textShadow: `0 0 40px ${glow}`,
            transform: "translate(-50%, -50%)",
            animation: "burstLetter 1.2s ease-out forwards",
            lineHeight: 1,
          }}
        >
          ★
        </span>
      );
    }
    if (burst.shape === "bubble") {
      return (
        <span
          className="pointer-events-none absolute rounded-full"
          style={{
            left: `${burst.x}%`,
            top: `${burst.y}%`,
            width: `${sizeRem}rem`,
            height: `${sizeRem}rem`,
            background: `radial-gradient(circle at 30% 30%, oklch(0.95 0.1 ${burst.hue}), ${color} 60%, transparent 70%)`,
            transform: "translate(-50%, -50%)",
            animation: "burstBubble 1.4s ease-out forwards",
          }}
        />
      );
    }
    if (burst.shape === "ring") {
      return (
        <span
          className="pointer-events-none absolute rounded-full"
          style={{
            left: `${burst.x}%`,
            top: `${burst.y}%`,
            width: `${sizeRem}rem`,
            height: `${sizeRem}rem`,
            border: `${4 * burst.size}px solid ${color}`,
            transform: "translate(-50%, -50%)",
            animation: "burstRing 1s ease-out forwards",
            boxShadow: `0 0 60px ${glow}`,
          }}
        />
      );
    }
    // circle
    return (
      <span
        className="pointer-events-none absolute rounded-full"
        style={{
          left: `${burst.x}%`,
          top: `${burst.y}%`,
          width: `${sizeRem}rem`,
          height: `${sizeRem}rem`,
          background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
          transform: "translate(-50%, -50%)",
          animation: "burstCircle 1s ease-out forwards",
        }}
      />
    );
  };

  return (
    <>
      {shapeEl()}
      {burst.showLetter && (
        <span
          className="pointer-events-none absolute font-black"
          style={{
            left: `${burst.x}%`,
            top: `${burst.y}%`,
            fontSize: "8rem",
            color: "oklch(0.98 0.02 100)",
            textShadow: `0 0 30px ${glow}, 0 0 60px ${glow}`,
            transform: "translate(-50%, -50%)",
            animation: "burstLetter 1.2s ease-out forwards",
            lineHeight: 1,
          }}
        >
          {burst.char}
        </span>
      )}
      <style>{`
        @keyframes burstRing {
          0% { transform: translate(-50%, -50%) scale(0.2); opacity: 1; }
          100% { transform: translate(-50%, -50%) scale(2.5); opacity: 0; }
        }
        @keyframes burstCircle {
          0% { transform: translate(-50%, -50%) scale(0.3); opacity: 0; }
          30% { transform: translate(-50%, -50%) scale(1.1); opacity: 1; }
          100% { transform: translate(-50%, -50%) scale(0.9); opacity: 0; }
        }
        @keyframes burstBubble {
          0% { transform: translate(-50%, -50%) scale(0.2); opacity: 0; }
          40% { transform: translate(-50%, -50%) scale(1.1); opacity: 1; }
          100% { transform: translate(-50%, -50%) scale(1.3) translateY(-30px); opacity: 0; }
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
