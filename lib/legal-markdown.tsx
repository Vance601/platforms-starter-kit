import type { ReactNode } from "react";

function inline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const re = /\[([^\]]+)\]\((https?:\/\/[^)\s]+|\/[-\w./?#=&]+)\)|\*\*([^*]+)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    if (m[1] && m[2]) {
      const href = m[2];
      const external = href.startsWith("http");
      nodes.push(
        <a
          key={key++}
          href={href}
          {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          style={{ color: "#1d4ed8", textDecoration: "underline" }}
        >
          {m[1]}
        </a>,
      );
    } else if (m[3]) {
      nodes.push(<strong key={key++}>{m[3]}</strong>);
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function isListItem(line: string) {
  return /^(- |\* |\d+\. )/.test(line);
}

export default function LegalMarkdown({ markdown }: { markdown: string }) {
  const lines = markdown.replace(/\r\n/g, "\n").trim().split("\n");
  const blocks: string[][] = [];
  let cur: string[] = [];
  const flush = () => {
    if (cur.length) {
      blocks.push(cur);
      cur = [];
    }
  };
  for (const line of lines) {
    if (line.trim() === "") {
      flush();
      continue;
    }
    const heading = /^#{1,3} /.test(line);
    const list = isListItem(line);
    const prevList = cur.length > 0 && isListItem(cur[0]);
    if (heading) {
      flush();
      cur = [line];
      flush();
    } else if (list !== prevList && cur.length) {
      flush();
      cur = [line];
    } else {
      cur.push(line);
    }
  }
  flush();

  return (
    <div>
      {blocks.map((block, i) => {
        const first = block[0];
        if (first.startsWith("# ")) {
          return (
            <h1 key={i} style={{ fontSize: 32, fontWeight: 800, letterSpacing: "-0.02em", margin: "0 0 10px" }}>
              {inline(first.slice(2))}
            </h1>
          );
        }
        if (first.startsWith("## ")) {
          return (
            <h2 key={i} style={{ fontSize: 20, fontWeight: 700, margin: "28px 0 10px" }}>
              {inline(first.slice(3))}
            </h2>
          );
        }
        if (first.startsWith("### ")) {
          return (
            <h3 key={i} style={{ fontSize: 17, fontWeight: 700, margin: "20px 0 8px" }}>
              {inline(first.slice(4))}
            </h3>
          );
        }
        if (isListItem(first)) {
          const ordered = /^\d+\. /.test(first);
          const Tag = ordered ? "ol" : "ul";
          return (
            <Tag
              key={i}
              style={{ margin: "0 0 16px", paddingLeft: 22, lineHeight: 1.65 }}
            >
              {block.map((item, j) => (
                <li key={j} style={{ marginBottom: 6 }}>
                  {inline(item.replace(/^(- |\* |\d+\. )/, ""))}
                </li>
              ))}
            </Tag>
          );
        }
        return (
          <p key={i} style={{ margin: "0 0 16px", lineHeight: 1.7 }}>
            {block.map((line, j) => (
              <span key={j}>
                {j > 0 ? <br /> : null}
                {inline(line.replace(/\s+$/, ""))}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}
