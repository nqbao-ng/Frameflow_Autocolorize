// Placeholder service — swap these with real API calls when backend is ready.
// The hook currently calls handleAutoColor() which simulates AI coloring.
// Move actual fetch logic here and import into useDashboard.ts.

export async function autoColorFrames(_frameUrls: string[]): Promise<void> {
  // TODO: POST to /api/color/batch
  await new Promise((resolve) => setTimeout(resolve, 1800));
}

export async function colorSingleFrame(_frameUrl: string): Promise<void> {
  // TODO: POST to /api/color/single
  await new Promise((resolve) => setTimeout(resolve, 800));
}