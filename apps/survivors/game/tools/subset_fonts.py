#!/usr/bin/env python3
"""Builds the game's two fonts, cut down to the characters the game actually shows.

    python3 -m venv /tmp/fonttools && /tmp/fonttools/bin/pip install fonttools
    /tmp/fonttools/bin/python tools/subset_fonts.py

Nunito (rounded Latin, for headings and numbers) and Noto Sans SC (思源黑体, for everything
else and every Chinese character) come from the google/fonts repository as variable fonts and
keep their weight axis, so the game can pick 400 / 700 / 800 from one file each. The full
Noto Sans SC is 17 MB; the game uses a few hundred characters, so only the characters in the
scripts' string literals are kept (plus all of printable ASCII and common punctuation).

Run it again after adding text with new characters: check-project.mjs (CI) fails while a string
in scripts/ holds a character missing from assets/fonts/glyphs.txt, which this writes.
"""
import pathlib
import re
import tempfile
import unicodedata
import urllib.request

from fontTools import subset

GAME = pathlib.Path(__file__).resolve().parent.parent
FONTS = GAME / "assets" / "fonts"
SOURCES = {
    "Nunito": "https://github.com/google/fonts/raw/main/ofl/nunito/Nunito%5Bwght%5D.ttf",
    "NotoSansSC": "https://github.com/google/fonts/raw/main/ofl/notosanssc/NotoSansSC%5Bwght%5D.ttf",
}
# Same pattern as check-project.mjs: double-quoted GDScript string literals on one line.
STRING_LITERAL = re.compile(r'"(?:[^"\\\n]|\\.)*"')
# Always kept, so numbers, English text and typical punctuation never depend on the scripts.
BASE_CHARS = "".join(chr(code) for code in range(0x20, 0x7F)) + "·×—–…“”‘’、。，！？：；（）「」《》·／～"


def used_chars() -> set[str]:
    chars = set(BASE_CHARS)
    for script in sorted((GAME / "scripts").rglob("*.gd")):
        for literal in STRING_LITERAL.findall(script.read_text(encoding="utf-8")):
            chars.update(literal[1:-1])
    # Everything but control characters (escapes like \n leave their letters, which are ASCII).
    return {char for char in chars if not unicodedata.category(char).startswith("C")}


def build(source: pathlib.Path, target: pathlib.Path, chars: set[str]) -> None:
    options = subset.Options()
    # Keep the kerning and the weight axis; drop hinting the game's renderer doesn't use.
    options.layout_features = ["kern", "liga", "calt", "locl"]
    options.hinting = False
    options.name_IDs = ["*"]
    font = subset.load_font(str(source), options)
    subsetter = subset.Subsetter(options)
    subsetter.populate(unicodes=[ord(char) for char in chars])
    subsetter.subset(font)
    subset.save_font(font, str(target), options)
    print(f"{target.relative_to(GAME)}: {target.stat().st_size // 1024} KB")


def main() -> None:
    chars = used_chars()
    with tempfile.TemporaryDirectory() as download_dir:
        sources = {}
        for name, url in SOURCES.items():
            sources[name] = pathlib.Path(download_dir) / f"{name}.ttf"
            urllib.request.urlretrieve(url, sources[name])
        # Nunito keeps only Latin: Chinese, and the punctuation that sits among it (… — “ ”), come
        # from Noto Sans SC (Art.display_font's fallback), drawn the Chinese way.
        build(sources["Nunito"], FONTS / "Nunito.ttf", {char for char in chars if ord(char) < 0x2000})
        build(sources["NotoSansSC"], FONTS / "NotoSansSC.ttf", chars)
    (FONTS / "glyphs.txt").write_text("".join(sorted(chars)) + "\n", encoding="utf-8")
    print(f"{len(chars)} characters")


if __name__ == "__main__":
    main()
