"""Builds the logo statues that stand on a company campus's lawn at a check-in spot (.77, the
user: 每个地图的打卡点能不能更像大厂一点): the company's icon (assets/art/icon_*.svg, 32 x 32) set
big on a stone plinth, written as assets/art/statue_<icon>.svg. Run again after changing an icon:

    python3 tools/make_logo_statues.py
"""

import pathlib
import re

ART = pathlib.Path(__file__).resolve().parent.parent / "assets" / "art"
# The icons the maps' STAMPS stand on a plinth (each map's LAWN_LANDMARKS names statue_<icon>).
ICONS = ["icon_nut", "icon_eye", "icon_window", "icon_gamepad", "icon_phone", "icon_paw", "icon_web",
         "icon_rice", "icon_note", "icon_cart", "icon_pickaxe", "icon_card", "icon_bank", "icon_kangaroo",
         "icon_bag", "icon_ride", "icon_coins", "icon_heart_box"]

PLINTH = """<g stroke="#2f3542" stroke-linejoin="round" stroke-width="1.6">
<rect x="9" y="38" width="22" height="14" fill="#d9d4c7"/>
<rect x="6" y="34.5" width="28" height="4" rx="1" fill="#ece8dc"/>
<rect x="5" y="51.5" width="30" height="4" rx="1" fill="#c9c3b3"/>
</g>
<path d="M12 42 H28" stroke="#b9b2a0" stroke-width="1.2" stroke-linecap="round"/>
"""


def statue(icon_svg: str) -> str:
    inner = re.sub(r"^\s*<svg[^>]*>|</svg>\s*$", "", icon_svg.strip())
    # The icon 32 wide above the plinth, its foot just on the plinth's top.
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 56">\n'
            + PLINTH + '<g transform="translate(4 3)">\n' + inner.strip() + "\n</g>\n</svg>\n")


def main() -> None:
    for icon in ICONS:
        source = (ART / f"{icon}.svg").read_text(encoding="utf-8")
        target = ART / f"statue_{icon.removeprefix('icon_')}.svg"
        target.write_text(statue(source), encoding="utf-8")
        print("wrote", target.name)


if __name__ == "__main__":
    main()
