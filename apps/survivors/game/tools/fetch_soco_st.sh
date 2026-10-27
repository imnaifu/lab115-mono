#!/usr/bin/env bash
# Re-downloads the soco-st (ソコスト) building illustrations the city map uses into
# assets/soco-st/. They are committed, so a checkout doesn't need this; it records where each
# file came from and refreshes them. Terms: https://soco-st.com/guide — free for use in games,
# but not to be redistributed as material in their own right.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p assets/soco-st
base="https://soco-st.com/wp-content/uploads"
# name=file — the names are what scripts/city.gd lists in BUILDINGS.
for entry in \
	office=building_28209_color.png \
	midrise_bands=building_28219_color.png \
	midrise_grid=building_28228_color.png \
	commercial=building_28242_color.png \
	small_1=building_28274_color.png \
	small_2=building_28282_color.png \
	small_3=building_28288_color.png \
	small_4=building_28299_color.png \
	shop_1=building_28310_color.png \
	shop_2=building_28317_color.png \
	office_block=officebuilding_28335_color.png \
	convenience_store=conveniencestore_20339_color.png \
	supermarket=super_20316_color.png
do
	name="${entry%%=*}"
	target="assets/soco-st/$name.png"
	[ -f "$target" ] && continue
	curl -fsSL -o "$target" "$base/${entry#*=}"
	echo "fetched $target"
done
