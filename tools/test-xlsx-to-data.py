# Test konwertera xlsx -> dane. Uruchom: python3 tools/test-xlsx-to-data.py (bez zależności, kończy się kodem != 0 przy błędzie).
import importlib.util, json, re, tempfile, zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location("x2d", ROOT / "tools" / "xlsx-to-data.py")
x2d = importlib.util.module_from_spec(spec)
spec.loader.exec_module(x2d)

MAIN = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"'
REL = 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"'


def letter(i):
    return chr(65 + i)


def build_shared(path, sheets):
    """Skoroszyt w stylu Excela: sharedStrings, rich text, brak pustych komórek, bezwzględne i względne targety, odwrócona kolejność plików."""
    shared = []

    def sid(text):
        shared.append(text)
        return len(shared) - 1

    members = {}
    names = list(sheets)
    for n, name in enumerate(names):
        rows_xml = ""
        for r, row in enumerate(sheets[name], 1):
            cells = ""
            for c, v in enumerate(row):
                ref = f"{letter(c)}{r}"
                if v is None:
                    continue
                if isinstance(v, (int, float)):
                    cells += f'<c r="{ref}"><v>{v}</v></c>'
                elif isinstance(v, bool):
                    cells += f'<c r="{ref}" t="b"><v>{int(v)}</v></c>'
                else:
                    cells += f'<c r="{ref}" t="s"><v>{sid(v)}</v></c>'
            rows_xml += f'<row r="{r}">{cells}</row>'
        members[f"xl/worksheets/sheet{len(names) - n}.xml"] = f'<worksheet {MAIN}><sheetData>{rows_xml}</sheetData></worksheet>'
    si = "".join(
        f'<si><r><t xml:space="preserve">{s[:2]}</t></r><r><t>{s[2:]}</t></r><rPh sb="0" eb="1"><t>XX</t></rPh></si>' if len(s) > 3 else f"<si><t>{s}</t></si>"
        for s in shared
    )
    sheet_tags = "".join(f'<sheet name="{name}" sheetId="{n + 1}" r:id="rId{n + 1}"/>' for n, name in enumerate(names))
    rel_tags = "".join(
        f'<Relationship Id="rId{n + 1}" Type="x" Target="{"/xl/" if n % 2 else ""}worksheets/sheet{len(names) - n}.xml"/>' for n in range(len(names))
    )
    with zipfile.ZipFile(path, "w") as z:
        z.writestr("xl/workbook.xml", f"<workbook {MAIN} {REL}><sheets>{sheet_tags}</sheets></workbook>")
        z.writestr("xl/_rels/workbook.xml.rels", f'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">{rel_tags}</Relationships>')
        z.writestr("xl/sharedStrings.xml", f"<sst {MAIN}>{si}</sst>")
        for k, v in members.items():
            z.writestr(k, v)


def sample():
    h = x2d.SHEETS
    return {
        "punkty_styku": [h["punkty_styku"],
                         ["importer", "imp-01", "Reklama", "Pozyskanie", "Ciekawość", "4.0", "Wpływ", "tak", "Marketing", "ok", "DEMO", None, "5"],
                         ["dealer", "dea-01", "Telefon", "Zapytanie", None, None, None, "nie", "Dealer", "brak_oceny", "DEMO", "salon", None]],
        "cechy": [h["cechy"], ["ch-001", "imp-01", "blad_typowy", "Zażółć gęślą jaźń", "DEMO"]],
        "akcje": [h["akcje"], ["ak-001", "imp-01", "quick_win", "Opis", "niski", "niski", "wysoki", 4, None, "DEMO"]],
        "slowniki": [h["slowniki"], ["matrix", "importer", "Importer"], ["matrix", "dealer", "Dealer"], ["subtype", "salon", "Salon"],
                     ["rating", "ok", "W porządku"], ["rating", "brak_oceny", "Brak oceny"], ["monitoring", "tak", "Tak"], ["monitoring", "nie", "Nie"],
                     ["featureType", "blad_typowy", "Błędy typowe"], ["actionKind", "quick_win", "Quick win"],
                     ["stan", "zadzialal", "Zadziałał"], ["stan", "brakuje", "Brakuje"], ["tor", "nowy", "Nowy tor"]],
        "procesy": [h["procesy"], [2, "Zapytanie"], [1, "Pozyskanie"]],
        "nastepne": [h["nastepne"], ["imp-01", "dea-01", "etykieta", "tak", "DEMO"], ["dea-01", "imp-01", None, None, "DEMO"]],
        "przypadki": [h["przypadki"], ["P-1", "Przypadek", None, "Model", None, "DEMO"]],
        "kroki_przypadku": [h["kroki_przypadku"], ["P-1", 2, "dea-01", "brakuje", None, "DEMO"], ["P-1", 1, "imp-01", "zadzialal", "Co się stało", "DEMO"]],
    }


def convert(book_path):
    with tempfile.TemporaryDirectory() as d:
        d = Path(d)
        n = x2d.convert(book_path, d / "csv", d / "matrix.js")
        text = (d / "matrix.js").read_text(encoding="utf-8")
        data = json.loads(re.search(r"^window\.CX_MATRIX = (.*);\n$", text, re.S | re.M).group(1))
        return n, data, (d / "csv" / "punkty_styku.csv").read_bytes()


def convert_flow():
    with tempfile.TemporaryDirectory() as d:
        d = Path(d)
        path = d / "b.xlsx"
        build_shared(path, sample())
        x2d.convert(path, d / "csv", d / "matrix.js")
        text = (d / "flow.js").read_text(encoding="utf-8")
        return json.loads(re.search(r"^window\.CX_FLOW = (.*);\n$", text, re.S | re.M).group(1))


def expect_error(book, fragment):
    with tempfile.TemporaryDirectory() as d:
        path = Path(d) / "b.xlsx"
        build_shared(path, book)
        try:
            convert(path)
        except x2d.DataError as e:
            assert fragment in str(e), (fragment, str(e))
            return
        raise AssertionError("brak błędu: " + fragment)


def main():
    with tempfile.TemporaryDirectory() as d:
        path = Path(d) / "b.xlsx"
        build_shared(path, sample())
        raw = x2d.read_xlsx(path)
        assert list(raw) == list(sample()), list(raw)
        n, data, csv_bytes = convert(path)
    assert n == (2, 1, 1, 2, 1), n
    a, b = data["touchpoints"]
    assert a["emotionValue"] == 4 and a["care"] == 5 and "subtype" not in a, a
    assert b["emotionValue"] is None and b["care"] is None and b["subtype"] == "salon" and b["emotion"] == "", b
    assert data["processes"] == ["Pozyskanie", "Zapytanie"], data["processes"]
    assert data["features"][0]["text"] == "Zażółć gęślą jaźń", data["features"][0]
    assert data["actions"][0]["weeks"] == 4 and data["actions"][0]["implementationRisks"] == ""
    assert data["labels"]["subtype"] == {"salon": "Salon"} and data["labels"]["actionKind"] == {"quick_win": "Quick win"} and data["status"] == "DEMO"
    assert data["touchpoints"][1]["id"] == "dea-01" and "lane" not in a
    flow = convert_flow()
    assert flow["edges"] == [{"from": "imp-01", "to": "dea-01", "optional": True, "label": "etykieta"}, {"from": "dea-01", "to": "imp-01", "optional": False}], flow["edges"]
    case = flow["cases"][0]
    assert case == {"id": "P-1", "name": "Przypadek", "vehicle": "Model", "steps": [
        {"n": 1, "touchpointId": "imp-01", "state": "zadzialal", "note": "Co się stało"}, {"n": 2, "touchpointId": "dea-01", "state": "brakuje"}]}, case
    assert flow["labels"]["lane"] == {"nowy": "Nowy tor"} and flow["labels"]["state"]["brakuje"] == "Brakuje"
    assert csv_bytes.startswith(b"\xef\xbb\xbf"), "CSV bez BOM"

    bad = sample(); bad["punkty_styku"][1][5] = "4.5"
    expect_error(bad, "'punkty_styku', wiersz 2, kolumna 'emocja_1_5'")
    bad = sample(); bad["cechy"].append(["ch-001", "imp-01", "blad_typowy", "x", "DEMO"])
    expect_error(bad, "powtórzone id 'ch-001'")
    bad = sample(); bad["akcje"][1][1] = "xxx-99"
    expect_error(bad, "punkt_id 'xxx-99'")
    bad = sample(); bad["punkty_styku"][1][3] = "Nieznany"
    expect_error(bad, "proces 'Nieznany'")
    bad = sample(); del bad["slowniki"]
    expect_error(bad, "Brak arkusza 'slowniki'")
    bad = sample(); bad["punkty_styku"][1][0] = "Importerr"
    expect_error(bad, "'punkty_styku', wiersz 2: macierz 'Importerr' nie istnieje w 'slowniki'")
    bad = sample(); bad["cechy"][1][2] = "zly_typ"
    expect_error(bad, "typ 'zly_typ'")
    bad = sample(); bad["punkty_styku"][1][12] = 9
    expect_error(bad, "zaopiekowanie_1_5 musi być liczbą 1-5")
    bad = sample(); bad["akcje"][1][7] = None
    expect_error(bad, "czas_wdrozenia_tyg musi być")
    bad = sample(); bad["akcje"][1][4] = "drogi"
    expect_error(bad, "koszt musi być jednym z")
    bad = sample(); bad["procesy"][1][0] = None
    expect_error(bad, "'procesy', wiersz 2: wymagane lp i nazwa")
    bad = sample(); bad["punkty_styku"][1][5] = "nan"
    expect_error(bad, "'punkty_styku', wiersz 2, kolumna 'emocja_1_5'")
    bad = sample(); bad["nastepne"][1][1] = "xx-9"
    expect_error(bad, "'nastepne', wiersz 2: nastepny_id 'xx-9'")
    bad = sample(); bad["nastepne"][1][1] = bad["nastepne"][1][0]
    expect_error(bad, "nie może być swoim następnikiem")
    bad = sample(); bad["nastepne"].append(list(bad["nastepne"][1]))
    expect_error(bad, "'nastepne', wiersz 4: powtórzona krawędź")
    bad = sample(); bad["kroki_przypadku"][2][1] = 2
    expect_error(bad, "powtórzone lp 2 w przypadku 'P-1'")
    bad = sample(); bad["przypadki"][1][1] = None
    expect_error(bad, "'przypadki', wiersz 2: brak nazwy")
    bad = sample(); bad["nastepne"][1][3] = "może"
    expect_error(bad, "opcjonalny musi być")
    bad = sample(); bad["kroki_przypadku"][1][3] = "zly"
    expect_error(bad, "stan 'zly' nie istnieje")
    bad = sample(); bad["kroki_przypadku"][1][0] = "P-9"
    expect_error(bad, "przypadek_id 'P-9' nie istnieje")
    bad = sample(); bad["kroki_przypadku"][1:] = []
    expect_error(bad, "przypadek 'P-1' nie ma kroków")
    bad = sample(); bad["kroki_przypadku"][1][1] = None; bad["kroki_przypadku"][2][1] = None
    expect_error(bad, "'kroki_przypadku', wiersz 2: brak lp")
    bad = sample(); bad["punkty_styku"][1].append("nieznany_tor")
    bad["punkty_styku"][1][11] = None
    bad["punkty_styku"][1][12] = "5"
    expect_error(bad, "tor_nadpisanie 'nieznany_tor' nie ma etykiety")
    bad = sample(); bad["punkty_styku"][1:1] = [[], [], []]; bad["punkty_styku"][4][1] = ""
    expect_error(bad, "'punkty_styku', wiersz 5: brak id")

    # Plik z repo (inlineStr z openpyxl) odtwarza dokładnie to, co jest w repo.
    n, data, csv_bytes = convert(ROOT / "macierz-demo.xlsx")
    with tempfile.TemporaryDirectory() as d:
        d = Path(d)
        x2d.convert(ROOT / "macierz-demo.xlsx", d / "csv", d / "matrix.js")
        for name in x2d.CSV_SHEETS:
            assert (d / "csv" / f"{name}.csv").read_bytes() == (ROOT / "data" / "macierz-demo" / f"{name}.csv").read_bytes(), f"{name}.csv z repo różni się od wygenerowanego"
        assert (d / "flow.js").read_bytes() == (ROOT / "data" / "flow.js").read_bytes(), "data/flow.js z repo różni się od wygenerowanego"
    body = (ROOT / "data" / "matrix.js").read_text(encoding="utf-8")
    assert data == json.loads(re.search(r"^window\.CX_MATRIX = (.*);\n$", body, re.S | re.M).group(1)), "data/matrix.js z repo różni się od wygenerowanego"
    cj = importlib.util.module_from_spec(importlib.util.spec_from_file_location("cj2d", ROOT / "tools" / "cj-xlsx-to-data.py"))
    cj.__spec__.loader.exec_module(cj)
    book = {"Arkusz": [(1, ["Grupa nagłówków", ""]), (2, ["pain_point-id", "  Root CAUSE  ", "Poziom emocji (-5 do +5)", "Dominująca emocja"]), (3, ["PP01", "RC01", "-2", "Zła"])]}
    rec = cj.table(book, "Arkusz", ["Pain Point ID", "Root Cause", "Poziom emocji (-5 do +5)", "Dominujaca emocja"])
    assert rec[0]["Pain Point ID"] == "PP01" and rec[0]["Dominujaca emocja"] == "Zła", "tolerancyjne nazwy kolumn (wielkość liter, polskie znaki, podkreślenia)"
    print("OK: czytnik (sharedStrings + inlineStr), konwersja, błędy z arkuszem i wierszem, zgodność z plikami w repo")


main()
