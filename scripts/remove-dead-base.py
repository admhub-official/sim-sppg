from pathlib import Path

p = Path('index.html')
s = p.read_text(encoding='utf-8')
needle = '<base target="_blank">\n\n'
if needle not in s:
    raise SystemExit('dead secondary base tag not found')
s = s.replace(needle, '', 1)
if s.count('<base ') != 1:
    raise SystemExit(f'expected exactly one base tag after cleanup, found {s.count("<base ")}')
if '<base target="_top">' not in s:
    raise SystemExit('canonical base target missing')
p.write_text(s, encoding='utf-8')
print('Removed ineffective secondary base target.')
