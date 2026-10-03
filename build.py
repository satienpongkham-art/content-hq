"""Build: inline shared CSS/JS into the two pages.
  dist/hq.html    -> publish to claude.ai as an Artifact (platform adds <html>/<head>)
  docs/index.html -> customer FHC form for GitHub Pages
"""
from pathlib import Path
root = Path(__file__).parent
src = root / "src"
core = (src / "fhc-core.js").read_text(encoding="utf-8")
hq_css = (src / "hq.css").read_text(encoding="utf-8")
def build(name, out, **repl):
    html = (src / name).read_text(encoding="utf-8")
    for k, v in repl.items():
        html = html.replace(k, v)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(html, encoding="utf-8")
    print("built", out.relative_to(root), len(html), "bytes")
build("hq.html", root / "dist" / "hq.html", **{"/*@HQ_CSS@*/": hq_css, "/*@FHC_CORE@*/": core})
build("fhc-public.html", root / "docs" / "index.html", **{"/*@FHC_CORE@*/": core})
build("fhc-public.html", root / "gas" / "Index.html", **{"/*@FHC_CORE@*/": core})
