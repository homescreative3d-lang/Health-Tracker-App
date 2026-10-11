"""
Builds public/tended-guide.pdf from src/content/guide.json (the same content as the in-app guide).
Run after editing the guide:  python3 scripts/build-guide-pdf.py
Requires Playwright with Chromium (pip install playwright && playwright install chromium).
"""
import asyncio, base64, html, json, os, pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
guide = json.loads((ROOT / "src/content/guide.json").read_text(encoding="utf-8"))
logo = base64.b64encode((ROOT / "public/tended-icon.svg").read_bytes()).decode()
font_dir = ROOT / "node_modules/@fontsource/poppins/files"

def font_face(weight):
    f = font_dir / f"poppins-latin-{weight}-normal.woff2"
    if not f.exists():
        return ""
    data = base64.b64encode(f.read_bytes()).decode()
    return f"@font-face{{font-family:Poppins;font-weight:{weight};src:url(data:font/woff2;base64,{data}) format('woff2')}}"

colors = ["#F2A93B", "#2FA37A", "#E8735A", "#5B6BE0"]
sections_html = []
for i, s in enumerate(guide["sections"]):
    steps = "".join(f"<li><span>{n+1}</span><p>{html.escape(t)}</p></li>" for n, t in enumerate(s["steps"]))
    sections_html.append(
        f"<section style='--c:{colors[i % 4]}'><h2><em>{i+1:02d}</em>{html.escape(s['title'])}</h2><ol>{steps}</ol></section>"
    )
toc = "".join(f"<li><em>{i+1:02d}</em>{html.escape(s['title'])}</li>" for i, s in enumerate(guide["sections"]))

page = f"""<!doctype html><html><head><meta charset="utf-8"><style>
{font_face(400)}{font_face(600)}{font_face(700)}
@page {{ size: A4; margin: 18mm 16mm 20mm; }}
* {{ box-sizing: border-box; }}
body {{ font-family: Poppins, Arial, sans-serif; color: #0F2A33; font-size: 10.5pt; line-height: 1.55; margin: 0; }}
.cover {{ width: 100%; height: 255mm; display: flex; flex-direction: column; justify-content: center; page-break-after: always; position: relative; }}
.cover::before {{ content: ""; position: absolute; top: 0; left: 0; right: 0; height: 5px; background: linear-gradient(90deg,#F2A93B,#2FA37A,#E8735A,#5B6BE0); border-radius: 4px; }}
.brand {{ display: flex; align-items: center; gap: 14px; }}
.brand img {{ width: 64px; height: 64px; }}
.brand b {{ font-size: 30pt; letter-spacing: -1px; }}
.cover h1 {{ font-size: 34pt; line-height: 1.05; letter-spacing: -1.5px; margin: 28px 0 12px; }}
.cover p {{ font-size: 12pt; color: #2C4650; max-width: 140mm; }}
.toc {{ margin-top: 26px; columns: 2; padding: 0; list-style: none; }}
.toc li {{ padding: 5px 0; font-weight: 600; break-inside: avoid; }}
.toc em {{ font-style: normal; color: #0B7A6E; margin-right: 8px; }}
section {{ break-inside: avoid; margin-bottom: 18px; padding: 14px 16px; border-radius: 14px; border: 1px solid #E1E7EE; border-left: 5px solid var(--c); }}
h2 {{ font-size: 14pt; margin: 0 0 10px; display: flex; align-items: center; gap: 10px; }}
h2 em {{ font-style: normal; color: var(--c); font-size: 12pt; }}
ol {{ list-style: none; margin: 0; padding: 0; display: grid; gap: 7px; }}
ol li {{ display: flex; gap: 10px; }}
ol li span {{ flex: none; width: 20px; height: 20px; border-radius: 50%; background: #0F2A33; color: #fff; font-size: 8.5pt; font-weight: 700; display: flex; align-items: center; justify-content: center; margin-top: 1px; }}
ol li p {{ margin: 0; }}
.disclaimer {{ margin-top: 10px; padding: 12px 14px; border-radius: 12px; background: #FDF3E1; color: #6E4708; font-size: 9.5pt; }}
</style></head><body>
<div class="cover">
  <div class="brand"><img src="data:image/svg+xml;base64,{logo}"><b>tended</b></div>
  <h1>{html.escape(guide['title'])}</h1>
  <p>{html.escape(guide['intro'])}</p>
  <ol class="toc">{toc}</ol>
</div>
{''.join(sections_html)}
<div class="disclaimer">{html.escape(guide['disclaimer'])}</div>
</body></html>"""

async def main():
    from playwright.async_api import async_playwright
    async with async_playwright() as p:
        exe = os.environ.get("CHROME_PATH")
        browser = await p.chromium.launch(executable_path=exe) if exe else await p.chromium.launch()
        pg = await browser.new_page()
        await pg.set_content(page, wait_until="load")
        await pg.pdf(path=str(ROOT / "public/tended-guide.pdf"), format="A4", print_background=True,
                     display_header_footer=True, header_template="<span></span>",
                     footer_template="<div style='font-size:8px;width:100%;text-align:center;color:#5A6F78;font-family:Arial'>Tended guide · page <span class='pageNumber'></span> of <span class='totalPages'></span></div>",
                     margin={"top": "18mm", "bottom": "20mm", "left": "16mm", "right": "16mm"})
        await browser.close()
    print("wrote public/tended-guide.pdf")

asyncio.run(main())
