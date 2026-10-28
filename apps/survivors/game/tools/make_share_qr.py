#!/usr/bin/env python3
"""Draws the QR code on the result image (scripts/ui/share_card.gd) as assets/art/qr_share.svg.

    python3 -m venv /tmp/qr && /tmp/qr/bin/pip install qrcode
    /tmp/qr/bin/python tools/make_share_qr.py

The link carries ?from=share, so runs started from a shared image show up in the play data
(Telemetry's `from`). Run it again only if the link changes.
"""
import pathlib

import qrcode

GAME = pathlib.Path(__file__).resolve().parent.parent
LINK = "https://survivors.lab115.com/?from=share"
INK = "#2f3542"
# Modules of white around the code; scanners want at least four.
QUIET = 4


def main() -> None:
    code = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_M, border=0)
    code.add_data(LINK)
    code.make(fit=True)
    matrix = code.get_matrix()
    size = len(matrix) + QUIET * 2
    # One path of unit squares, so the file stays small and every module lands on whole pixels.
    squares = "".join(
        f"M{x + QUIET} {y + QUIET}h1v1h-1z"
        for y, row in enumerate(matrix)
        for x, dark in enumerate(row)
        if dark
    )
    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}" width="{size * 4}" height="{size * 4}" shape-rendering="crispEdges">'
        f'<rect width="{size}" height="{size}" fill="#ffffff"/>'
        f'<path d="{squares}" fill="{INK}"/></svg>\n'
    )
    target = GAME / "assets" / "art" / "qr_share.svg"
    target.write_text(svg, encoding="utf-8")
    print(f"{target.relative_to(GAME)}: {len(matrix)}x{len(matrix)} modules for {LINK}")


if __name__ == "__main__":
    main()
