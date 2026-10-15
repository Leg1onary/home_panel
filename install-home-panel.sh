#!/bin/sh
set -eu
base=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
test -f "$base/home_panel/config.json" || { echo "Run this script next to the home_panel folder."; exit 1; }
if [ -d /local_apps ]; then
  target=/local_apps
elif [ -d /addons ]; then
  target=/addons
else
  echo "No local-apps mount found. Run this from Terminal & SSH inside Home Assistant."
  exit 1
fi
mkdir -p "$target/home_panel"
# Replaces source files only, never the Supervisor-managed /data volume.
cp -R "$base/home_panel/." "$target/home_panel/"
echo "Copied Home Panel 1.0.1 to $target/home_panel"
echo "Open Apps store, Check for updates, then install Home Panel under Local apps."
