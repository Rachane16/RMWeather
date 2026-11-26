"""Allow public assets while excluding private experimental caches at every depth."""
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[1]


def private_path(relative):
    return any(part in {'development', 'development-fallback'} for part in relative.parts)


def package(source=ROOT, output=None):
    output = output or source/'_site'
    output.mkdir(parents=True, exist_ok=True)
    for name in ('index.html', 'legacy.html'):
        shutil.copy2(source/name, output/name)
    shutil.copytree(source/'assets', output/'assets', dirs_exist_ok=True)
    for path in (source/'data').rglob('*'):
        relative = path.relative_to(source/'data')
        if path.is_file() and not private_path(relative):
            target = output/'data'/relative
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(path, target)
    if any(private_path(path.relative_to(output/'data')) for path in (output/'data').rglob('*') if path.is_file()):
        raise ValueError('Private data found in Pages artifact')
    (output/'.nojekyll').touch()


if __name__ == '__main__':
    package()
