import React, { useEffect, useRef } from "react";
import { CharacterMood } from "../types";

interface PixelFarmerStageProps {
  mood: CharacterMood;
  theme: "light" | "dark";
  isPlayingMusic: boolean;
  statusLine: string;
  subLine: string;
}

/**
 * Rich 72x48 pastoral pixel-art diorama rendered at crisp 3x integer scale (216x144).
 * Features:
 * - Day/Night responsive sky (pastel sky + drifting clouds vs starry twilight + fireflies)
 * - Layered rolling hills, pine trees, wooden fence, wild flowers & wooden farm deck
 * - Detailed shaded Stardew-inspired pixel farmer + cute leaf-sprout forest spirit companion
 * - Smooth animated props for each state: retro radio + floating notes (music), golden
 *   magnifying glass inspecting folders (scanning), glowing alert board (auditing),
 *   energetic sweeping broom + animated dust/sparkle puffs (cleaning), and celebration confetti (done).
 */
export const PixelFarmerStage: React.FC<PixelFarmerStageProps> = ({
  mood,
  theme,
  isPlayingMusic,
  statusLine,
  subLine,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let frame = 0;
    let rafId = 0;
    let lastTime = 0;

    const SCALE = 3; // 72*3 = 216, 48*3 = 144
    const px = (x: number, y: number, w: number, h: number, color: string) => {
      ctx.fillStyle = color;
      ctx.fillRect(
        Math.round(x) * SCALE,
        Math.round(y) * SCALE,
        Math.round(w) * SCALE,
        Math.round(h) * SCALE
      );
    };

    const drawScenery = (f: number) => {
      const dark = theme === "dark";

      // Sky gradient bands
      const skyBands = dark
        ? ["#161b33", "#1d2444", "#262f59", "#313b6e", "#3d477c"]
        : ["#8bd3ff", "#a4e0ff", "#c1ecff", "#daf4ff", "#eefaff"];
      for (let i = 0; i < skyBands.length; i++) {
        px(0, i * 6, 72, 6, skyBands[i]);
      }

      if (dark) {
        // Twinkling pixel stars & crescent moon
        px(58, 5, 4, 4, "#fef08a");
        px(60, 5, 3, 3, "#161b33");
        const stars = [
          [8, 4], [19, 8], [31, 3], [44, 7], [51, 12], [12, 13], [66, 11],
        ];
        stars.forEach(([sx, sy], idx) => {
          const bright = (f + idx) % 6 < 4;
          px(sx, sy, 1, 1, bright ? "#fef9c3" : "#64748b");
        });
      } else {
        // Warm sun + drifting fluffy pixel clouds
        px(59, 4, 5, 5, "#fde68a");
        px(60, 5, 3, 3, "#fffbeb");

        const c1 = (Math.floor(f / 3) + 6) % 80 - 8;
        const c2 = (Math.floor(f / 4) + 40) % 82 - 10;
        px(c1, 6, 8, 2, "rgba(255,255,255,0.9)");
        px(c1 + 2, 5, 4, 1, "rgba(255,255,255,0.95)");
        px(c2, 10, 10, 2, "rgba(255,255,255,0.82)");
        px(c2 + 2, 9, 5, 1, "rgba(255,255,255,0.9)");
      }

      // Distant rolling hills
      px(0, 24, 72, 9, dark ? "#1f3a3d" : "#7dc97e");
      px(4, 22, 22, 3, dark ? "#1f3a3d" : "#7dc97e");
      px(42, 21, 26, 4, dark ? "#254648" : "#6bb870");
      px(18, 25, 34, 4, dark ? "#274c48" : "#89d687");

      // Cozy pixel pine tree on left & fruit tree on right
      const drawTree = (tx: number, ty: number) => {
        px(tx + 3, ty + 9, 2, 5, dark ? "#4a3225" : "#7c4f32");
        px(tx + 1, ty + 2, 6, 7, dark ? "#1e513b" : "#3a8f50");
        px(tx, ty + 4, 8, 5, dark ? "#246348" : "#4da85f");
        px(tx + 2, ty, 4, 3, dark ? "#2e7857" : "#67c270");
        // Little pixel apples/blossoms
        px(tx + 2, ty + 5, 1, 1, "#f87171");
        px(tx + 5, ty + 3, 1, 1, "#fbbf24");
      };
      drawTree(3, 17);
      drawTree(60, 16);

      // Wooden pastoral fence across background
      const fenceCol = dark ? "#5c4030" : "#b57d4d";
      const fenceHi = dark ? "#785540" : "#d49c6a";
      px(0, 29, 72, 1, fenceHi);
      px(0, 32, 72, 1, fenceCol);
      for (let fx = 2; fx < 72; fx += 9) {
        px(fx, 27, 2, 8, fenceCol);
        px(fx, 27, 1, 8, fenceHi);
      }

      // Meadow grass foreground & wooden porch planks
      px(0, 34, 72, 6, dark ? "#224a38" : "#69bd64");
      px(0, 34, 72, 1, dark ? "#2f634b" : "#88d97c");

      // Cozy wooden deck center
      px(8, 37, 56, 11, dark ? "#4d3528" : "#b07447");
      px(8, 37, 56, 1, dark ? "#6e4d3a" : "#d89f6e");
      px(8, 41, 56, 1, dark ? "#3b271d" : "#8f5934");
      px(8, 45, 56, 1, dark ? "#3b271d" : "#8f5934");
      // Plank dividers
      for (let dx = 18; dx < 62; dx += 12) {
        px(dx, 38, 1, 3, dark ? "#3b271d" : "#8f5934");
        px(dx + 5, 42, 1, 3, dark ? "#3b271d" : "#8f5934");
      }

      // Little daisies & clovers on the left/right lawn edges
      px(2, 37, 1, 2, "#4ade80");
      px(2, 36, 1, 1, "#fef08a");
      px(5, 40, 1, 2, "#22c55e");
      px(5, 39, 1, 1, "#f9a8d4");
      px(66, 38, 1, 2, "#4ade80");
      px(66, 37, 1, 1, "#ffffff");
      px(69, 41, 1, 2, "#22c55e");
      px(69, 40, 1, 1, "#fde047");

      // Fireflies at night
      if (dark) {
        const fy1 = 22 + (f % 4);
        const fy2 = 27 - (f % 3);
        px(14 + (f % 3), fy1, 1, 1, "#fde047");
        px(54 - (f % 3), fy2, 1, 1, "#a7f3d0");
      }
    };

    const drawSpiritHelper = (sx: number, sy: number, f: number) => {
      // Cute bouncy forest sprout spirit companion (original pastel mint creature)
      const hop = mood === "done" || mood === "cleaning" ? (f % 2 === 0 ? -2 : 0) : f % 4 === 0 ? -1 : 0;
      const y = sy + hop;
      // Ground shadow
      px(sx + 1, sy + 7, 5, 1, "rgba(20, 24, 38, 0.25)");
      // Leaf sprout on top
      px(sx + 3, y - 2, 1, 2, "#22c55e");
      px(sx + 4, y - 2, 2, 1, "#4ade80");
      // Round body
      px(sx + 1, y, 5, 6, "#6ee7b7");
      px(sx, y + 1, 7, 4, "#6ee7b7");
      px(sx + 1, y + 1, 2, 1, "#d1fae5"); // Soft highlight
      px(sx + 1, y + 5, 5, 1, "#34d399"); // Bottom shading
      // Tiny cute eyes
      px(sx + 2, y + 3, 1, 1, "#1e293b");
      px(sx + 4, y + 3, 1, 1, "#1e293b");
      // Little waving arms
      const armY = f % 2 === 0 ? y + 2 : y + 3;
      px(sx - 1, armY, 1, 1, "#34d399");
      px(sx + 7, armY, 1, 1, "#34d399");
    };

    const drawFarmer = (cx: number, cy: number, f: number) => {
      // Ground shadow
      px(cx - 5, 42, 12, 2, "rgba(24, 18, 16, 0.28)");

      // Detailed Straw Hat with shading & crimson ribbon
      px(cx - 4, cy, 10, 1, "#eab308");
      px(cx - 5, cy + 1, 12, 2, "#facc15");
      px(cx - 7, cy + 3, 16, 2, "#fde047");
      px(cx - 7, cy + 4, 16, 1, "#ca8a04");
      px(cx - 5, cy + 2, 12, 1, "#ef4444"); // Red ribbon
      px(cx - 3, cy + 1, 4, 1, "#fef08a"); // Top highlight

      // Hair & Warm Expressive Face
      px(cx - 5, cy + 5, 12, 6, "#f8d0ad");
      px(cx - 5, cy + 5, 3, 3, "#784421"); // Left hair
      px(cx + 4, cy + 5, 3, 3, "#784421"); // Right hair
      px(cx - 4, cy + 5, 10, 1, "#5c3317"); // Hat shadow over forehead

      // Blinking Eyes & Smile
      const blink = f % 16 === 0;
      if (blink) {
        px(cx - 3, cy + 8, 2, 1, "#2b1d17");
        px(cx + 2, cy + 8, 2, 1, "#2b1d17");
      } else {
        px(cx - 3, cy + 7, 2, 2, "#1f191a");
        px(cx + 2, cy + 7, 2, 2, "#1f191a");
        px(cx - 3, cy + 7, 1, 1, "#ffffff"); // Eye catchlight
        px(cx + 2, cy + 7, 1, 1, "#ffffff");
      }
      // Rosy cheeks
      px(cx - 4, cy + 9, 1, 1, "#f48fb1");
      px(cx + 4, cy + 9, 1, 1, "#f48fb1");

      // Cozy Headphones when listening to music
      if (isPlayingMusic) {
        px(cx - 6, cy + 6, 2, 4, "#38bdf8");
        px(cx - 6, cy + 7, 1, 2, "#bae6fd");
        px(cx + 6, cy + 6, 2, 4, "#38bdf8");
        px(cx + 7, cy + 7, 1, 2, "#bae6fd");
      }

      // Plaid flannel shirt + shaded denim overalls
      px(cx - 4, cy + 11, 10, 7, "#3b6fc4"); // Denim torso
      px(cx - 4, cy + 15, 10, 3, "#2b549c"); // Lower shade
      px(cx - 2, cy + 11, 6, 3, "#fff1e6"); // Shirt chest
      px(cx - 3, cy + 11, 1, 4, "#3b6fc4"); // Straps
      px(cx + 4, cy + 11, 1, 4, "#3b6fc4");
      px(cx - 3, cy + 14, 1, 1, "#fbbf24"); // Brass buttons
      px(cx + 4, cy + 14, 1, 1, "#fbbf24");

      // Arms (raised in 'done' celebration, swinging in other states)
      if (mood === "done") {
        px(cx - 6, cy + 8, 2, 5, "#e05a4f");
        px(cx + 6, cy + 8, 2, 5, "#e05a4f");
        px(cx - 6, cy + 7, 2, 1, "#f8d0ad");
        px(cx + 6, cy + 7, 2, 1, "#f8d0ad");
      } else {
        const leftArmY = cy + 11 + (f % 2 === 0 ? 0 : 1);
        px(cx - 6, leftArmY, 2, 5, "#e05a4f");
        px(cx - 6, leftArmY + 4, 2, 1, "#f8d0ad");
        px(cx + 6, cy + 11, 2, 5, "#e05a4f");
        px(cx + 6, cy + 15, 2, 1, "#f8d0ad");
      }

      // Boots with walking step
      const step = mood === "scanning" ? (f % 2 === 0 ? 1 : -1) : 0;
      px(cx - 4 + step, cy + 18, 4, 3, "#5e3822");
      px(cx - 4 + step, cy + 20, 4, 1, "#3b2214");
      px(cx + 2 - step, cy + 18, 4, 3, "#5e3822");
      px(cx + 2 - step, cy + 20, 4, 1, "#3b2214");
    };

    const drawProps = (cx: number, cy: number, f: number) => {
      // Cozy retro radio on left deck when playing music
      if (isPlayingMusic) {
        const rx = 12;
        const ry = 34;
        px(rx, ry, 8, 6, "#8d5524");
        px(rx + 1, ry + 1, 6, 4, "#c68642");
        px(rx + 2, ry + 2, 2, 2, "#1e293b"); // Speaker grill
        px(rx + 5, ry + 2, 2, 1, "#38bdf8"); // Glowing tuner dial
        px(rx + 6, ry - 3, 1, 3, "#cbd5e1"); // Antenna
        // Floating animated pixel music notes
        const n1y = 26 - (f % 6);
        const n2y = 22 - ((f + 3) % 6);
        px(rx + 3, n1y, 1, 3, "#38bdf8");
        px(rx + 4, n1y, 2, 1, "#38bdf8");
        px(rx + 2, n1y + 2, 2, 1, "#0284c7");

        px(cx + 10, n2y, 1, 3, "#f472b6");
        px(cx + 11, n2y, 2, 1, "#f472b6");
        px(cx + 9, n2y + 2, 2, 1, "#db2777");
      }

      if (mood === "scanning") {
        // Detailed Golden Magnifying Glass sweeping across pixel folder stack
        const sway = f % 4 < 2 ? 0 : 2;
        const mx = cx + 10 + sway;
        const my = cy + 6 - (f % 2);
        // Wooden grip
        px(cx + 7, cy + 14, 2, 2, "#8c5228");
        px(cx + 8, cy + 12, 2, 2, "#b5703c");
        // Gold rim
        px(mx, my, 6, 1, "#d97706");
        px(mx, my + 6, 6, 1, "#d97706");
        px(mx - 1, my + 1, 1, 5, "#d97706");
        px(mx + 6, my + 1, 1, 5, "#d97706");
        // Translucent cyan lens + animated glint
        px(mx, my + 1, 6, 5, "#7dd3fc");
        px(mx + 1, my + 2, 2, 1, "#ffffff");
        px(mx + 1, my + 3, 1, 1, "#e0f2fe");

        // Stack of golden folders being scanned on right deck
        px(50, 35, 9, 6, "#f59e0b");
        px(50, 34, 4, 1, "#d97706");
        px(51, 36, 7, 1, "#fde68a");
        px(52, 32, 7, 3, "#fbbf24");
        if (f % 2 === 0) {
          px(54, 29, 1, 3, "#ffffff");
          px(53, 30, 3, 1, "#ffffff");
        }
      } else if (mood === "cleaning") {
        // Swinging wooden broom sweeping away trash scraps + sparkles
        const swing = f % 2 === 0 ? 0 : 3;
        px(cx + 7, cy + 9, 1, 10, "#9a5d2e");
        px(cx + 8, cy + 11, 1, 8, "#c27d46");
        // Red strap + straw bristles
        px(cx + 6 + swing, cy + 18, 5, 1, "#ef4444");
        px(cx + 5 + swing, cy + 19, 7, 2, "#facc15");
        px(cx + 4 + swing, cy + 21, 9, 2, "#fde047");
        px(cx + 5 + swing, cy + 22, 7, 1, "#ca8a04");

        // Animated pixel dust cloud + swept sparkles
        const dx = 48 + (f % 4) * 2;
        const dy = 36 - (f % 3);
        px(dx, dy, 4, 3, "rgba(241, 245, 249, 0.9)");
        px(dx + 3, dy - 2, 3, 3, "rgba(226, 232, 240, 0.78)");
        px(dx + 6, dy - 4, 1, 1, "#fef08a");
        px(dx + 1, dy - 4, 1, 1, "#7dd3fc");
      } else if (mood === "auditing") {
        // Glowing golden security shield alert sign
        const glow = f % 2 === 0 ? "#fbbf24" : "#f59e0b";
        px(cx + 11, cy + 2, 8, 8, glow);
        px(cx + 12, cy + 1, 6, 1, "#fef08a");
        px(cx + 12, cy + 10, 6, 1, "#b45309");
        px(cx + 14, cy + 3, 2, 4, "#451a03");
        px(cx + 14, cy + 8, 2, 1, "#451a03");
      } else if (mood === "done") {
        // Celebratory pixel sparkles & pastel confetti raining down
        const confetti = [
          [16, (f * 2) % 24 + 6, "#fde047"],
          [26, (f * 2 + 9) % 24 + 6, "#38bdf8"],
          [44, (f * 2 + 5) % 24 + 6, "#f472b6"],
          [54, (f * 2 + 13) % 24 + 6, "#4ade80"],
          [35, (f * 2 + 18) % 20 + 4, "#c084fc"],
        ] as const;
        for (const [x, y, col] of confetti) {
          px(x, y, 2, 2, col);
        }
      }
    };

    const render = (now: number) => {
      if (now - lastTime >= 200) {
        lastTime = now;
        frame++;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawScenery(frame);

        let cx = 33;
        let cy = 20;
        if (mood === "scanning") {
          cx = 26 + (frame % 8 < 4 ? frame % 4 : 4 - (frame % 4));
        } else if (mood === "done") {
          cy = 18 + (frame % 2) * 2;
        } else if (mood === "idle" && isPlayingMusic) {
          cy = 20 + (frame % 2);
        }

        // Bouncy forest spirit friend on the right/left
        const spiritX = mood === "scanning" || mood === "cleaning" ? 13 : 51;
        drawSpiritHelper(spiritX, 34, frame);

        drawFarmer(cx, cy, frame);
        drawProps(cx, cy, frame);
      }
      rafId = requestAnimationFrame(render);
    };

    rafId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafId);
  }, [mood, theme, isPlayingMusic]);

  return (
    <div className="pixel-stage-card">
      <div className="pixel-canvas-frame">
        <canvas ref={canvasRef} width={216} height={144} className="pixel-canvas" />
        <div className="pixel-frame-gloss" />
      </div>
      <div className="pixel-stage-info">
        <div className={`pixel-mood-pill mood-${mood}`}>
          <span className="mood-dot" />
          {mood === "idle" && (isPlayingMusic ? "田园听歌待命中" : "田园待机就绪")}
          {mood === "scanning" && "放大镜巡检扫描中"}
          {mood === "auditing" && "安全权限审视中"}
          {mood === "cleaning" && "挥帚深度清扫中"}
          {mood === "done" && "清扫完成 · 空间焕新"}
        </div>
        <h2 className="stage-title">{statusLine}</h2>
        <p className="stage-sub" title={subLine}>
          {subLine}
        </p>
      </div>
    </div>
  );
};
