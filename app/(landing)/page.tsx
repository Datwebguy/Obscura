"use client";

import { useEffect, useRef, useState } from "react";
import { animate, motion, useMotionValue, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  Chrome,
  EyeOff,
  Fingerprint,
  LockKeyhole,
  Send,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ObscuraLogo } from "../obscura-logo";
import { ThemeControls } from "../theme-controls";

type ShowcaseScreen = {
  actions: string[];
  label: string;
  status: string;
  title: string;
  icon: LucideIcon;
  rows: Array<[string, string]>;
};

const showcaseScreens: ShowcaseScreen[] = [
  {
    label: "// PRIVATE BALANCE",
    title: "Private XLM Balance",
    icon: LockKeyhole,
    status: "Unlock Balance",
    actions: ["Unlock", "Refresh", "Shield"],
    rows: [
      ["Source", "Encrypted SPP notes"],
      ["Refresh", "Every 10 seconds"],
      ["Public wallet", "Shown separately"],
    ],
  },
  {
    label: "// SHIELD XLM",
    title: "Make XLM Private",
    icon: ShieldCheck,
    status: "Official SPP Pool",
    actions: ["Amount", "Approve", "Verify"],
    rows: [
      ["Enrollment", "Automatic"],
      ["ZK proof", "Generated in browser"],
      ["Network", "Stellar Testnet"],
    ],
  },
  {
    label: "// PRIVATE SEND",
    title: "Send Private XLM",
    icon: Send,
    status: "Payment Details Hidden",
    actions: ["Recipient", "Amount", "Approve"],
    rows: [
      ["Recipient", "Private address"],
      ["Delivery", "Encrypted note"],
      ["Proof", "Verified on Soroban"],
    ],
  },
  {
    label: "// PRIVATE RECEIVING",
    title: "Receive Private XLM",
    icon: WalletCards,
    status: "Private Address Ready",
    actions: ["Connect", "Unlock", "Receive"],
    rows: [
      ["Setup", "One wallet message"],
      ["Incoming funds", "Private Balance"],
      ["Public balance", "Unchanged"],
    ],
  },
];

const principles = [
  {
    title: "Security",
    copy: "Wallet keys and private note decryption stay under the user's control.",
    icon: LockKeyhole,
  },
  {
    title: "Privacy",
    copy: "Shielded transfers hide activity from observers while keeping users in control.",
    icon: EyeOff,
  },
  {
    title: "Full Control",
    copy: "Connect your existing Stellar wallet and choose when to shield, send, or unshield.",
    icon: Fingerprint,
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0 },
};

function DiscordGlyph() {
  return (
    <span className="discord-glyph" aria-hidden="true">
      <span />
      <span />
    </span>
  );
}

function FrameRails() {
  return (
    <>
      <span className="side-rail side-rail-left" aria-hidden="true" />
      <span className="side-rail side-rail-right" aria-hidden="true" />
      <span className="rail-diamond rail-diamond-left" aria-hidden="true" />
      <span className="rail-diamond rail-diamond-right" aria-hidden="true" />
    </>
  );
}

function CornerButton({
  children,
  href,
  large = false,
}: {
  children: React.ReactNode;
  href: string;
  large?: boolean;
}) {
  return (
    <a className={large ? "corner-button corner-button-large" : "corner-button"} href={href}>
      <span className="button-corner top-left" />
      <span className="button-corner top-right" />
      <span className="button-corner bottom-left" />
      <span className="button-corner bottom-right" />
      {children}
    </a>
  );
}

function WalletPreview() {
  return (
    <div className="wallet-preview">
      <div className="preview-topbar">
        <span />
        <span />
        <span />
        <strong>Obscura Wallet</strong>
        <span className="preview-network">Testnet</span>
      </div>
      <div className="private-strip">OFFICIAL SPP TESTNET</div>
      <div className="preview-balance">
        <small>Private XLM Balance</small>
        <strong>Unlock Balance</strong>
        <span>Decrypt private notes in this browser</span>
      </div>
      <div className="preview-grid">
        {["Shield XLM", "Private Send", "Unshield", "Activity"].map((item) => (
          <span key={item}>{item}</span>
        ))}
      </div>
    </div>
  );
}

function ShowcaseCard({ screen }: { screen: ShowcaseScreen }) {
  const Icon = screen.icon;

  return (
    <motion.article
      className="showcase-card"
      whileHover={{ y: -8, scale: 1.02 }}
      transition={{ type: "spring", stiffness: 220, damping: 20 }}
    >
      <p>{screen.label}</p>
      <div className="showcase-device">
        <div className="showcase-title">
          <strong>{screen.title}</strong>
          <Icon size={18} />
        </div>
        <div className="showcase-body">
          <div className="showcase-main">
            <small>Live Workflow</small>
            <strong>{screen.status}</strong>
          </div>
          <div className="showcase-actions">
            {screen.actions.map((action) => (
              <span key={action}>{action}</span>
            ))}
          </div>
          {screen.rows.map(([label, value]) => (
            <div className="showcase-row" key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
      </div>
    </motion.article>
  );
}

function ShowcaseCarousel() {
  const [isCompact, setIsCompact] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [loopWidth, setLoopWidth] = useState(0);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const x = useMotionValue(0);
  const shouldReduceMotion = useReducedMotion();
  const loopScreens = isCompact
    ? showcaseScreens
    : [...showcaseScreens, ...showcaseScreens];

  useEffect(() => {
    const media = window.matchMedia("(max-width: 700px)");
    const updateMode = () => setIsCompact(media.matches);
    updateMode();
    media.addEventListener("change", updateMode);
    return () => media.removeEventListener("change", updateMode);
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const measureTrack = () => {
      const firstDuplicate = track.children[showcaseScreens.length] as HTMLElement | undefined;
      setLoopWidth(firstDuplicate?.offsetLeft ?? track.scrollWidth / 2);
    };

    measureTrack();

    const observer = new ResizeObserver(measureTrack);
    observer.observe(track);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (isCompact) {
      x.set(0);
      return;
    }
    if (shouldReduceMotion || isPaused || loopWidth <= 0) return;

    let stopped = false;
    let controls: ReturnType<typeof animate> | null = null;
    const pixelsPerSecond = 58;

    const runLoop = () => {
      const currentX = x.get();
      const normalizedX = currentX <= -loopWidth ? 0 : currentX;
      const remainingDistance = loopWidth + Math.abs(normalizedX);

      x.set(normalizedX);

      controls = animate(x, -loopWidth, {
        duration: remainingDistance / pixelsPerSecond,
        ease: "linear",
        onComplete: () => {
          if (stopped) return;
          x.set(0);
          runLoop();
        },
      });
    };

    runLoop();

    return () => {
      stopped = true;
      controls?.stop();
    };
  }, [isCompact, isPaused, loopWidth, shouldReduceMotion, x]);

  return (
    <div
      className="showcase-marquee"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onBlur={() => setIsPaused(false)}
      aria-label={
        isCompact
          ? "Swipe through Obscura wallet screens"
          : "Auto scrolling Obscura wallet screens"
      }
    >
      <motion.div className="showcase-track" ref={trackRef} style={{ x }}>
        {loopScreens.map((screen, index) => (
          <ShowcaseCard screen={screen} key={`${screen.label}-${index}`} />
        ))}
      </motion.div>
    </div>
  );
}

export default function LandingPage() {
  return (
    <main className="stellar-landing">
      <div className="stellar-frame">
        <FrameRails />

        <header className="stellar-nav">
          <a className="brand-lockup" href="#" aria-label="Obscura home">
            <span className="brand-chip">
              <ObscuraLogo className="obscura-logo-landing" />
              <strong>OBSCURA</strong>
            </span>
          </a>

          <div className="nav-right">
            <nav aria-label="Primary navigation">
              <a href="#privacy">Privacy</a>
              <a href="#features">Features</a>
              <a href="#support">Support</a>
            </nav>

            <ThemeControls />
            <button className="discord-button" type="button" aria-label="Community">
              <DiscordGlyph />
            </button>

            <CornerButton href="/wallet">
              <Chrome size={23} />
              <span>Launch App</span>
            </CornerButton>
          </div>
        </header>

        <motion.section
          className="hero"
          initial="hidden"
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.12 } } }}
        >
          <motion.div className="privacy-badge" variants={fadeUp}>
            <span />
            BUILT FOR PRIVACY
          </motion.div>

          <motion.div className="hero-brand-name" variants={fadeUp}>
            OBSCURA
          </motion.div>

          <motion.h1 variants={fadeUp}>
            YOUR WALLET IS FINALLY PRIVATE
          </motion.h1>

          <motion.p variants={fadeUp}>
            Shield your tokens, send privately, and manage Stellar assets without exposing balances
            or transaction history to the world.
          </motion.p>

          <motion.div variants={fadeUp}>
            <CornerButton href="/wallet" large>
              <ShieldCheck size={22} />
              <span>Launch Obscura</span>
              <ArrowRight size={25} />
            </CornerButton>
          </motion.div>
        </motion.section>

        <section className="preview-band" id="features">
          <span className="preview-corner preview-corner-left" />
          <span className="preview-corner preview-corner-right" />
          <WalletPreview />
        </section>

        <section className="showcase-section">
          <div className="section-heading">
            <p>// LIVE PRODUCT FLOWS</p>
            <h2>
              INSIDE <span>OBSCURA</span>
            </h2>
            <small>
              Every screen below reflects a workflow available in the current
              Testnet build.
            </small>
          </div>
          <ShowcaseCarousel />
        </section>

        <section className="privacy-section" id="privacy">
          <div className="section-heading">
            <p>// PRIVACY ARCHITECTURE</p>
            <h2>
              PRIVATE BY <span>DESIGN</span>
            </h2>
            <small>
              When you shield your assets, balances and transactions become invisible to outside
              observers. Obscura keeps private payments simple and user controlled.
            </small>
          </div>

          <div className="principle-grid">
            {principles.map(({ title, copy, icon: Icon }) => (
              <article key={title}>
                <div className="principle-visual">
                  <Icon size={44} />
                </div>
                <h3>{title}</h3>
                <p>{copy}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="social-section">
          <div className="section-heading">
            <p>// LIVE ARCHITECTURE</p>
            <h2>
              REAL ZK ON <span>STELLAR</span>
            </h2>
          </div>
          <div className="quote-grid">
            {[
              ["Official SPP Pool", "Uses the existing Stellar Private Payments Testnet contracts."],
              ["Browser Proofs", "Generates privacy proofs locally and verifies them on Soroban."],
              ["Your Stellar Wallet", "Connects an existing wallet without taking custody of its keys."],
            ].map(([title, copy]) => (
              <article key={title}>
                <strong>{title}</strong>
                <p>{copy}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="ready-section">
          <h2>
            READY TO GO <span>PRIVATE?</span>
          </h2>
          <CornerButton href="/wallet">
            <Chrome size={20} />
            <span>Launch App</span>
          </CornerButton>
        </section>

        <footer className="minimal-footer" id="support">
          <div>
            <strong>OBSCURA</strong>
            <span>Private payments for Stellar Hacks: Real World ZK.</span>
          </div>
          <nav>
            <a href="#privacy">Privacy</a>
            <a href="#features">Features</a>
            <a href="/wallet">Launch App</a>
          </nav>
          <span>© 2026 Obscura</span>
        </footer>
      </div>
    </main>
  );
}
