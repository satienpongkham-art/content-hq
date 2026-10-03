"""Build: inline shared CSS/JS into the two pages.
  dist/hq.html    -> publish to claude.ai as an Artifact (platform adds <html>/<head>)
  docs/index.html -> FHC · Financial Health Check (public form, GitHub Pages)
  docs/hq/index.html -> Content HQ web agent (GitHub Pages, PIN + Apps Script API)
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
build("hq.html", root / "dist" / "hq.html", **{"/*@HQ_CSS@*/": hq_css, "/*@FHC_CORE@*/": core, "<!--@SHIM@-->": ""})
shim = (src / "hq-github.js").read_text(encoding="utf-8")
HEAD = """<!doctype html>
<html lang="th">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex,nofollow">
<meta name="theme-color" content="#0b1030">
"""
build("hq.html", root / "docs" / "hq" / "index.html", **{"<title>": HEAD + "<title>", "/*@HQ_CSS@*/": hq_css, "/*@FHC_CORE@*/": core,
      "<!--@SHIM@-->": "<script>\n" + shim + "\n</script>", "<svg width=\"0\"": "</head>\n<body>\n<svg width=\"0\""})
build("fhc-public.html", root / "docs" / "index.html", **{"/*@FHC_CORE@*/": core})
