#!/usr/bin/env python3
"""Rebuild site/index.html from src/head.html + src/game.js.

Questions live in site/questions.js and are NOT built into the page: the page loads them from
jsDelivr (straight from this GitHub repo) with site/questions.js as a fallback, so a question-only
update needs no Netlify deploy. Run from the repo root:  python3 tools/build.py
"""
import json, os
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
head = open(os.path.join(root, 'src/head.html')).read()
game = open(os.path.join(root, 'src/game.js')).read()
voice_ids = sorted(f[:-4] for f in os.listdir(os.path.join(root, 'site/voice')) if f.endswith('.mp3'))
REPO = 'djjacksprigg-dev/fairway-fc-d2774'
head = head.replace('<script src="https://cdn.jsdelivr.net/npm/three@0.149.0/build/three.min.js"></script>', '<script src="three.min.js"></script>')
assert 'src="three.min.js"' in head
te = head.index('</title>') + 8
fav = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%230b1626'/%3E%3Ccircle cx='32' cy='46' r='9' fill='%23fff'/%3E%3Cpath d='M30 8v30' stroke='%23fff' stroke-width='3'/%3E%3Cpath d='M30 8l20 6-20 6z' fill='%23ffc929'/%3E%3C/svg%3E"
doc = f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
{head[:te]}
<meta name="description" content="Football trivia footgolf. Rarer answers kick further. Daily round, quick and full rounds, pass and play, match play and online rooms.">
<meta name="theme-color" content="#0b1626">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta property="og:title" content="Fairway FC">
<meta property="og:description" content="Football trivia footgolf. Rarer answers kick further.">
<link rel="icon" href="{fav}">
<style>[hidden]{{display:none!important}}img{{max-width:100%}}</style>
<script>window.FAIRWAY_API='/api';window.FAIRWAY_VOICE='/voice/';window.FAIRWAY_VOICE_IDS={json.dumps(voice_ids)};</script>
</head>
<body>
{head[te:]}
<script src="https://cdn.jsdelivr.net/gh/{REPO}@main/site/questions.js"></script>
<script>if(typeof BANK==='undefined')document.write('<script src="questions.js"><\\/script>');</script>
<script>
{game}</script>
</body>
</html>
'''
open(os.path.join(root, 'site/index.html'), 'w').write(doc)
print('built site/index.html')
