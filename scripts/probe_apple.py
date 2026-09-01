import urllib.request, re
url = 'https://www.apple.com/iphone-16/'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
with urllib.request.urlopen(req, timeout=20) as r:
    html = r.read().decode('utf-8', 'ignore')
    print('STATUS', r.status)
    matches = re.findall(r'<meta[^>]+(?:property|name)=["\'](?:og:image|twitter:image)["\'][^>]+content=["\']([^"\']+)["\']', html, re.I)
    print('MATCHES', matches[:10])
    print('HAS_OG_IMG', 'og:image' in html.lower())
    for line in html.splitlines():
        if 'og:image' in line.lower() or 'twitter:image' in line.lower():
            print(line[:300])
            break
