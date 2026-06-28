export const ROLE_PRESETS = [
  { id: "skin", label: "Skin" },
  { id: "hair", label: "Hair" },
  { id: "face", label: "Face" },
  { id: "shirt", label: "Shirt / Top" },
  { id: "pants", label: "Pants / Bottom" },
  { id: "shoes", label: "Shoes" },
  { id: "accessory", label: "Accessory" },
  { id: "object", label: "Object" },
  { id: "background", label: "Background" },
  { id: "unknown", label: "Unknown" },
] as const;

export type RolePresetId = typeof ROLE_PRESETS[number]["id"];
