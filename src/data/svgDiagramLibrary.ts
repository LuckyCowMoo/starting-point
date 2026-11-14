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
  {
    id: 'network-constellation-cover',
    title: 'Full-Bleed Network Cover Scene',
    category: 'computing',
    description: 'Atmospheric dark emerald interconnected nodes & fibre optic scene designed to crop smoothly into the bottom wave layer.',
    svgCode: `<svg viewBox="0 0 1000 1080" xmlns="http://www.w3.org/2000/svg" font-family="Plus Jakarta Sans, sans-serif">
  <defs>
    <radialGradient id="ncGlow1" cx="62%" cy="44%" r="52%">
      <stop offset="0%" stop-color="#10B981" stop-opacity="0.38"/>
      <stop offset="60%" stop-color="#064E3B" stop-opacity="0.16"/>
      <stop offset="100%" stop-color="#022C22" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="ncGlow2" cx="42%" cy="74%" r="42%">
      <stop offset="0%" stop-color="#38BDF8" stop-opacity="0.28"/>
      <stop offset="100%" stop-color="#022C22" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="ncBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#042F2E"/>
      <stop offset="50%" stop-color="#022C22"/>
      <stop offset="100%" stop-color="#051F1D"/>
    </linearGradient>
  </defs>
  <rect width="1000" height="1080" fill="url(#ncBg)"/>
  <rect width="1000" height="1080" fill="url(#ncGlow1)"/>
  <rect width="1000" height="1080" fill="url(#ncGlow2)"/>
  <!-- Subtle perspective grid -->
  <g stroke="#34D399" stroke-opacity="0.08" stroke-width="1.5">
    <line x1="120" y1="0" x2="120" y2="1080"/>
    <line x1="280" y1="0" x2="280" y2="1080"/>
    <line x1="440" y1="0" x2="440" y2="1080"/>
    <line x1="600" y1="0" x2="600" y2="1080"/>
    <line x1="760" y1="0" x2="760" y2="1080"/>
    <line x1="920" y1="0" x2="920" y2="1080"/>
    <line x1="0" y1="180" x2="1000" y2="180"/>
    <line x1="0" y1="360" x2="1000" y2="360"/>
    <line x1="0" y1="540" x2="1000" y2="540"/>
    <line x1="0" y1="720" x2="1000" y2="720"/>
    <line x1="0" y1="900" x2="1000" y2="900"/>
  </g>
  <!-- Star + Mesh Optical Trunk Paths -->
  <g fill="none" stroke-linecap="round">
    <path d="M 330 250 L 590 430 L 840 245" stroke="#34D399" stroke-width="5" stroke-opacity="0.72"/>
    <path d="M 330 250 L 395 615 L 590 430" stroke="#38BDF8" stroke-width="4.5" stroke-opacity="0.65"/>
    <path d="M 590 430 L 815 620 L 665 860 L 395 615" stroke="#34D399" stroke-width="5" stroke-opacity="0.75"/>
    <path d="M 840 245 L 815 620" stroke="#6EE7B7" stroke-width="4" stroke-dasharray="12 10" stroke-opacity="0.6"/>
    <path d="M 590 430 L 665 860" stroke="#FBBF24" stroke-width="4.5" stroke-dasharray="10 10" stroke-opacity="0.75"/>
    <path d="M 270 815 L 395 615" stroke="#38BDF8" stroke-width="4" stroke-opacity="0.6"/>
    <path d="M 270 815 L 665 860" stroke="#34D399" stroke-width="4" stroke-opacity="0.5"/>
    <path d="M 590 120 L 590 430" stroke="#6EE7B7" stroke-width="3.5" stroke-opacity="0.5"/>
    <path d="M 590 120 L 840 245" stroke="#38BDF8" stroke-width="3" stroke-opacity="0.45"/>
  </g>
  <!-- Moving Data Packets -->
  <rect x="445" y="325" width="38" height="16" rx="8" fill="#FBBF24" transform="rotate(35 464 333)"/>
  <rect x="705" y="510" width="38" height="16" rx="8" fill="#38BDF8" transform="rotate(40 724 518)"/>
  <rect x="495" y="720" width="38" height="16" rx="8" fill="#34D399" transform="rotate(43 514 728)"/>
  <!-- Outer Workstation / Router Nodes -->
  <g>
    <circle cx="330" cy="250" r="46" fill="#065F46" stroke="#6EE7B7" stroke-width="5"/>
    <text x="330" y="256" fill="#ECFDF5" font-size="22" font-weight="800" text-anchor="middle">NIC</text>
    <circle cx="840" cy="245" r="44" fill="#0369A1" stroke="#7DD3FC" stroke-width="5"/>
    <text x="840" y="252" fill="#F0F9FF" font-size="20" font-weight="800" text-anchor="middle">WAP</text>
    <circle cx="395" cy="615" r="48" fill="#065F46" stroke="#34D399" stroke-width="5"/>
    <text x="395" y="622" fill="#ECFDF5" font-size="20" font-weight="800" text-anchor="middle">PC 1</text>
    <circle cx="815" cy="620" r="50" fill="#0C4A6E" stroke="#38BDF8" stroke-width="5"/>
    <text x="815" y="627" fill="#E0F2FE" font-size="20" font-weight="800" text-anchor="middle">RTR</text>
    <circle cx="665" cy="860" r="46" fill="#065F46" stroke="#FBBF24" stroke-width="5"/>
    <text x="665" y="867" fill="#FEF3C7" font-size="20" font-weight="800" text-anchor="middle">MESH</text>
    <circle cx="270" cy="815" r="36" fill="#042F2E" stroke="#34D399" stroke-width="4"/>
    <circle cx="590" cy="120" r="34" fill="#042F2E" stroke="#7DD3FC" stroke-width="4"/>
  </g>
  <!-- Central Core Switch Node -->
  <g>
    <circle cx="590" cy="430" r="88" fill="#10B981" fill-opacity="0.16"/>
    <rect x="520" y="378" width="140" height="104" rx="24" fill="#059669" stroke="#ECFDF5" stroke-width="5"/>
    <text x="590" y="424" fill="#FFFFFF" font-size="25" font-weight="800" text-anchor="middle">SWITCH</text>
    <text x="590" y="454" fill="#A7F3D0" font-size="16" font-weight="700" text-anchor="middle">1 Gbps LAN</text>
  </g>
</svg>`,
  },
];
