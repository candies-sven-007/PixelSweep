import React, { useEffect, useRef } from "react";
import { CharacterMood } from "../types";

interface PixelFarmerStageProps {
  mood: CharacterMood;
  isPlayingMusic: boolean;
  statusLine: string;
  subLine: string;
}

/**
 * Built-in zero-asset Stardew-inspired 36x28 pixel canvas animator.
 * Draws an original pastoral pixel character with distinct animated actions:
 * - idle: headphones + gentle beat bounce + floating pixel notes when music plays
 * - scanning: walking & sweeping a magnifying glass across folders with glints
 * - auditing: holding a golden alert board with flashing '!'
 * - cleaning: energetically sweeping trash with a wooden broom + dust clouds & sparkles
 * - done: celebratory jump with raised arms + golden stars
 */
export const PixelFarmerStage: React.FC<PixelFarmerStageProps> = ({
  mood,
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

    const SCALE = 5; // 36*5 = 180, 28*5 = 140
    const px = (x: number, y: number, w: number, h: number, color: string) => {
      ctx.fillStyle = color;
      ctx.fillRect(Math.round(x) * SCALE, Math.round(y) * SCALE, Math.round(w) * SCALE, Math.round(h) * SCALE);
    };

    const drawBackdrop = (f: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Cozy translucent sunlit porch floor (wooden planks + pixel grass rim)
      px(2, 22, 32, 4, "rgba(182, 134, 86, 0.45)");
      px(2, 22, 32, 1, "rgba(255, 232, 194, 0.55)");
      px(3, 25, 30, 1, "rgba(122, 82, 48, 0.35)");
      // Small pixel clover/grass sprouts on sides
      px(3, 21, 1, 1, "#6bc96b");
      px(4, 20, 1, 2, "#4aa854");
      px(31, 21, 1, 1, "#6bc96b");
      px(32, 20, 1, 2, "#4aa854");

      // Ambient floating pixel sparkles in clean/done moods
      if (mood === "done" || mood === "cleaning") {
        const s1y = 6 + ((f + 2) % 4);
        const s2y = 9 + (f % 3);
        px(6, s1y, 1, 1, "#fff3a6");
        px(29, s2y, 1, 1, "#a7f3ff");
      }
    };

    const drawFarmer = (cx: number, cy: number, f: number) => {
      // Soft shadow under boots
      px(cx - 4, 22, 9, 1, "rgba(35, 30, 45, 0.25)");

      // Straw farmer hat (warm Stardew pastoral vibe)
      px(cx - 4, cy, 9, 1, "#e8b954");
      px(cx - 5, cy + 1, 11, 2, "#f5cf6e");
      px(cx - 4, cy + 1, 9, 1, "#d95b52"); // Red hat ribbon

      // Hair + Face
      px(cx - 4, cy + 3, 9, 4, "#f9d5b2");
      px(cx - 4, cy + 3, 2, 2, "#7d4c2c"); // Side hair bangs
      px(cx + 3, cy + 3, 2, 2, "#7d4c2c");
      // Eyes
      const blink = f % 14 === 0;
      if (blink) {
        px(cx - 2, cy + 5, 2, 1, "#3b261c");
        px(cx + 1, cy + 5, 2, 1, "#3b261c");
      } else {
        px(cx - 2, cy + 4, 1, 2, "#2f2222");
        px(cx + 2, cy + 4, 1, 2, "#2f2222");
      }
      // Rosy cheeks
      px(cx - 3, cy + 6, 1, 1, "#f29696");
      px(cx + 3, cy + 6, 1, 1, "#f29696");

      // Headphones when idle/listening to music
      if (mood === "idle" && isPlayingMusic) {
        px(cx - 5, cy + 4, 1, 3, "#38bdf8");
        px(cx + 5, cy + 4, 1, 3, "#38bdf8");
      }

      // Checkered shirt + Blue denim overalls
      px(cx - 3, cy + 7, 7, 5, "#4677c4"); // Overalls body
      px(cx - 4, cy + 7, 1, 4, "#e66b5b"); // Left sleeve
      px(cx + 4, cy + 7, 1, 4, "#e66b5b"); // Right sleeve
      px(cx - 2, cy + 7, 1, 2, "#f5cf6e"); // Strap button
      px(cx + 2, cy + 7, 1, 2, "#f5cf6e");
      px(cx - 1, cy + 7, 3, 2, "#f7e3cc"); // Shirt collar

      // Walking / Standing Boots
      const step = mood === "scanning" ? (f % 2 === 0 ? 1 : -1) : 0;
      px(cx - 3 + step, cy + 12, 3, 2, "#593825");
      px(cx + 1 - step, cy + 12, 3, 2, "#593825");
    };

    const drawProp = (cx: number, cy: number, f: number) => {
      if (mood === "scanning") {
        // Magnifying glass held forward & sweeping
        const sway = f % 4 < 2 ? 0 : 1;
        const mx = cx + 6 + sway;
        const my = cy + 4 - (f % 2);
        // Handle
        px(cx + 4, cy + 8, 2, 1, "#a66838");
        px(cx + 5, cy + 7, 2, 1, "#824e28");
        // Lens rim
        px(mx, my, 4, 1, "#4a3b32");
        px(mx, my + 4, 4, 1, "#4a3b32");
        px(mx - 1, my + 1, 1, 3, "#4a3b32");
        px(mx + 4, my + 1, 1, 3, "#4a3b32");
        // Glass tint + shine
        px(mx, my + 1, 4, 3, "#8ce8ff");
        px(mx + 1, my + 1, 1, 1, "#ffffff");

        // Folder pile on floor being inspected
        px(26, 18, 5, 4, "#f0b949");
        px(26, 17, 3, 1, "#d99b2e");
        if (f % 2 === 0) {
          px(28, 15, 1, 1, "#ffffff");
        }
      } else if (mood === "cleaning") {
        // Sweeping wooden broom swinging back & forth
        const sweep = f % 2 === 0 ? 0 : 2;
        px(cx + 4, cy + 5, 1, 7, "#b57442");
        px(cx + 5, cy + 7, 1, 5, "#8f552b");
        // Red band + straw broom bristles
        px(cx + 4 + sweep, cy + 11, 3, 1, "#e05248");
        px(cx + 3 + sweep, cy + 12, 5, 2, "#f2c352");
        px(cx + 2 + sweep, cy + 13, 6, 1, "#ffe591");

        // Animated pixel dust cloud being swept away!
        const dx = 24 + (f % 3);
        const dy = 18 - (f % 2);
        px(dx, dy, 3, 2, "rgba(220, 226, 236, 0.85)");
        px(dx + 2, dy - 1, 2, 2, "rgba(240, 245, 255, 0.7)");
        px(dx + 4, dy - 2, 1, 1, "#fff6bd");
      } else if (mood === "auditing") {
        // Flashing golden alert sign next to farmer
        const pulse = f % 2 === 0 ? "#fbbf24" : "#f59e0b";
        px(cx + 7, cy + 1, 5, 5, pulse);
        px(cx + 9, cy + 2, 1, 2, "#451a03");
        px(cx + 9, cy + 5, 1, 1, "#451a03");
      } else if (mood === "done") {
        // Raised celebrating arms + golden stars
        px(cx - 5, cy + 5, 1, 3, "#e66b5b");
        px(cx + 5, cy + 5, 1, 3, "#e66b5b");
        const starY = cy - 3 + (f % 2);
        px(cx - 6, starY, 1, 1, "#ffe46b");
        px(cx + 6, starY + 1, 1, 1, "#ffe46b");
        px(cx, starY - 1, 1, 1, "#7ee8fa");
      } else if (isPlayingMusic) {
        // Floating pixel music notes!
        const n1y = 6 - (f % 4);
        const n2y = 9 - ((f + 2) % 4);
        px(cx + 7, n1y, 1, 3, "#38bdf8");
        px(cx + 8, n1y, 2, 1, "#38bdf8");
        px(cx + 6, n1y + 2, 2, 1, "#0ea5e9");

        px(cx - 8, n2y, 1, 3, "#f472b6");
        px(cx - 7, n2y, 2, 1, "#f472b6");
        px(cx - 9, n2y + 2, 2, 1, "#ec4899");
      }
    };

    const render = (now: number) => {
      if (now - lastTime >= 210) {
        lastTime = now;
        frame++;
        drawBackdrop(frame);

        let cx = 16;
        let cy = 8;
        if (mood === "scanning") {
          cx = 12 + (frame % 6 < 3 ? frame % 3 : 3 - (frame % 3));
        } else if (mood === "idle" && isPlayingMusic) {
          cy = 8 + (frame % 2);
        } else if (mood === "done") {
          cy = 7 + (frame % 2);
        }

        drawFarmer(cx, cy, frame);
        drawProp(cx, cy, frame);
      }
      rafId = requestAnimationFrame(render);
    };

    rafId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafId);
  }, [mood, isPlayingMusic]);

  return (
    <div className="pixel-stage-card">
      <div className="pixel-canvas-wrap">
        <canvas ref={canvasRef} width={180} height={140} className="pixel-canvas" />
      </div>
      <div className="pixel-stage-info">
        <div className="pixel-mood-pill">
          {mood === "idle" && (isPlayingMusic ? "惬意听歌待命中" : "待机准备就绪")}
          {mood === "scanning" && "放大镜深度扫盘中..."}
          {mood === "auditing" && "等待您审视与授权"}
          {mood === "cleaning" && "挥帚清扫垃圾中..."}
          {mood === "done" && "清扫完成，焕然一新"}
        </div>
        <h2 className="stage-title">{statusLine}</h2>
        <p className="stage-sub" title={subLine}>
          {subLine}
        </p>
      </div>
    </div>
  );
};
