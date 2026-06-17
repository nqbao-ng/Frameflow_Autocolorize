import { Sparkles, Brush, FileVideo, Upload, Wand2, Download } from "lucide-react";
import React from "react";

// ── Images ────────────────────────────────────────────────────────────────────
export const HERO_IMG =
  "https://images.unsplash.com/photo-1563393471486-370b35d7de64?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhbmltZSUyMGFuaW1hdGlvbiUyMGZyYW1lJTIwY29sb3JmdWx8ZW58MXx8fHwxNzcyNzI3ODQzfDA&ixlib=rb-4.1.0&q=80&w=1080";
export const ANIM_IMG =
  "https://images.unsplash.com/photo-1767557125491-b3483567d843?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhbmltYXRpb24lMjBjYXJ0b29uJTIwY2hhcmFjdGVyJTIwZHJhd2luZ3xlbnwxfHx8fDE3NzI3Mjc4NDV8MA&ixlib=rb-4.1.0&q=80&w=1080";

// ── Features section ──────────────────────────────────────────────────────────
export const FEATURES = [
  {
    icon: React.createElement(Sparkles, { size: 28, color: "#3B82F6" }),
    title: "AI Auto Color Propagation",
    description:
      "Our AI analyzes your frame sequences and automatically propagates colors across frames, saving hours of tedious manual work.",
    bg: "#EFF6FF",
  },
  {
    icon: React.createElement(Brush, { size: 28, color: "#8B5CF6" }),
    title: "Manual Brush & Smart Correction",
    description:
      "Precise manual brushing tools with AI-powered edge detection and smart color correction for pixel-perfect results.",
    bg: "#F5F3FF",
  },
  {
    icon: React.createElement(FileVideo, { size: 28, color: "#F59E0B" }),
    title: "Export PNG Sequence or MP4",
    description:
      "Export your colored animations in high quality — PNG frame sequences for editing or MP4 for instant sharing.",
    bg: "#FFFBEB",
  },
];

// ── Steps section ─────────────────────────────────────────────────────────────
export const STEPS = [
  {
    number: "01",
    icon: React.createElement(Upload, { size: 32, color: "#3B82F6" }),
    title: "Upload Frame Sequence",
    description: "Drop your animation frames or import from your project. Supports PNG, JPG, and PSD sequences.",
    color: "#3B82F6",
  },
  {
    number: "02",
    icon: React.createElement(Wand2, { size: 32, color: "#8B5CF6" }),
    title: "Add Reference or Let AI Auto Color",
    description: "Provide a color reference image or let FrameFlow's AI intelligently colorize your entire sequence.",
    color: "#8B5CF6",
  },
  {
    number: "03",
    icon: React.createElement(Download, { size: 32, color: "#10B981" }),
    title: "Review & Export",
    description: "Fine-tune individual frames with manual tools, then export as a PNG sequence or MP4 video.",
    color: "#10B981",
  },
];

// ── Pricing section ───────────────────────────────────────────────────────────
export const FREE_PLAN_FEATURES = [
  "720p export",
  "PNG sequence only",
  "Watermark on export",
  "Basic AI coloring",
  "5 projects",
];

export const PRO_PLAN_FEATURES = [
  "1080p export",
  "MP4 & PNG export",
  "No watermark",
  "Faster AI processing",
  "Unlimited projects",
  "Priority support",
];

// ── Hero trust badges ─────────────────────────────────────────────────────────
export const HERO_TRUST_BADGES = [
  "No credit card required",
  "Free forever plan",
  "Export in seconds",
];

// ── Footer nav links ──────────────────────────────────────────────────────────
export const FOOTER_NAV_LINKS = ["Pricing", "Download", "Learn", "Terms", "Privacy"];