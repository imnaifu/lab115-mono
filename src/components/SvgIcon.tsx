import { ICON } from "../icons";

type Props = {
  name: string;
  fallback?: string;
};

// The ICON map holds static inline SVG strings (no user input), so
// dangerouslySetInnerHTML is the simplest way to inject them while keeping
// the original class-based styling hooks (.stroke / .fill-accent / …).
export default function SvgIcon({ name, fallback = "guitar" }: Props) {
  const html = ICON[name] ?? ICON[fallback];
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}
