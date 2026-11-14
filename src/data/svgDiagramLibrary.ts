export interface DiagramTemplate {
  id: string;
  title: string;
  category: 'computing' | 'general' | 'frameworks';
  description: string;
  svgCode: string;
}

export const SVG_DIAGRAM_TEMPLATES: DiagramTemplate[] = [
  {
    id: 'packet-switching-diagram',
    title: 'Packet Switching Across Routers',
    category: 'computing',
    description: 'Visualises splitting a message into numbered packets taking independent routes across routers.',
    svgCode: `<svg viewBox="0 0 640 420" xmlns="http://www.w3.org/2000/svg" font-family="Plus Jakarta Sans, sans-serif">
  <rect width="640" height="420" rx="24" fill="#FAF6F0"/>
  <!-- Links -->
  <g stroke="#94A3B8" stroke-width="4" stroke-dasharray="8 6" fill="none">
    <line x1="95" y1="210" x2="230" y2="105"/>
    <line x1="95" y1="210" x2="230" y2="315"/>
    <line x1="230" y1="105" x2="410" y2="105"/>
    <line x1="230" y1="105" x2="410" y2="315"/>
    <line x1="230" y1="315" x2="410" y2="105"/>
    <line x1="230" y1="315" x2="410" y2="315"/>
    <line x1="410" y1="105" x2="545" y2="210"/>
    <line x1="410" y1="315" x2="545" y2="210"/>
  </g>
  <!-- Highlighted Routes -->
  <path d="M95 210 L230 105 L410 105 L545 210" stroke="#059669" stroke-width="5" fill="none" stroke-linecap="round"/>
  <path d="M95 210 L230 315 L410 315 L545 210" stroke="#0284C7" stroke-width="5" fill="none" stroke-linecap="round"/>
  <!-- Routers -->
  <g fill="#065F46" stroke="#FAF6F0" stroke-width="3">
    <circle cx="230" cy="105" r="28"/>
    <circle cx="230" cy="315" r="28"/>
    <circle cx="410" cy="105" r="28"/>
    <circle cx="410" cy="315" r="28"/>
  </g>
  <g fill="#FAF6F0" font-size="13" font-weight="700" text-anchor="middle">
    <text x="230" y="110">R1</text>
    <text x="230" y="320">R2</text>
    <text x="410" y="110">R3</text>
    <text x="410" y="320">R4</text>
  </g>
  <!-- Sender & Receiver -->
  <rect x="35" y="170" width="90" height="80" rx="14" fill="#0F172A"/>
  <text x="80" y="206" fill="#FAF6F0" font-size="13" font-weight="700" text-anchor="middle">SENDER</text>
  <text x="80" y="226" fill="#38BDF8" font-size="11" font-weight="600" text-anchor="middle">192.168.1.4</text>

  <rect x="515" y="170" width="95" height="80" rx="14" fill="#0F172A"/>
  <text x="562" y="206" fill="#FAF6F0" font-size="13" font-weight="700" text-anchor="middle">RECEIVER</text>
  <text x="562" y="226" fill="#34D399" font-size="11" font-weight="600" text-anchor="middle">Reassembles</text>

  <!-- Packets -->
  <g transform="translate(275, 55)">
    <rect width="88" height="34" rx="8" fill="#10B981"/>
    <text x="44" y="22" fill="#FFFFFF" font-size="12" font-weight="700" text-anchor="middle">Packet 1/3</text>
  </g>
  <g transform="translate(275, 330)">
    <rect width="88" height="34" rx="8" fill="#0EA5E9"/>
    <text x="44" y="22" fill="#FFFFFF" font-size="12" font-weight="700" text-anchor="middle">Packet 2/3</text>
  </g>
  <g transform="translate(135, 255)">
    <rect width="88" height="34" rx="8" fill="#F59E0B"/>
    <text x="44" y="22" fill="#FFFFFF" font-size="12" font-weight="700" text-anchor="middle">Packet 3/3</text>
  </g>
  <text x="320" y="396" fill="#475569" font-size="13" font-weight="600" text-anchor="middle">Each packet carries Header (To/From/Seq #) + Payload + Error Check</text>
</svg>`,
  },
  {
    id: 'star-vs-mesh-topology',
    title: 'Star vs Mesh Network Topologies',
    category: 'computing',
    description: 'Dual-coded side-by-side comparison of central switch vulnerability vs mesh redundancy.',
    svgCode: `<svg viewBox="0 0 640 400" xmlns="http://www.w3.org/2000/svg" font-family="Plus Jakarta Sans, sans-serif">
  <rect width="640" height="400" rx="24" fill="#FAF6F0"/>
  <line x1="320" y1="30" x2="320" y2="370" stroke="#E2E8F0" stroke-width="3" stroke-dasharray="6 6"/>
  <text x="160" y="45" fill="#065F46" font-size="18" font-weight="800" text-anchor="middle">Star Topology</text>
  <text x="480" y="45" fill="#0369A1" font-size="18" font-weight="800" text-anchor="middle">Mesh Topology</text>

  <!-- Star -->
  <g stroke="#059669" stroke-width="3.5">
    <line x1="160" y1="195" x2="160" y2="95"/>
    <line x1="160" y1="195" x2="255" y2="170"/>
    <line x1="160" y1="195" x2="220" y2="285"/>
    <line x1="160" y1="195" x2="100" y2="285"/>
    <line x1="160" y1="195" x2="65" y2="170"/>
  </g>
  <rect x="130" y="170" width="60" height="50" rx="10" fill="#065F46"/>
  <text x="160" y="200" fill="#FFF" font-size="12" font-weight="700" text-anchor="middle">SWITCH</text>
  <g fill="#34D399" stroke="#064E3B" stroke-width="2.5">
    <circle cx="160" cy="95" r="18"/>
    <circle cx="255" cy="170" r="18"/>
    <circle cx="220" cy="285" r="18"/>
    <circle cx="100" cy="285" r="18"/>
    <circle cx="65" cy="170" r="18"/>
  </g>
  <text x="160" y="348" fill="#475569" font-size="12" font-weight="600" text-anchor="middle">Fast &amp; easy to add devices; switch = single point of failure</text>

  <!-- Mesh -->
  <g stroke="#0284C7" stroke-width="3" opacity="0.85">
    <line x1="480" y1="95" x2="575" y2="170"/>
    <line x1="575" y1="170" x2="540" y2="285"/>
    <line x1="540" y1="285" x2="420" y2="285"/>
    <line x1="420" y1="285" x2="385" y2="170"/>
    <line x1="385" y1="170" x2="480" y2="95"/>
    <line x1="480" y1="95" x2="540" y2="285"/>
    <line x1="480" y1="95" x2="420" y2="285"/>
    <line x1="575" y1="170" x2="420" y2="285"/>
    <line x1="575" y1="170" x2="385" y2="170"/>
    <line x1="385" y1="170" x2="540" y2="285"/>
  </g>
  <g fill="#38BDF8" stroke="#0C4A6E" stroke-width="2.5">
    <circle cx="480" cy="95" r="18"/>
    <circle cx="575" cy="170" r="18"/>
    <circle cx="540" cy="285" r="18"/>
    <circle cx="420" cy="285" r="18"/>
    <circle cx="385" cy="170" r="18"/>
  </g>
  <text x="480" y="348" fill="#475569" font-size="12" font-weight="600" text-anchor="middle">Self-healing multiple paths; higher cabling/setup cost</text>
</svg>`,
  },
  {
    id: 'process-cycle-4step',
    title: '4-Stage Cycle / System Loop',
    category: 'frameworks',
    description: 'Clean cyclic flowchart adaptable to Input-Process-Output, Fetch-Decode-Execute, or scientific cycles.',
    svgCode: `<svg viewBox="0 0 640 400" xmlns="http://www.w3.org/2000/svg" font-family="Plus Jakarta Sans, sans-serif">
  <rect width="640" height="400" rx="24" fill="#FAF6F0"/>
  <path d="M180 115 H450" stroke="#059669" stroke-width="5" stroke-linecap="round"/>
  <path d="M460 125 V275" stroke="#0284C7" stroke-width="5" stroke-linecap="round"/>
  <path d="M450 285 H180" stroke="#D97706" stroke-width="5" stroke-linecap="round"/>
  <path d="M170 275 V125" stroke="#7C3AED" stroke-width="5" stroke-linecap="round"/>

  <rect x="65" y="70" width="190" height="90" rx="18" fill="#065F46"/>
  <text x="160" y="108" fill="#FFF" font-size="16" font-weight="800" text-anchor="middle">1. REQUEST</text>
  <text x="160" y="132" fill="#A7F3D0" font-size="12" font-weight="600" text-anchor="middle">Split data into packets</text>

  <rect x="385" y="70" width="190" height="90" rx="18" fill="#0369A1"/>
  <text x="480" y="108" fill="#FFF" font-size="16" font-weight="800" text-anchor="middle">2. ADDRESS</text>
  <text x="480" y="132" fill="#BAE6FD" font-size="12" font-weight="600" text-anchor="middle">Attach IP &amp; MAC headers</text>

  <rect x="385" y="240" width="190" height="90" rx="18" fill="#B45309"/>
  <text x="480" y="278" fill="#FFF" font-size="16" font-weight="800" text-anchor="middle">3. ROUTE</text>
  <text x="480" y="302" fill="#FDE68A" font-size="12" font-weight="600" text-anchor="middle">Routers forward hop by hop</text>

  <rect x="65" y="240" width="190" height="90" rx="18" fill="#6D28D9"/>
  <text x="160" y="278" fill="#FFF" font-size="16" font-weight="800" text-anchor="middle">4. VERIFY</text>
  <text x="160" y="302" fill="#DDD6FE" font-size="12" font-weight="600" text-anchor="middle">Reorder &amp; check checksum</text>
</svg>`,
  },
  {
    id: 'venn-comparison',
    title: 'Two-Set Venn Comparison',
    category: 'general',
    description: 'Clean dual-circle comparison diagram for comparing concepts across any subject.',
    svgCode: `<svg viewBox="0 0 640 380" xmlns="http://www.w3.org/2000/svg" font-family="Plus Jakarta Sans, sans-serif">
  <rect width="640" height="380" rx="24" fill="#FAF6F0"/>
  <circle cx="235" cy="195" r="135" fill="#059669" fill-opacity="0.16" stroke="#059669" stroke-width="4"/>
  <circle cx="405" cy="195" r="135" fill="#0284C7" fill-opacity="0.16" stroke="#0284C7" stroke-width="4"/>
  <text x="175" y="120" fill="#065F46" font-size="17" font-weight="800" text-anchor="middle">Concept A</text>
  <text x="465" y="120" fill="#0369A1" font-size="17" font-weight="800" text-anchor="middle">Concept B</text>
  <text x="320" y="185" fill="#18181B" font-size="15" font-weight="800" text-anchor="middle">Shared</text>
  <text x="320" y="210" fill="#475569" font-size="12" font-weight="600" text-anchor="middle">Common features</text>
</svg>`,
  },
  {
    id: 'hierarchy-tree',
    title: 'Concept Hierarchy / Breakdown Tree',
    category: 'general',
    description: 'Top-down conceptual breakdown showing a parent concept branching into 3 sub-components.',
    svgCode: `<svg viewBox="0 0 640 380" xmlns="http://www.w3.org/2000/svg" font-family="Plus Jakarta Sans, sans-serif">
  <rect width="640" height="380" rx="24" fill="#FAF6F0"/>
  <path d="M320 120 V175 M125 175 H515 M125 175 V225 M320 175 V225 M515 175 V225" stroke="#64748B" stroke-width="4" fill="none" stroke-linecap="round"/>
  <rect x="195" y="45" width="250" height="75" rx="16" fill="#0F172A"/>
  <text x="320" y="88" fill="#FAF6F0" font-size="17" font-weight="800" text-anchor="middle">Core Concept</text>

  <rect x="45" y="225" width="160" height="95" rx="14" fill="#059669"/>
  <text x="125" y="268" fill="#FFF" font-size="15" font-weight="800" text-anchor="middle">Branch 1</text>
  <text x="125" y="292" fill="#D1FAE5" font-size="12" font-weight="600" text-anchor="middle">Key detail</text>

  <rect x="240" y="225" width="160" height="95" rx="14" fill="#0284C7"/>
  <text x="320" y="268" fill="#FFF" font-size="15" font-weight="800" text-anchor="middle">Branch 2</text>
  <text x="320" y="292" fill="#E0F2FE" font-size="12" font-weight="600" text-anchor="middle">Key detail</text>

  <rect x="435" y="225" width="160" height="95" rx="14" fill="#D97706"/>
  <text x="515" y="268" fill="#FFF" font-size="15" font-weight="800" text-anchor="middle">Branch 3</text>
  <text x="515" y="292" fill="#FEF3C7" font-size="12" font-weight="600" text-anchor="middle">Key detail</text>
</svg>`,
  },
];
