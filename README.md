# Starting Point — Pedagogical Lesson Sequence & Slide Studio

A collaborative, client-side lesson-sequence & slide design studio built for teachers and hosted directly on **GitHub Pages**.

## Core Workflow
1. **Stage 1 — Learning Objectives (`Know / Do / Understand`)**: Define declarative knowledge, procedural skills, conceptual understanding, Tier 3 vocabulary, and target misconceptions.
2. **Stage 2 — Lesson Sequence Progression**: Map $N$ lessons with spaced retrieval links and varied active learning routines.
3. **Stage 3 — Slide-by-Slide Blueprint & 85% Time Budget**: Plan every slide with teacher-only Rosenshine & Cognitive Load Theory rationale badges while locking in a mandatory 15% buffer.
4. **Stage 4 — Visual Slide Studio, Classroom Presenter & Export**:
   - Implicit phase-coded **3D paper-cut palettes** paired with warm creamy white (`#FAF6F0`)
   - **4-Quadrant Mini-Whiteboard Starters** with 1-by-1 progressive answer reveal
   - **Bespoke Non-Template AI Slide Designer**
   - Live interactive countdown timers & chimes
   - Built-in Wikimedia Commons / Pexels / Pixabay / SVG Diagram picker
   - Export to **PowerPoint (`.pptx`)** and **1-Click Google Slides** (Google Drive API)

## Development & GitHub Pages Deployment
```bash
npm install
npm run dev
npm run build
```

Push to `main` and enable **GitHub Pages -> Source: GitHub Actions** in your repository settings. The included `.github/workflows/deploy.yml` builds and publishes `dist/` automatically.
