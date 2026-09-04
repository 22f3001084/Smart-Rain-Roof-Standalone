"""Rewrite MANIFEST-SHA256.txt to match what the package currently contains.

The manifest covers the files a learner actually receives. Repository scaffolding
and build tooling are deliberately left out: they are not part of the offline
deliverable, and listing them would make the integrity check fail for anyone who
runs it from a plain unzipped copy.

    python tools/build_manifest.py
"""

import hashlib
import os

ROOT = os.path.dirname(os.path.abspath(os.path.dirname(__file__)))
SKIP_DIRS = {'.git', '.claude', 'node_modules', 'tools'}
SKIP_FILES = {
    'MANIFEST-SHA256.txt',      # cannot hash itself
    '.gitignore',
    '.gitattributes',
    'README.md',                # GitHub-facing, not part of the offline package
}
SKIP_SUFFIXES = ('.texts.json',)   # voice generator bookkeeping


def wanted(rel):
    if rel in SKIP_FILES:
        return False
    return not rel.endswith(SKIP_SUFFIXES)


def main():
    paths = []
    for dirpath, dirnames, filenames in os.walk(ROOT):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for name in filenames:
            rel = os.path.relpath(os.path.join(dirpath, name), ROOT).replace(os.sep, '/')
            if wanted(rel):
                paths.append(rel)

    paths.sort(key=lambda p: p.lower())

    lines = [
        '# Smart Rain Roof standalone package — SHA-256 manifest',
        '# Format: SHA256  relative/path',
    ]
    for rel in paths:
        with open(os.path.join(ROOT, rel), 'rb') as fh:
            lines.append('%s  %s' % (hashlib.sha256(fh.read()).hexdigest(), rel))

    out = os.path.join(ROOT, 'MANIFEST-SHA256.txt')
    with open(out, 'w', encoding='utf-8', newline='') as fh:
        fh.write('\r\n'.join(lines) + '\r\n')

    print('%d files listed in MANIFEST-SHA256.txt' % len(paths))


if __name__ == '__main__':
    main()
