#!/usr/bin/env python3
"""build-plugin.py — one file for Studio: dist/ai-check-plugin.js.
Concatenates src/*.js in name order; inlines the shared review page (CSS scoped to .aicheck-app, markup,
boot script — all from build-review-page.py's template) and review-app/enrich.js (the wording), so the
plug-in, the prototype page and the local app never drift apart."""
import os, re, datetime, hashlib
HERE = os.path.dirname(os.path.abspath(__file__)); SCRIPTS = os.path.dirname(HERE)
def read(p): return open(p, encoding='utf-8').read()
gen = read(os.path.join(SCRIPTS, 'build-review-page.py'))
a = gen.index("TEMPLATE = r'''") + len("TEMPLATE = r'''"); b = gen.index("'''", a); T = gen[a:b]
css = T[T.index('<style>') + 7:T.index('</style>')]
markup = T[T.index('</style>') + 8:T.index('<script id="data"')]
script = T[T.index('<script>', T.index('<script id="data"')) + 8:]; script = script[:script.rindex('</script>')]
def scope_block(t):
    out = []
    for m in re.finditer(r'([^{}]+)\{([^{}]*)\}', t):
        sel = m.group(1).strip(); body = m.group(2)
        if sel.startswith('@'): out.append(sel + '{' + body + '}'); continue
        parts = []
        for p in sel.split(','):
            p = p.strip()
            if p.startswith(':root'): p = p.replace(':root', '.aicheck-app', 1)
            elif p == 'body' or p.startswith('body'): p = p.replace('body', '.aicheck-app', 1)
            elif p == '*': p = '.aicheck-app *'
            else: p = '.aicheck-app ' + p
            parts.append(p)
        out.append(', '.join(parts) + '{' + body + '}')
    return '\n'.join(out)
def scope_css(t):
    res = []; pos = 0
    for m in re.finditer(r'@media[^{]*\{', t):
        res.append(scope_block(t[pos:m.start()])); depth = 1; j = m.end()
        while depth and j < len(t):
            if t[j] == '{': depth += 1
            elif t[j] == '}': depth -= 1
            j += 1
        res.append(m.group(0) + scope_block(t[m.end():j - 1]) + '}'); pos = j
    res.append(scope_block(t[pos:])); return '\n'.join(res)
def js_string(s): return "'" + s.replace('\\', '\\\\').replace("'", "\\'").replace('\n', '\\n').replace('</script', '<\\/script') + "'"
srcs = sorted(f for f in os.listdir(os.path.join(HERE, 'src')) if f.endswith('.js') and not f.startswith('_'))
stamp = datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')
version = stamp + ' ' + hashlib.sha256((css + markup + script + read(os.path.join(SCRIPTS, 'review-app', 'enrich.js')) + ''.join(read(os.path.join(HERE, 'src', f)) for f in srcs)).encode()).hexdigest()[:8]
parts = []
for f in srcs:
    parts.append('// ---- ' + f + ' ----\n' + read(os.path.join(HERE, 'src', f)).replace('__VERSION__', version))
    if f == '10-studio-api.js':
        parts.append('  // ---- shared review page (from build-review-page.py) ----\n  var PAGE_CSS = ' + js_string(scope_css(css) + '\n.aicheck-app .wrap[hidden]{display:none}\n.aicheck-app .apppanel{margin:16px 24px 0;padding:10px 14px;display:flex;flex-direction:column;gap:8px}\n.aicheck-app .approw{display:flex;gap:12px;align-items:center;flex-wrap:wrap;font-size:13px;color:var(--ink-2)}\n.aicheck-app .approw label{display:inline-flex;gap:6px;align-items:center}\n.aicheck-app .approw input,.aicheck-app .approw select{border:1px solid var(--line);background:var(--ground);color:var(--ink);border-radius:4px;padding:5px 8px;font-size:13px}\n.aicheck-app .appmsg{padding:4px 10px;border-radius:4px}\n.aicheck-app .appmsg.ok{background:var(--accent-soft);color:var(--accent)} .aicheck-app .appmsg.warn{background:var(--warn-soft);color:var(--warn)} .aicheck-app .appmsg.err{background:var(--block-soft);color:var(--block)}') + ';\n  var PAGE_HTML = ' + js_string(markup.replace('__H1__', 'AI Check').replace('__TITLE__', 'AI Check')) + ';\n')
        parts.append('  // ---- wording and data assembly (review-app/enrich.js) ----\n' + read(os.path.join(SCRIPTS, 'review-app', 'enrich.js')) + '\n')
        parts.append('  // ---- the page script: bootReview(D) ----\n' + script + '\n')
out = os.path.join(HERE, 'dist', 'ai-check-plugin.js'); os.makedirs(os.path.dirname(out), exist_ok=True)
text = '\n'.join(parts); open(out, 'w', encoding='utf-8').write(text)
print('built', out, len(text.splitlines()), 'lines, version', version)
