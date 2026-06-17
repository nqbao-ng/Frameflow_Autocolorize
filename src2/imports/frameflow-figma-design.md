🚀 FIGMA AI PROMPT – FrameFlow (React Optimized SaaS Web App)

Design a modern SaaS web application called FrameFlow.

This is an AI-assisted animation coloring web app.

The product includes:

Public marketing homepage

Auth pages (Sign in / Sign up)

Main App Dashboard (after login)

Target:

Desktop-first (1440px)

Optimized for React component structure

Use Auto Layout everywhere

Clean layer naming for Dev Mode export

🌐 PAGE 1 – HOMEPAGE (Marketing Website)
Layout

Max width: 1200px centered
Background: Soft light gradient (#F4F8FF → #FFFFFF)
Use vertical Auto Layout
Spacing between sections: 120px

🟦 HEADER (Reusable Component)

Sticky top navbar
Height: 72px
Horizontal Auto Layout
Padding: 0 40px

Left:
Logo text: FrameFlow (Inter Bold 22px)

Right nav items:

Pricing

Download

Learn

Sign In (ghost button)

Sign Up (primary button)

Primary button:

Blue #3B82F6

White text

Radius 10px

Height 40px

🟣 HERO SECTION

Left side:
H1:
“AI-Powered Animation Coloring”

Subtext:
Color entire frame sequences in seconds using AI.
Edit manually when needed.

Buttons:

Start Free Trial (primary large button)

Watch Demo (secondary outline)

Right side:
Large mockup of app dashboard preview

Layout:
Two-column responsive grid

🟢 FEATURES SECTION

3 Feature Cards (Reusable Component)

Feature 1:
AI Auto Color Propagation

Feature 2:
Manual Brush & Smart Correction

Feature 3:
Export PNG Sequence or MP4

Card Style:

White

Radius 20px

Shadow soft

Padding 32px

🟡 HOW IT WORKS SECTION

3 Steps horizontal:

Upload Frame Sequence

Add Reference or Let AI Auto Color

Review & Export

Minimal illustrative icons

🔵 PRICING SECTION

Two pricing cards:

Free Plan:

720p export

PNG sequence

Watermark

Pro Plan:

1080p export

MP4

No watermark

Faster AI

Highlight Pro with blue border.

🟣 FOOTER

Links:
Pricing / Download / Learn / Terms / Privacy

🔐 AUTH PAGES

Simple centered card layout:

Sign In

Sign Up

Card:
Width 400px
Radius 20px
Shadow soft

Fields:
Email
Password

Primary Button full width

🎨 PAGE 2 – APP DASHBOARD

Use 3-column layout:

Left Sidebar – 260px
Main Canvas – flexible
Right Control Panel – 340px

Parent padding: 24px
Gap: 24px

🟦 LEFT SIDEBAR

Vertical Auto Layout
Background: gradient light blue
Radius: 20px

Sections:

Logo

Your Projects (list component)

New Project button

Upgrade to Pro

Project item variants:

Default

Active

Hover

🟦 MAIN CANVAS AREA

Header bar:
Breadcrumb: Projects / Magic Girl Animation

Right side buttons:
Undo
AI Auto Color
Propagate Forward
Export

🎥 Canvas Preview

Large 16:9 image preview
Radius 16px
Soft shadow

Below:
Frame indicator:
“Frame 23 of 120”

🎞 Timeline Section

Horizontal scroll thumbnail strip
Each thumbnail:
72x72
Radius 10px

States:

Active (blue border)

AI colored (small purple dot)

Manually edited (orange dot)

Add PLAY BUTTON left side of timeline:
▶ Play Animation

When clicked:
Simulates frame playback across thumbnails.

Add:
Playback speed dropdown (0.5x, 1x, 2x)

🟦 RIGHT CONTROL PANEL (IMPORTANT – Advanced AI + Editing)

Width: 340px
Auto Layout vertical
Gap: 24px

SECTION 1 – AI Coloring

Title: AI Coloring

Components:

Primary Button:
“Auto Color Entire Sequence”

Secondary Button:
“Auto Color Current Frame”

Checkbox:
☑ Improve Edge Detection
☑ Preserve Line Art
☑ Smart Skin Tone

Dropdown:
AI Strength:

Low

Medium

High

Description text:
AI may make small mistakes. You can manually adjust colors below.

SECTION 2 – Manual Coloring Tools

Color Palette:
12 circular swatches

Add:

Add Custom Color

Tools:

Brush

Smart Fill

Eraser

Color Picker (eyedropper)

Brush settings:

Size slider

Opacity slider

Hardness slider

SECTION 3 – Image Processing Tools

Extra tools:

Adjust Brightness

Adjust Contrast

Saturation

Blur small areas

Remove color spill

Rebalance tones

Each with slider UI component.

🎨 DESIGN SYSTEM

Font: Inter

Text styles:
H1 – 36px Bold
H2 – 24px SemiBold
H3 – 18px SemiBold
Body – 14px
Caption – 12px

Colors:
Primary: #3B82F6
Accent Purple: #8B5CF6
Accent Orange: #F59E0B
Soft Background: #F4F8FF
Text Dark: #1E293B
Text Muted: #94A3B8

Radius:
Cards: 20px
Buttons: 10px
Small items: 8px

Shadow:
0 10px 30px rgba(0,0,0,0.08)

⚙️ IMPORTANT FOR FIGMA AI (React Optimization)

Structure components clearly:

Pages/

HomePage

PricingPage

SignInPage

SignUpPage

Dashboard

Components/

Navbar

Sidebar

ProjectItem

Button (variants)

Card

FeatureCard

PricingCard

CanvasViewer

Timeline

TimelineThumbnail

ControlPanel

AISection

ManualToolsSection

ImageAdjustSection

Use:

Auto Layout properly

Responsive constraints

Clean naming layers

Variants instead of separate duplicate components

Avoid absolute positioning

Design must be easily exportable to:
React + Tailwind CSS