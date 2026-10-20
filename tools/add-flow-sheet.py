# Dopisuje zakładkę "Przepływ" (Z, Do, Etykieta, Scenariusz, Opcjonalny) do macierz_CX.xlsx lub macierz_CX_demo.xlsx.
# Reszta pliku zostaje bez zmian (kopiowana bajt w bajt). Przed zapisem powstaje kopia plik.xlsx.bak; ponowne uruchomienie nic nie robi.
# Użycie: python3 tools/add-flow-sheet.py [plik.xlsx ...]  (bez argumentów: oba pliki z katalogu głównego repo)
#         python3 tools/add-flow-sheet.py --przyklad macierz_CX_demo.xlsx  (dodatkowo wypełnia zakładkę przykładowym przepływem DEMO)
import re, shutil, sys, zipfile
from pathlib import Path
from xml.sax.saxutils import escape

ROOT = Path(__file__).resolve().parent.parent
NAME = "Przepływ"
HEADER = ["Z (Touchpoint ID)", "Do (Touchpoint ID)", "Etykieta", "Scenariusz", "Opcjonalny (tak/nie)"]
WIDTHS = [20, 20, 34, 24, 20]
ROWS = 500  # zasięg list rozwijanych
CT = "application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"
REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet"


def cell(ref, value, style=""):
    return f'<c r="{ref}"{style} t="inlineStr"><is><t>{escape(value)}</t></is></c>'


def sheet_xml(header_style, edges):
    cols = "".join(f'<col min="{i + 1}" max="{i + 1}" width="{w}" customWidth="1"/>' for i, w in enumerate(WIDTHS))
    s = f' s="{header_style}"' if header_style else ""
    rows = ['<row r="1">' + "".join(cell("ABCDE"[i] + "1", h, s) for i, h in enumerate(HEADER)) + "</row>"]
    for n, edge in enumerate(edges, start=2):
        rows.append(f'<row r="{n}">' + "".join(cell("ABCDE"[i] + str(n), v) for i, v in enumerate(edge) if v) + "</row>")
    return (f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
            f'<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
            f'<cols>{cols}</cols><sheetData>{"".join(rows)}</sheetData>'
            f'<dataValidations count="2">'
            f'<dataValidation type="list" allowBlank="1" showErrorMessage="1" errorTitle="Nieznany punkt" error="Wybierz Touchpoint ID z zakładki Macierz CX." sqref="A2:B{ROWS}"><formula1>{{IDS}}</formula1></dataValidation>'
            f'<dataValidation type="list" allowBlank="1" showErrorMessage="1" sqref="E2:E{ROWS}"><formula1>"tak,nie"</formula1></dataValidation>'
            f'</dataValidations></worksheet>')


def macierz_ids(z, wb, rels):
    # Zwraca (zasięg komórek z Touchpoint ID, lista ID w kolejności wierszy) z pierwszej zakładki "Macierz CX".
    rid = re.search(r'<sheet [^>]*name="Macierz CX"[^>]*r:id="(rId\d+)"', wb).group(1)
    target = re.search(r'<Relationship [^>]*?(?:Target="([^"]+)"[^>]*Id="%s"|Id="%s"[^>]*Target="([^"]+)")' % (rid, rid), rels)
    part = (target.group(1) or target.group(2)).lstrip("/")
    part = part if part.startswith("xl/") else "xl/" + part
    xml = z.read(part).decode("utf-8")
    shared = re.findall(r"<si>(.*?)</si>", z.read("xl/sharedStrings.xml").decode("utf-8"), re.S) if "xl/sharedStrings.xml" in z.namelist() else []

    def value(c):
        inline = re.search(r"<t[^>]*>([^<]*)</t>", c)
        if 't="s"' in c:
            return "".join(re.findall(r"<t[^>]*>([^<]*)</t>", shared[int(re.search(r"<v>(\d+)</v>", c).group(1))]))
        return inline.group(1) if inline else (re.search(r"<v>([^<]*)</v>", c) or [None, ""])[1]

    rows = re.findall(r'<row [^>]*r="(\d+)"[^>]*>(.*?)</row>', xml, re.S)
    head = {value(c): re.search(r'r="([A-Z]+)', c).group(1) for c in re.findall(r"<c [^>]*?(?:/>|>.*?</c>)", rows[0][1], re.S)}
    col = head.get("Touchpoint ID")
    if not col:
        raise SystemExit("Zakładka 'Macierz CX': brak kolumny 'Touchpoint ID'")
    ids = []
    for _, body in rows[1:]:
        for c in re.findall(r"<c [^>]*?(?:/>|>.*?</c>)", body, re.S):
            if re.search(r'r="%s\d+"' % col, c) and value(c):
                ids.append(value(c))
    return col, ids


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
        if f'name="{NAME}"' in wb:
            print(f"{path.name}: zakładka '{NAME}' już istnieje, pominięto")
            return
        rels = z.read("xl/_rels/workbook.xml.rels").decode("utf-8")
        ct = z.read("[Content_Types].xml").decode("utf-8")
        col, ids = macierz_ids(z, wb, rels)
        n = max(int(m) for m in re.findall(r"xl/worksheets/sheet(\d+)\.xml", " ".join(z.namelist()))) + 1
        sheet_id = max(int(m) for m in re.findall(r'sheetId="(\d+)"', wb)) + 1
        rid = "rId%d" % (max(int(m) for m in re.findall(r'Id="rId(\d+)"', rels)) + 1)
        header_style = (re.search(r'<c r="A1" s="(\d+)"', z.read("xl/worksheets/sheet2.xml").decode("utf-8")) or [None, ""])[1]
        sheet = sheet_xml(header_style, example_edges(ids) if example else []).replace("{IDS}", f"'Macierz CX'!${col}$2:${col}${ROWS}")
        wb = wb.replace("</sheets>", f'<sheet name="{NAME}" sheetId="{sheet_id}" state="visible" r:id="{rid}"/></sheets>')
        rels = rels.replace("</Relationships>", f'<Relationship Type="{REL}" Target="/xl/worksheets/sheet{n}.xml" Id="{rid}"/></Relationships>')
        ct = ct.replace("</Types>", f'<Override PartName="/xl/worksheets/sheet{n}.xml" ContentType="{CT}"/></Types>')
        shutil.copy(path, str(path) + ".bak")
        tmp = path.with_suffix(".tmp")
        with zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as out:
            for item in z.infolist():
                data = z.read(item.filename)
                data = {"xl/workbook.xml": wb, "xl/_rels/workbook.xml.rels": rels, "[Content_Types].xml": ct}.get(item.filename, data)
                out.writestr(item, data.encode("utf-8") if isinstance(data, str) else data)
            out.writestr(f"xl/worksheets/sheet{n}.xml", sheet)
    tmp.replace(path)
    print(f"{path.name}: dodano zakładkę '{NAME}' (kopia: {path.name}.bak)")


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if a != "--przyklad"]
    files = [Path(a) for a in args] or [ROOT / "macierz_CX.xlsx", ROOT / "macierz_CX_demo.xlsx"]
    for f in files:
        if f.exists():
            add(f, "--przyklad" in sys.argv)
        else:
            print(f"Pominięto {f.name}: brak pliku")
