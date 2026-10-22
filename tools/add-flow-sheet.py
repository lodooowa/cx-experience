# Dopisuje zakładkę "Przepływ" (Z, Do, Etykieta, Scenariusz, Opcjonalny + kolumny podglądu z nazwą punktu) do macierz_CX.xlsx lub macierz_CX_demo.xlsx.
# Reszta pliku zostaje bez zmian (kopiowana bajt w bajt). Przed zapisem powstaje kopia plik.xlsx.bak; ponowne uruchomienie nic nie robi.
# Starą zakładkę "Przepływ" (bez kolumn z nazwą) przebudowuje, zachowując wpisane przejścia.
# Użycie: python3 tools/add-flow-sheet.py [plik.xlsx ...]  (bez argumentów: oba pliki z katalogu głównego repo)
#         python3 tools/add-flow-sheet.py --przyklad macierz_CX_demo.xlsx  (dodatkowo wypełnia zakładkę przykładowym przepływem DEMO)
import html, re, shutil, sys, zipfile
from pathlib import Path
from xml.sax.saxutils import escape

ROOT = Path(__file__).resolve().parent.parent
NAME = "Przepływ"
HEADER = ["Z (Touchpoint ID)", "Z – punkt styku", "Do (Touchpoint ID)", "Do – punkt styku", "Etykieta", "Scenariusz", "Opcjonalny (tak/nie)"]
WIDTHS = [20, 34, 20, 34, 34, 24, 20]
EDGE_COLS = "ACEFG"  # kolumny wpisywane ręcznie: Z, Do, Etykieta, Scenariusz, Opcjonalny (B i D to formuły podglądu)
ROWS = 500  # zasięg list rozwijanych
CT = "application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"
REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet"


def cell(ref, value, style=""):
    return f'<c r="{ref}"{style} t="inlineStr"><is><t>{escape(value)}</t></is></c>'


def sheet_xml(header_style, edges, id_col, title_col):
    cols = "".join(f'<col min="{i + 1}" max="{i + 1}" width="{w}" customWidth="1"/>' for i, w in enumerate(WIDTHS))
    s = f' s="{header_style}"' if header_style else ""
    ids, titles = f"'Macierz CX'!${id_col}$2:${id_col}${ROWS}", f"'Macierz CX'!${title_col}$2:${title_col}${ROWS}"
    rows = ['<row r="1">' + "".join(cell("ABCDEFG"[i] + "1", h, s) for i, h in enumerate(HEADER)) + "</row>"]
    for n in range(2, ROWS + 1):
        edge = edges[n - 2] if n - 2 < len(edges) else ()
        cells = [cell(EDGE_COLS[i] + str(n), v) for i, v in enumerate(edge) if v]
        for src, dst in (("A", "B"), ("C", "D")):
            f = f'IF({src}{n}="","",IFERROR(INDEX({titles},MATCH({src}{n},{ids},0)),"— brak takiego ID"))'
            cells.append(f'<c r="{dst}{n}"><f>{escape(f)}</f></c>')
        rows.append(f'<row r="{n}">' + "".join(sorted(cells, key=lambda c: re.search(r'r="([A-Z])', c).group(1))) + "</row>")
    return (f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
            f'<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
            f'<cols>{cols}</cols><sheetData>{"".join(rows)}</sheetData>'
            f'<dataValidations count="2">'
            f'<dataValidation type="list" allowBlank="1" showErrorMessage="1" errorTitle="Nieznany punkt" error="Wybierz Touchpoint ID z zakładki Macierz CX." sqref="A2:A{ROWS} C2:C{ROWS}"><formula1>{escape(ids)}</formula1></dataValidation>'
            f'<dataValidation type="list" allowBlank="1" showErrorMessage="1" sqref="G2:G{ROWS}"><formula1>"tak,nie"</formula1></dataValidation>'
            f'</dataValidations></worksheet>')


def sheet_part(wb, rels, name):
    # Ścieżka części XML zakładki o danej nazwie (None, gdy zakładki nie ma).
    m = re.search(r'<sheet [^>]*name="%s"[^>]*r:id="(rId\d+)"' % re.escape(name), wb)
    if not m:
        return None
    rid = m.group(1)
    target = re.search(r'<Relationship [^>]*?(?:Target="([^"]+)"[^>]*Id="%s"|Id="%s"[^>]*Target="([^"]+)")' % (rid, rid), rels)
    part = (target.group(1) or target.group(2)).lstrip("/")
    return part if part.startswith("xl/") else "xl/" + part


def read_rows(z, part):
    # Wiersze zakładki jako listy (kolumna, tekst) w kolejności wierszy; pierwszy element to nagłówki.
    xml = z.read(part).decode("utf-8")
    shared = re.findall(r"<si>(.*?)</si>", z.read("xl/sharedStrings.xml").decode("utf-8"), re.S) if "xl/sharedStrings.xml" in z.namelist() else []

    def value(c):
        if 't="s"' in c:
            return html.unescape("".join(re.findall(r"<t[^>]*>([^<]*)</t>", shared[int(re.search(r"<v>(\d+)</v>", c).group(1))])))
        inline = re.search(r"<t[^>]*>([^<]*)</t>", c)
        return html.unescape(inline.group(1) if inline else (re.search(r"<v>([^<]*)</v>", c) or [None, ""])[1])

    rows = []
    for _, body in re.findall(r'<row [^>]*r="(\d+)"[^>]*>(.*?)</row>', xml, re.S):
        rows.append([(re.search(r'r="([A-Z]+)', c).group(1), value(c)) for c in re.findall(r"<c [^>]*?(?:/>|>.*?</c>)", body, re.S)])
    return rows


def macierz_cols(z, wb, rels):
    # Zwraca (kolumna Touchpoint ID, kolumna Punkt styku, lista ID w kolejności wierszy) z pierwszej zakładki "Macierz CX".
    rows = read_rows(z, sheet_part(wb, rels, "Macierz CX"))
    head = {v: c for c, v in rows[0]}
    for h in ("Touchpoint ID", "Punkt styku"):
        if h not in head:
            raise SystemExit(f"Zakładka 'Macierz CX': brak kolumny '{h}'")
    ids = [v for r in rows[1:] for c, v in r if c == head["Touchpoint ID"] and v]
    return head["Touchpoint ID"], head["Punkt styku"], ids


def existing_edges(z, part):
    # Przejścia wpisane w starej zakładce "Przepływ" (po nagłówkach; kolumny z nazwą ignorowane).
    rows = read_rows(z, part)
    col = {v: c for c, v in rows[0]}
    keys = ["Z (Touchpoint ID)", "Do (Touchpoint ID)", "Etykieta", "Scenariusz", "Opcjonalny (tak/nie)"]
    edges = []
    for r in rows[1:]:
        d = dict((c, v) for c, v in r)
        edge = tuple(d.get(col.get(k), "") for k in keys)
        if any(edge):
            edges.append(edge)
    return edges


def example_edges(ids):
    # Przykład DEMO: przebieg wg kolejności wierszy, kilka rozwidleń i powrotów. Nie jest to ustalenie eksperta.
    edges = [(a, b, "", "", "") for a, b in zip(ids, ids[1:])]
    if len(ids) > 12:
        edges += [(ids[5], ids[3], "powrót po braku odpowiedzi (DEMO)", "", ""), (ids[8], ids[6], "ponowne zapytanie (DEMO)", "Serwis", ""),
                  (ids[2], ids[6], "skrót (DEMO)", "", "tak"), (ids[10], ids[12], "alternatywa (DEMO)", "Serwis", "tak")]
    return edges


def add(path, example):
    with zipfile.ZipFile(path) as z:
        wb = z.read("xl/workbook.xml").decode("utf-8")
        rels = z.read("xl/_rels/workbook.xml.rels").decode("utf-8")
        ct = z.read("[Content_Types].xml").decode("utf-8")
        id_col, title_col, ids = macierz_cols(z, wb, rels)
        old = sheet_part(wb, rels, NAME)
        edges = None
        if old:
            if any(v == HEADER[1] for _, v in read_rows(z, old)[0]):
                print(f"{path.name}: zakładka '{NAME}' już ma kolumny z nazwą, pominięto")
                return
            edges = existing_edges(z, old)
        n = max(int(m) for m in re.findall(r"xl/worksheets/sheet(\d+)\.xml", " ".join(z.namelist()))) + 1
        header_style = (re.search(r'<c r="A1" s="(\d+)"', z.read("xl/worksheets/sheet2.xml").decode("utf-8")) or [None, ""])[1]
        sheet = sheet_xml(header_style, edges if old else (example_edges(ids) if example else []), id_col, title_col)
        if not old:
            sheet_id = max(int(m) for m in re.findall(r'sheetId="(\d+)"', wb)) + 1
            rid = "rId%d" % (max(int(m) for m in re.findall(r'Id="rId(\d+)"', rels)) + 1)
            wb = wb.replace("</sheets>", f'<sheet name="{NAME}" sheetId="{sheet_id}" state="visible" r:id="{rid}"/></sheets>')
            rels = rels.replace("</Relationships>", f'<Relationship Type="{REL}" Target="/xl/worksheets/sheet{n}.xml" Id="{rid}"/></Relationships>')
            ct = ct.replace("</Types>", f'<Override PartName="/xl/worksheets/sheet{n}.xml" ContentType="{CT}"/></Types>')
        shutil.copy(path, str(path) + ".bak")
        tmp = path.with_suffix(".tmp")
        with zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as out:
            for item in z.infolist():
                data = z.read(item.filename)
                data = {"xl/workbook.xml": wb, "xl/_rels/workbook.xml.rels": rels, "[Content_Types].xml": ct, old: sheet}.get(item.filename, data)
                out.writestr(item, data.encode("utf-8") if isinstance(data, str) else data)
            if not old:
                out.writestr(f"xl/worksheets/sheet{n}.xml", sheet)
    tmp.replace(path)
    print(f"{path.name}: {'przebudowano' if old else 'dodano'} zakładkę '{NAME}' (kopia: {path.name}.bak)")


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if a != "--przyklad"]
    files = [Path(a) for a in args] or [ROOT / "macierz_CX.xlsx", ROOT / "macierz_CX_demo.xlsx"]
    for f in files:
        if f.exists():
            add(f, "--przyklad" in sys.argv)
        else:
            print(f"Pominięto {f.name}: brak pliku")
