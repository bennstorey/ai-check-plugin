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
def studio_markup(m):
    """The shared page markup, reshaped for Studio's custom-app container: a one-line header, and one
    decide bar (with the job details folded away) in place of the three output boxes."""
    m = re.sub(r'<header class="top">.*?</header>', '<div class="top compact"><span class="eyebrow" id="eyebrow">AI Check</span><span id="title" class="ttl"></span><span class="sub" id="subtitle"></span><span class="chips" id="chips"></span></div>', m, flags=re.S)
    decide = (
        '<div class="out decide">'
        '  <div class="decide-row"><span class="sum" id="actSum"></span><span class="sum" id="todoSum"></span><span class="sum" id="ignSum"></span></div>'
        '  <div class="decide-row"><button class="btn primary" id="aicheck-send" disabled>Send</button><span id="aicheck-msg" class="appmsg"></span></div>'
        '  <div class="decide-row hint">Send writes the decisions to the layout and sets its AI check to Fixes approved. The layout must then be checked out and checked in from InDesign for the fixes to apply. Always rules travel with the decisions; their home in the brand knowledge is still to build.</div>'
        '  <details class="jobdetails"><summary>Job details</summary>'
        '    <label>Fixes (Actions)<textarea id="actions" readonly spellcheck="false"></textarea></label><button class="btn" id="copyActions">Copy</button>'
        '    <label>Brand rules (Always fix / Always ignore)<textarea id="rules" readonly spellcheck="false"></textarea></label>'
        '    <label>Template to-dos<textarea id="todos" readonly spellcheck="false"></textarea></label><button class="btn" id="copyTodos">Copy</button>'
        '    <label>Ignored this time<textarea id="ignore" readonly spellcheck="false"></textarea></label><button class="btn" id="copyIgnore">Copy</button>'
        '  </details>'
        '</div>')
    m = re.sub(r'<div class="out">.*?</div>\s*</section>\s*</main>', decide + '\n  </section>\n</main>', m, flags=re.S)
    m = re.sub(r'<div class="legend">.*?</div>', '<div class="legend"><span class="b"><i></i>Block</span><span class="w"><i></i>Warn</span><span class="i"><i></i>Info</span><label><input type="checkbox" id="showAll"> Show every frame</label></div>', m, flags=re.S)
    m = m.replace('<footer class="foot" id="foot"></footer>', '<div class="foot" id="foot"></div>')
    return m
STUDIO_CSS = """
.aicheck-app .wrap[hidden]{display:none}
.aicheck-app{display:flex;flex-direction:column;min-height:0;height:100%;overflow:hidden}
.aicheck-app .apppanel{margin:8px 12px 0;padding:8px 12px;display:flex;flex-direction:column;gap:6px;flex:0 0 auto}
.aicheck-app .approw{display:flex;gap:10px;align-items:center;flex-wrap:wrap;font-size:13px;color:var(--ink-2)}
.aicheck-app .approw label{display:inline-flex;gap:6px;align-items:center}
.aicheck-app .approw input,.aicheck-app .approw select{border:1px solid var(--line);background:var(--ground);color:var(--ink);border-radius:4px;padding:4px 8px;font-size:13px;max-width:260px}
.aicheck-app .appmsg{padding:3px 8px;border-radius:4px;font-size:13px}
.aicheck-app .appmsg.ok{background:var(--accent-soft);color:var(--accent)} .aicheck-app .appmsg.warn{background:var(--warn-soft);color:var(--warn)} .aicheck-app .appmsg.err{background:var(--block-soft);color:var(--block)}
.aicheck-app .top.compact{display:flex;gap:12px;align-items:baseline;flex-wrap:wrap;padding:6px 24px 0;border:0;background:transparent;flex:0 0 auto}
.aicheck-app .top.compact .ttl{font-weight:600;font-size:15px}
.aicheck-app main.wrap{flex:1 1 auto;min-height:0;display:grid;grid-template-columns:minmax(300px,40%) 1fr;gap:12px;padding:8px 12px 12px;max-width:none;margin:0;overflow:hidden}
.aicheck-app main.wrap>.panel{min-height:0;overflow:auto;display:flex;flex-direction:column}
.aicheck-app .viewer{position:static}
.aicheck-app .stage{flex:0 0 auto}
.aicheck-app .page{max-width:100%}
.aicheck-app #groups{flex:1 1 auto}
.aicheck-app .out.decide{position:sticky;bottom:0;display:flex;flex-direction:column;gap:6px;padding:8px 12px;background:var(--paper);border-top:2px solid var(--accent)}
.aicheck-app .decide-row{display:flex;gap:10px;align-items:center;flex-wrap:wrap;font-size:13px}
.aicheck-app .decide-row.hint{color:var(--ink-3);font-size:12px}
.aicheck-app .jobdetails{font-size:12px;color:var(--ink-3)}
.aicheck-app .jobdetails summary{cursor:pointer}
.aicheck-app .jobdetails label{display:block;margin-top:6px}
.aicheck-app .jobdetails textarea{width:100%;height:64px;font:400 11px/1.4 "IBM Plex Mono",ui-monospace,Menlo,monospace;background:var(--ground);color:var(--ink);border:1px solid var(--line);border-radius:4px;padding:6px}
.aicheck-app .foot{padding:4px 24px 8px;color:var(--ink-3);font-size:11px;flex:0 0 auto;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.aicheck-app .approw .line{color:var(--ink);font-size:12px}
@media (max-width:900px){.aicheck-app main.wrap{grid-template-columns:1fr;overflow:auto}}
"""
def js_string(s): return "'" + s.replace('\\', '\\\\').replace("'", "\\'").replace('\n', '\\n').replace('</script', '<\\/script') + "'"
srcs = sorted(f for f in os.listdir(os.path.join(HERE, 'src')) if f.endswith('.js') and not f.startswith('_'))
stamp = datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')
version = stamp + ' ' + hashlib.sha256((css + markup + script + read(os.path.join(SCRIPTS, 'review-app', 'enrich.js')) + ''.join(read(os.path.join(HERE, 'src', f)) for f in srcs)).encode()).hexdigest()[:8]
parts = []
for f in srcs:
    parts.append('// ---- ' + f + ' ----\n' + read(os.path.join(HERE, 'src', f)).replace('__VERSION__', version))
    if f == '10-studio-api.js':
        parts.append('  // ---- shared review page (from build-review-page.py) ----\n  var PAGE_CSS = ' + js_string(scope_css(css) + STUDIO_CSS) + ';\n  var PAGE_HTML = ' + js_string(studio_markup(markup).replace('__H1__', '').replace('__TITLE__', 'AI Check')) + ';\n')
        parts.append('  // ---- wording and data assembly (review-app/enrich.js) ----\n' + read(os.path.join(SCRIPTS, 'review-app', 'enrich.js')) + '\n')
        parts.append('  // ---- the page script: bootReview(D) ----\n' + script + '\n')
out = os.path.join(HERE, 'dist', 'ai-check-plugin.js'); os.makedirs(os.path.dirname(out), exist_ok=True)
text = '\n'.join(parts); open(out, 'w', encoding='utf-8').write(text)
print('built', out, len(text.splitlines()), 'lines, version', version)
