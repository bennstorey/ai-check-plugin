#!/usr/bin/env python3
"""build-states-report.py — the invented report behind states.html.

Every card the panel can draw, in one report: each judgement, each confidence, fixable and not, decided and not,
one finding per item and several, a long filename, a long excerpt, a master-page finding, a rule check with no
judgement of mine. The words are invented — no layout, no client, nothing confidential — so the states page can be
opened by anyone and shown to anyone.

    python3 04-scripts/studio-plugin/build-states-report.py      # writes states-data/report.json

The report is written to the schema the panel reads (runner report v2): layout, outcome, coverage, frames, findings.
`words` is set on every finding so the fold reads the same here as it does on a real run.
"""
import json, os

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'states-data')

PAGE_BOUNDS = [0, 0, 1020, 820]
RUN_ID = 'states'                      # states.html seeds localStorage under aicheck-states


def frame(fid, label, role, top, left, height, width, **kw):
    f = {'id': fid, 'kind': kw.get('kind', 'TextFrame'), 'page': '1',
         'bounds': [top, left, top + height, left + width], 'pageBounds': PAGE_BOUNDS,
         'label': label, 'role': role, 'roleStatus': kw.get('roleStatus', 'mapped'), 'inGroup': False,
         'holdsImage': kw.get('holdsImage', False), 'picture': kw.get('picture'),
         'snippet': kw.get('snippet'), 'origin': {'kind': kw.get('origin', 'page'), 'master': None},
         'roleFrom': kw.get('roleFrom', 'style, confirmed')}
    return f


def finding(fid, fr, severity, title, detail, **kw):
    f = {'id': fid, 'check': kw.get('check', 'agent.finding'), 'severity': severity, 'page': '1',
         'frameId': fr['id'], 'elementLabel': fr['label'], 'role': fr['role'], 'roleStatus': fr['roleStatus'],
         'detail': detail, 'fixable': bool(kw.get('fix')), 'fix': kw.get('fix'), 'fixes': None, 'standby': None,
         'alsoFrames': None, 'bounds': fr['bounds'], 'pageBounds': PAGE_BOUNDS,
         'origin': {'kind': kw.get('origin', 'page'), 'master': kw.get('master')}}
    if kw.get('judgement'):
        f['ai'] = {'title': title, 'judgement': kw['judgement'], 'confidence': kw.get('confidence', 'high'),
                   'evidence': kw.get('evidence', 'I compared this against the way the rest of the section is set.'),
                   'fixWords': kw.get('fixWords'), 'outcomeWords': kw.get('outcomeWords'),
                   'needsTool': kw.get('needsTool')}
    f['words'] = {'issue': detail, 'fix': kw.get('fixWords'), 'outcome': kw.get('outcomeWords'),
                  'note': kw.get('note'), 'origin': kw.get('originWords'),
                  'templateFlag': kw.get('origin') in ('master', 'masterOverride')}
    return f


# --- the cast -------------------------------------------------------------------------------------------------------
body1 = frame(101, 'TX Body Text', 'body', 120, 60, 300, 300, snippet='The council met on Tuesday to settle the')
body2 = frame(102, 'TX Body Text', 'body', 120, 380, 300, 300, snippet='question of the pier, which has stood')
head1 = frame(103, 'HD Headline', 'title', 40, 60, 60, 620, snippet='Pier saved after years of argument')
pic1 = frame(104, 'PF Picture Frame', 'image', 440, 60, 220, 300, kind='Rectangle', holdsImage=True,
             picture={'link': 'harbour-morning.psd', 'status': 'NORMAL', 'managed': False})
pic2 = frame(105, 'PF Picture Frame', 'image', 440, 380, 220, 300, kind='Rectangle', holdsImage=True,
             picture={'link': '260719_harbour-at-first-light_print_0001-final-v3-approved.ai',
                      'status': 'NORMAL', 'managed': False})
quote = frame(106, 'PQ Picture Quote', 'quote', 690, 60, 90, 300, snippet='“Nobody thought it would still be here”')
cap1 = frame(107, 'PC Picture Caption', 'caption', 680, 380, 40, 300, snippet='The pier at first light')
folio = frame(108, 'FO Folio', 'furniture', 960, 60, 24, 620, origin='master', snippet='The Weekly · 12')
side = frame(109, 'SB Sidebar Text', 'body', 690, 400, 240, 280, roleFrom='frame type', roleStatus='guessed',
             snippet='Three things the inspectors found when they walked the deck in March')

rule2 = frame(110, 'RL Folio Rule', 'furniture', 952, 60, 4, 620, kind='GraphicLine', origin='master',
              roleFrom='frame type')

FRAMES = [head1, body1, body2, pic1, pic2, quote, cap1, folio, side, rule2]

F = [
    # a mistake, very sure, with a fix — the ordinary case
    finding('s-slip-fix', body1, 'block', 'Second leg of the story is overset',
            'The second leg holds 420 characters more than will fit, so the last two paragraphs are not printing.',
            judgement='slip', confidence='high', fix={'op': 'ResetParagraphAttributes', 'params': {'frameId': 101}},
            fixWords='I put the tracking back to the style and the copy fits again.',
            outcomeWords='The story ends on the page instead of running into nothing.'),
    # needs a person, with a fix offered — the promoted button reads "Reset this time"
    finding('s-ask-fix', body2, 'block', 'Body copy tracked in by hand',
            'This leg is tracked to -8 where the style sets 0, which is how it was made to fit.',
            judgement='ask', confidence='high', fix={'op': 'ResetParagraphAttributes', 'params': {'frameId': 102}},
            fixWords='If it should follow style, this puts the tracking back to 0 — the re-fitting is then yours to redo.',
            outcomeWords='The copy is set the way the section sets it.'),
    # looks deliberate — no promoted button at all, only the ⋯
    finding('s-intent', head1, 'warn', 'Headline is set tighter than the style',
            'The headline is tracked to -12 against the style’s -5, which is what this section does on a long line.',
            judgement='intent', confidence='medium',
            fixWords='I would put the tracking back to -5, but I think this one is deliberate.'),
    # not fixable, a note is the only thing a person can do here
    finding('s-pic-note', pic1, 'block', 'Picture is not a Studio or Assets object',
            'This picture was placed from outside the system, so it does not travel with the layout and nobody can see where it came from.',
            judgement='slip', confidence='high',
            needsTool='A way to find the same picture in Assets and relink it.'),
    # a very long filename: the item’s own words must wrap, not push the panel sideways
    finding('s-pic-long', pic2, 'block', 'Picture is not a Studio or Assets object',
            'This picture was placed from outside the system, so it does not travel with the layout.',
            judgement='slip', confidence='low'),
    # two findings on ONE item: the item header appears above them
    finding('s-pair-a', quote, 'warn', 'Pull quote is on the wrong style',
            'The pull quote is set in the body style with the size changed by hand.',
            judgement='slip', confidence='medium', fix={'op': 'ApplyParagraphStyle', 'params': {'style': 'PQ Pull Quote'}},
            fixWords='I put it on the pull-quote style.', outcomeWords='The quote matches every other quote in the section.'),
    # the same severity as its sibling on purpose: the list groups by severity first, so two findings only share an
    # item header when they are both in the same section
    finding('s-pair-b', quote, 'warn', 'Pull quote sits closer to the picture than the section does',
            'There are 4 pt between the quote and the picture; the section uses 12 pt.',
            judgement='ask', confidence='low'),
    # already decided in the seeded state: a chosen fix, a chosen always-ignore, a sticky left
    finding('s-decided-fix', cap1, 'warn', 'Caption is missing its credit',
            'The caption has no credit, and every other caption in this section carries one.',
            judgement='slip', confidence='medium', fix={'op': 'ApplyParagraphStyle', 'params': {'style': 'PC Caption'}},
            fixWords='I put the caption on the style that carries the credit.'),
    finding('s-decided-ign', side, 'warn', 'Sidebar is set in the body style',
            'The sidebar uses the body style; the section has a sidebar style for this.',
            judgement='slip', confidence='low', fix={'op': 'ApplyParagraphStyle', 'params': {'style': 'SB Sidebar'}},
            fixWords='I put it on the sidebar style.'),
    finding('s-decided-note', pic1, 'warn', 'Picture is smaller than the frame it sits in',
            'The picture covers about three quarters of its frame, leaving a white band down the right.',
            judgement='ask', confidence='medium'),
    # a finding that came from the master page: the "Flag for the template" button appears
    finding('s-master', folio, 'info', 'Folio is 2 pt below where the template puts it',
            'The folio sits at 960 pt; the template’s folio sits at 958 pt.',
            judgement='ask', confidence='medium', origin='master', master='A-Feature',
            originWords='From the master page “A-Feature”, so every page inherits it.'),
    # the same master-page case NOT yet flagged, so the two states of the flag sit next to each other: the states page
    # is only worth having if it shows a button before AND after it is pressed (Benn, 2026-10-02)
    finding('s-master-2', rule2, 'info', 'Rule line under the folio is a hairline',
            'The rule under the folio is 0.25 pt; the template draws it at 0.5 pt.',
            judgement='slip', confidence='low', origin='master', master='A-Feature',
            originWords='From the master page “A-Feature”, so every page inherits it.'),
    # a rule check: no judgement of mine, no fold title of my own
    finding('s-rule', body1, 'info', None,
            'Paragraph 3 has a left indent of 6 pt applied by hand; the style sets 0.',
            check='stylesheeted', fix={'op': 'ResetParagraphAttributes', 'params': {'frameId': 101}}),
]

report = {
    'runId': RUN_ID, 'schemaVersion': 2, 'mode': 'ai', 'runner': 'states-page', 'reader': 'invented',
    'layout': {'name': 'Every card.indd', 'objectId': '0', 'status': 'Ready for layout', 'pages': 1,
               'version': '1.0', 'template': None},
    'outcome': {'ok': False, 'failOn': 'block', 'counts': {'block': 4, 'warn': 5, 'info': 3},
                'summary': 'Every card the panel can draw — invented, for looking at the design.'},
    'coverage': {'pageItemsWalked': len(FRAMES), 'textFramesWalked': 7, 'textFramesInGroups': 0},
    'findings': F, 'frames': FRAMES, 'checksRun': [], 'checksSkipped': [], 'rules': [], 'labelRoles': None,
    'timing': {}, 'placedArticles': [], 'workedTo': None,
}

PAGE_SVG = ('<svg xmlns="http://www.w3.org/2000/svg" width="820" height="1020">'
            '<rect width="820" height="1020" fill="#fbfbfa"/>'
            '<text x="410" y="520" text-anchor="middle" font-family="Helvetica" font-size="26" fill="#cbd5e1">'
            'an invented page</text></svg>')

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, 'page-1.svg'), 'w') as fh:
        fh.write(PAGE_SVG)
    with open(os.path.join(OUT, 'report.json'), 'w') as fh:
        json.dump(report, fh, indent=1)
    print('states-data/report.json: %d findings on %d frames' % (len(F), len(FRAMES)))
