import { SlideData, SlideRichLine, SlideLineStyle, SlideTextBlock } from '../types/curriculum';

export const CONSTANT_TEXT_COLORS = [
  { label: 'Emerald Green', hex: '#16A34A' },
  { label: 'Crimson Red', hex: '#DC2626' },
  { label: 'Sky Blue', hex: '#2563EB' },
  { label: 'Amber Yellow', hex: '#D97706' },
  { label: 'Royal Purple', hex: '#9333EA' },
  { label: 'Slate Gray', hex: '#64748B' },
  { label: 'Dark Charcoal', hex: '#18181B' },
  { label: 'Pure White', hex: '#FFFFFF' },
];

export const FONT_SIZE_PRESETS = [
  { label: 'Auto (Default)', value: undefined },
  { label: '18px (Fine)', value: 18 },
  { label: '22px (Body)', value: 22 },
  { label: '26px (Large)', value: 26 },
  { label: '30px (Subheading)', value: 30 },
  { label: '36px (Section H2)', value: 36 },
  { label: '44px (Major H1)', value: 44 },
  { label: '52px (Title)', value: 52 },
  { label: '60px (Hero Display)', value: 60 },
];

export function convertRichLinesToBodyBlocks(lines: SlideRichLine[]): SlideTextBlock[] {
  const nonTitleLines = lines.filter((l, i) => !(i === 0 && l.style === 'title'));
  if (nonTitleLines.length === 0) return [];

  const blocks: SlideTextBlock[] = [];
  let currentBlock: SlideTextBlock | null = null;

  nonTitleLines.forEach((l, idx) => {
    const isHeading = l.style === 'heading-1' || l.style === 'heading-2' || l.style === 'heading-3';
    const isCallout = l.style === 'callout';
    const isCode = l.style === 'code';

    if (isCallout) {
      blocks.push({
        id: `blk-callout-${Date.now()}-${idx}`,
        heading: '',
        content: l.text,
        style: 'highlight',
        layer: 'top',
      });
      currentBlock = null;
    } else if (isCode) {
      blocks.push({
        id: `blk-code-${Date.now()}-${idx}`,
        heading: '',
        content: l.text,
        style: 'code',
        layer: 'top',
      });
      currentBlock = null;
    } else if (isHeading) {
      currentBlock = {
        id: `blk-sec-${Date.now()}-${idx}`,
        heading: l.text.replace(/^#+\s*/, ''),
        content: '',
        style: 'boxed',
        layer: 'top',
      };
      blocks.push(currentBlock);
    } else {
      if (!currentBlock) {
        currentBlock = {
          id: `blk-body-${Date.now()}-${idx}`,
          heading: '',
          content: l.text,
          style: 'plain',
          layer: 'top',
        };
        blocks.push(currentBlock);
      } else {
        currentBlock.content = currentBlock.content
          ? `${currentBlock.content}\n${l.text}`
          : l.text;
      }
    }
  });

  return blocks;
}

export function getSlideRichLines(slide: SlideData): SlideRichLine[] {
  if (slide.richLines && slide.richLines.length > 0) {
    return slide.richLines;
  }
  if (slide.unifiedText && slide.unifiedText.trim()) {
    return parseTextToRichLines(slide.unifiedText);
  }

  // Auto-convert existing slide title and body blocks
  const lines: SlideRichLine[] = [];
  if (slide.title) {
    lines.push({ text: slide.title, style: 'title' });
  }
  if (slide.bigQuestion) {
    lines.push({ text: slide.bigQuestion, style: 'heading-2' });
  }
  if (slide.bodyBlocks && slide.bodyBlocks.length > 0) {
    slide.bodyBlocks.forEach((b) => {
      if (b.heading) {
        lines.push({
          text: b.heading,
          style: b.style === 'highlight' || b.style === 'challenge' ? 'callout' : 'heading-2',
        });
      }
      if (b.content) {
        b.content.split('\n').forEach((rawLine) => {
          const trimmed = rawLine.trim();
          if (trimmed) {
            lines.push({
              text: trimmed,
              style:
                b.style === 'highlight' || b.style === 'challenge'
                  ? 'callout'
                  : b.style === 'code'
                  ? 'code'
                  : 'normal',
            });
          }
        });
      }
    });
  }

  return lines.length > 0
    ? lines
    : [{ text: slide.title || 'Slide Title', style: 'title' }];
}

export function richLinesToUnifiedText(lines: SlideRichLine[]): string {
  return lines.map((l) => l.text).join('\n');
}

export function parseTextToRichLines(
  rawText: string,
  existingLines?: SlideRichLine[]
): SlideRichLine[] {
  const lines = rawText.split('\n');
  return lines.map((line, idx) => {
    const existing = existingLines?.[idx];
    const trimmed = line.trim();
    let defaultStyle: SlideLineStyle = 'normal';

    if (idx === 0) {
      defaultStyle = 'title';
    } else if (/^#{1}\s+/i.test(trimmed)) {
      defaultStyle = 'heading-1';
    } else if (/^#{2}\s+/i.test(trimmed)) {
      defaultStyle = 'heading-2';
    } else if (/^#{3}\s+/i.test(trimmed)) {
      defaultStyle = 'heading-3';
    } else if (/^(?:key point|remember|hint|watch out|takeaway|summary|note):/i.test(trimmed)) {
      defaultStyle = 'callout';
    }

    if (existing) {
      return {
        ...existing,
        text: line,
        style: existing.style || defaultStyle,
      };
    }
    return {
      text: line,
      style: defaultStyle,
    };
  });
}
