export function DigestContent({ text }: { text: string }) {
  const blocks: { type: "heading" | "paragraph" | "list"; lines: string[] }[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const heading = line.replace(/^#{1,6}\s+/, "").replace(/^\*\*|\*\*:?$/g, "").replace(/:$/, "");
    if (/^(overview|tech news|technology|cybersecurity|cyber security|highlights|key points|key takeaways)$/i.test(heading)) {
      blocks.push({ type: "heading", lines: [heading] });
    } else if (/^[-*•]\s/.test(line)) {
      const item = line.replace(/^[-*•]\s+/, "").replace(/\*\*/g, "");
      const last = blocks.at(-1);
      if (last?.type === "list") last.lines.push(item);
      else blocks.push({ type: "list", lines: [item] });
    } else blocks.push({ type: "paragraph", lines: [line.replace(/\*\*/g, "")] });
  }
  return <div className="reading-copy space-y-4 text-slate-700">
    {blocks.map((block, index) => block.type === "heading"
      ? <h2 key={index} className="pt-3 text-lg font-semibold tracking-[-0.02em] text-slate-900">{block.lines[0]}</h2>
      : block.type === "list" ? <ul key={index} className="list-disc space-y-3 pl-5 marker:text-violet-500">{block.lines.map((line, item) => <li key={item}>{line}</li>)}</ul>
        : <p key={index}>{block.lines[0]}</p>)}
  </div>;
}
