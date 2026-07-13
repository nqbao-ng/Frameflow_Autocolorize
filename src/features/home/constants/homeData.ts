import {
  Brush,
  Download,
  Eye,
  Images,
  Layers3,
  LockKeyhole,
  MousePointer2,
  Palette,
  ScanSearch,
  Upload,
} from "lucide-react";
import React from "react";

export const HERO_IMG = "/landing/hero-sketch.png";

export const FEATURES = [
  {
    icon: React.createElement(Layers3, { size: 27, color: "#C084FC" }),
    title: "Keyframe-Guided Propagation",
    description:
      "Color one trusted keyframe, then propagate its palette across the sketch sequence while preserving the original lineart.",
    bg: "rgba(124, 58, 237, 0.18)",
  },
  {
    icon: React.createElement(ScanSearch, { size: 27, color: "#FB7185" }),
    title: "Confidence-Aware Review",
    description:
      "FrameFlow flags uncertain regions and pauses before a weak result can become the reference for later frames.",
    bg: "rgba(255, 46, 154, 0.16)",
  },
  {
    icon: React.createElement(LockKeyhole, { size: 27, color: "#34D399" }),
    title: "Correction & Role Memory",
    description:
      "Correct a selected segment, lock its semantic role and color, then continue from a new trusted correction keyframe.",
    bg: "rgba(0, 208, 132, 0.14)",
  },
];

export const STEPS = [
  {
    number: "01",
    icon: React.createElement(Upload, { size: 25, color: "#60A5FA" }),
    title: "Upload Sketch Sequence",
    description: "Import PNG, JPG or WEBP lineart frames in sequence order.",
    color: "#60A5FA",
  },
  {
    number: "02",
    icon: React.createElement(Palette, { size: 25, color: "#C084FC" }),
    title: "Add a Colored Keyframe",
    description: "Attach a colored version to the matching sketch and use it as the reference.",
    color: "#C084FC",
  },
  {
    number: "03",
    icon: React.createElement(Images, { size: 25, color: "#F472B6" }),
    title: "Auto Color the Sequence",
    description: "Computer Vision matches regions, transfers colors and restores the original lineart.",
    color: "#F472B6",
  },
  {
    number: "04",
    icon: React.createElement(MousePointer2, { size: 25, color: "#FB923C" }),
    title: "Review Uncertain Segments",
    description: "Pick a segment, assign its role, preview the new color and apply the correction.",
    color: "#FB923C",
  },
  {
    number: "05",
    icon: React.createElement(Download, { size: 25, color: "#34D399" }),
    title: "Preview & Export",
    description: "Play the finished sequence and export individual PNGs or the complete ZIP.",
    color: "#34D399",
  },
];

export const REVIEW_POINTS = [
  {
    icon: React.createElement(Eye, { size: 18, color: "#F472B6" }),
    title: "Low-confidence overlay",
    text: "See the regions that need attention instead of checking every pixel manually.",
  },
  {
    icon: React.createElement(Brush, { size: 18, color: "#C084FC" }),
    title: "Segment recolor",
    text: "Select a region directly on the canvas and correct only that segment.",
  },
  {
    icon: React.createElement(LockKeyhole, { size: 18, color: "#34D399" }),
    title: "Trusted continuation",
    text: "Turn the corrected frame into a new keyframe and continue without carrying the error forward.",
  },
];

export const HERO_TRUST_BADGES = [
  "No credit card required",
  "Free forever plan",
  "Export in seconds",
];

export const FOOTER_NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "Workflow", href: "#workflow" },
  { label: "Pricing", href: "#pricing" },
  { label: "Human Review", href: "#review" },
];
