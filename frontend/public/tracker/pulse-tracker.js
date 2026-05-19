// Pulse Tracker — AI Search Traffic Detection (<2KB minified, no PII, no cookies)
// Usage: <script src="/tracker/pulse-tracker.js" data-project="ID" data-endpoint="URL"></script>
(function () {
  'use strict';
  var s = document.currentScript;
  if (!s) return;
  var pid = s.getAttribute('data-project');
  var ep = s.getAttribute('data-endpoint');
  if (!pid || !ep) return;

  var engines = [
    { id: 'chatgpt', p: ['chat.openai.com', 'chatgpt.com'] },
    { id: 'perplexity', p: ['perplexity.ai'] },
    { id: 'claude', p: ['claude.ai'] },
    { id: 'gemini', p: ['gemini.google.com', 'bard.google.com'] },
    { id: 'copilot', p: ['copilot.microsoft.com', 'bing.com/chat'] },
    { id: 'you', p: ['you.com'] },
    { id: 'phind', p: ['phind.com'] },
    { id: 'kagi', p: ['kagi.com'] },
    { id: 'neeva', p: ['neeva.com'] },
    { id: 'brave-search', p: ['search.brave.com'] },
    { id: 'meta-ai', p: ['meta.ai', 'ai.meta.com'] },
    { id: 'cohere', p: ['coral.cohere.com', 'cohere.com'] }
  ];

  var ref = document.referrer || '';
  var det = null;
  for (var i = 0; i < engines.length; i++) {
    for (var j = 0; j < engines[i].p.length; j++) {
      if (ref.indexOf(engines[i].p[j]) !== -1) { det = engines[i].id; break; }
    }
    if (det) break;
  }
  if (!det) return;

  var sid = pid + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  var dev = /Mobi|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop';
  var data = JSON.stringify({ projectId: pid, engine: det, referrer: ref, landingPage: location.pathname, sessionId: sid, device: dev });

  if (navigator.sendBeacon) {
    navigator.sendBeacon(ep, new Blob([data], { type: 'application/json' }));
  } else {
    var x = new XMLHttpRequest();
    x.open('POST', ep, true);
    x.setRequestHeader('Content-Type', 'application/json');
    x.send(data);
  }
})();
