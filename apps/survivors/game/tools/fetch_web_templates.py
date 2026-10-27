"""Installs Godot's web export templates without downloading the whole templates archive.

The official archive (Godot_v<version>-stable_export_templates.tpz) is ~1.3 GB with every
platform in it; the web build needs only web_nothreads_release.zip (~10 MB). A .tpz is a zip,
and a zip keeps its directory at the end, so with HTTP range requests we read the directory
and then just the members we need.

    python3 tools/fetch_web_templates.py 4.7.2 <templates dir>

The templates dir is where Godot looks: ~/.local/share/godot/export_templates/<version>.stable
on Linux, ~/Library/Application Support/Godot/export_templates/<version>.stable on macOS.
"""
import io
import os
import sys
import urllib.request
import zipfile

WANTED = ["version.txt", "web_nothreads_release.zip", "web_nothreads_debug.zip"]


class RangeFile(io.RawIOBase):
    """A seekable read-only file over HTTP, fetching each read with a Range request."""

    def __init__(self, url):
        request = urllib.request.Request(url, method="HEAD")
        with urllib.request.urlopen(request) as response:
            # Follow the release redirect once, so every range request hits the file directly.
            self.url = response.geturl()
            self.size = int(response.headers["Content-Length"])
        self.position = 0

    def seekable(self):
        return True

    def readable(self):
        return True

    def tell(self):
        return self.position

    def seek(self, offset, whence=io.SEEK_SET):
        base = {io.SEEK_SET: 0, io.SEEK_CUR: self.position, io.SEEK_END: self.size}[whence]
        self.position = base + offset
        return self.position

    def readinto(self, buffer):
        if self.position >= self.size:
            return 0
        end = min(self.position + len(buffer), self.size) - 1
        request = urllib.request.Request(self.url, headers={"Range": f"bytes={self.position}-{end}"})
        with urllib.request.urlopen(request) as response:
            data = response.read()
        buffer[:len(data)] = data
        self.position += len(data)
        return len(data)


def main():
    version, out_dir = sys.argv[1], sys.argv[2]
    url = f"https://github.com/godotengine/godot/releases/download/{version}-stable/Godot_v{version}-stable_export_templates.tpz"
    os.makedirs(out_dir, exist_ok=True)
    archive = zipfile.ZipFile(io.BufferedReader(RangeFile(url), buffer_size=4 * 1024 * 1024))
    found = set()
    for member in archive.infolist():
        name = member.filename.rsplit("/", 1)[-1]
        if name in WANTED:
            with archive.open(member) as source, open(os.path.join(out_dir, name), "wb") as target:
                target.write(source.read())
            found.add(name)
            print(f"installed {name} ({member.file_size} bytes)")
    missing = set(WANTED) - found
    if missing:
        sys.exit(f"not in the templates archive: {', '.join(sorted(missing))}")


if __name__ == "__main__":
    main()
