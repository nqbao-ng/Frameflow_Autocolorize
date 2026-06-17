import {
  Brush, PenLine, Layers, Eraser, Pipette,
  Blend, Sun, Scissors,
} from "lucide-react";
import React from "react";
import type { Tool, BlendMode } from "../types";

export const HERO_IMG =
  "https://images.unsplash.com/photo-1563393471486-370b35d7de64?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhbmltZSUyMGFuaW1hdGlvbiUyMGZyYW1lJTIwY29sb3JmdWx8ZW58MXx8fHwxNzcyNzI3ODQzfDA&ixlib=rb-4.1.0&q=80&w=1080";

export const SPEEDS = ["0.25x", "0.5x", "1x", "2x"];

export const PALETTE_ROWS: string[][] = [
  ["#FDDBB4","#F5C49A","#EAA87A","#D4875B","#B5663C","#8B4513","#5C2E0A","#3B1A06","#FFF0E0","#FFE4C4"],
  ["#FF6B9D","#FF4081","#E91E63","#C2185B","#F48FB1","#FF80AB","#FF1744","#D32F2F","#FFCDD2","#B71C1C"],
  ["#FFB74D","#FF9800","#F57C00","#E65100","#FFEB3B","#FDD835","#F9A825","#FF6F00","#FFF9C4","#FFF3E0"],
  ["#A5D6A7","#66BB6A","#43A047","#2E7D32","#B9F6CA","#69F0AE","#00E676","#00C853","#1B5E20","#E8F5E9"],
  ["#90CAF9","#42A5F5","#1E88E5","#1565C0","#80DEEA","#26C6DA","#00ACC1","#00838F","#E3F2FD","#0D47A1"],
  ["#CE93D8","#AB47BC","#8E24AA","#6A1B9A","#B39DDB","#7E57C2","#5E35B1","#4527A0","#EDE7F6","#311B92"],
  ["#FFFFFF","#F5F5F5","#EEEEEE","#E0E0E0","#BDBDBD","#9E9E9E","#757575","#616161","#424242","#000000"],
];

export const TOOLS: { id: Tool; icon: React.ReactNode; label: string; shortcut: string }[] = [
  { id: "brush",   icon: React.createElement(Brush,   { size: 14 }), label: "Brush",   shortcut: "B" },
  { id: "pencil",  icon: React.createElement(PenLine, { size: 14 }), label: "Pencil",  shortcut: "P" },
  { id: "fill",    icon: React.createElement(Layers,  { size: 14 }), label: "Fill",    shortcut: "F" },
  { id: "eraser",  icon: React.createElement(Eraser,  { size: 14 }), label: "Eraser",  shortcut: "E" },
  { id: "picker",  icon: React.createElement(Pipette, { size: 14 }), label: "Picker",  shortcut: "I" },
  { id: "smudge",  icon: React.createElement(Blend,   { size: 14 }), label: "Smudge",  shortcut: "U" },
  { id: "dodge",   icon: React.createElement(Sun,     { size: 14 }), label: "Dodge",   shortcut: "D" },
  { id: "burn",    icon: React.createElement(Scissors,{ size: 14 }), label: "Burn",    shortcut: "O" },
];

export const BLEND_MODES: { value: BlendMode; label: string }[] = [
  { value: "source-over", label: "Normal" },
  { value: "multiply",    label: "Multiply" },
  { value: "screen",      label: "Screen" },
  { value: "overlay",     label: "Overlay" },
  { value: "soft-light",  label: "Soft Light" },
  { value: "hard-light",  label: "Hard Light" },
  { value: "color-dodge", label: "Color Dodge" },
  { value: "color-burn",  label: "Color Burn" },
];