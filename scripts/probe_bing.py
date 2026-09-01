import urllib.parse, urllib.request, re
q='iPhone 17 Pro 256GB Prata'
url='https://www.bing.com/images/search?q='+urllib.parse.quote(q)
req=urllib.request.Request(url, headers={'User-Agent':'Mozilla/5.0'})
with urllib.request.urlopen(req, timeout=20) as r:
    html = r.read().decode('utf-8', 'ignore')
    print('STATUS', r.status)
    print('LEN', len(html))
    print(html[:2000])
    matches = re.findall(r'"(?:murl|thumburl)":"([^"]+)"', html)
    print('MATCHES', matches[:10])
    print('HAS_MURL', 'murl' in html.lower())
