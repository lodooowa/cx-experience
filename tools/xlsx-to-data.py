# Źródłem danych jest macierz-demo.xlsx (edytuje ekspert CX). Skrypt czyta go i zapisuje macierz-demo/*.csv, data/matrix.js oraz data/flow.js.
# Tylko biblioteka standardowa Pythona 3 (xlsx to zip z XML). Użycie: python3 tools/xlsx-to-data.py [plik.xlsx]
import csv, json, math, sys, zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
RNS = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"
PKG = "{http://schemas.openxmlformats.org/package/2006/relationships}"

INT = {"emocja_1_5", "zaopiekowanie_1_5", "czas_wdrozenia_tyg", "lp"}
SHEETS = {
    "punkty_styku": ["macierz", "id", "punkt_styku", "proces", "emocja", "emocja_1_5", "wplyw_na_emocje", "monitoring", "wlasciciel", "ocena_cx", "status_danych", "podtyp", "zaopiekowanie_1_5", "tor_nadpisanie"],
    "cechy": ["id", "punkt_id", "typ", "tresc", "status_danych"],
    "akcje": ["id", "punkt_id", "rodzaj", "opis", "koszt", "ryzyko", "zysk", "czas_wdrozenia_tyg", "ryzyka_wdrozenia", "status_danych"],
    "slowniki": ["grupa", "klucz", "etykieta"],
    "procesy": ["lp", "nazwa"],
    "nastepne": ["punkt_id", "nastepny_id", "etykieta", "opcjonalny", "status_danych"],
    "przypadki": ["przypadek_id", "nazwa", "klient", "model_pojazdu", "numer_sprawy", "status_danych"],
    "kroki_przypadku": ["przypadek_id", "lp", "punkt_id", "stan", "co_sie_stalo", "status_danych"],
}
CSV_SHEETS = list(SHEETS)
FLOW_GROUPS = ["tor", "stan"]
LEVELS = ["niski", "średni", "wysoki"]
LABEL_GROUPS = ["matrix", "subtype", "rating", "monitoring", "featureType", "actionKind"]


class DataError(Exception):
    pass


def col_index(ref):
    n = 0
    for ch in ref:
        if not ch.isalpha():
            break
        n = n * 26 + ord(ch.upper()) - 64
    return n - 1


def text_of(si):
    # Zwykły <t> albo rich text <r><t>; podpowiedzi fonetyczne <rPh> pomijamy.
    parts = []
    for child in si:
        if child.tag == NS + "t":
            parts.append(child.text or "")
        elif child.tag == NS + "r":
            parts.extend(t.text or "" for t in child.findall(NS + "t"))
    return "".join(parts)


def read_xlsx(path):
    """Zwraca {nazwa_arkusza: [(numer_wiersza, komórki), ...]}, komórki = lista tekstów (puste = ''). Numer wiersza jak w Excelu."""
    try:
        z = zipfile.ZipFile(path)
    except (OSError, zipfile.BadZipFile) as error:
        raise DataError(f"Nie można odczytać pliku '{path}' ({error}). Czy to xlsx i czy nie jest zablokowany przez inny program?")
    with z:
        names = set(z.namelist())
        shared = []
        if "xl/sharedStrings.xml" in names:
            for si in ET.fromstring(z.read("xl/sharedStrings.xml")).iter(NS + "si"):
                shared.append(text_of(si))
        rels = {r.get("Id"): r.get("Target") for r in ET.fromstring(z.read("xl/_rels/workbook.xml.rels")).iter(PKG + "Relationship")}
        out = {}
        for sheet in ET.fromstring(z.read("xl/workbook.xml")).iter(NS + "sheet"):
            target = rels[sheet.get(RNS + "id")]
            member = target.lstrip("/") if target.startswith("/") else "xl/" + target
            rows = []
            for pos, row in enumerate(ET.fromstring(z.read(member)).iter(NS + "row"), 1):
                cells = {}
                for c in row.iter(NS + "c"):
                    kind = c.get("t")
                    v = c.find(NS + "v")
                    if kind == "s":
                        val = shared[int(v.text)] if v is not None and v.text else ""
                    elif kind == "inlineStr":
                        is_ = c.find(NS + "is")
                        val = text_of(is_) if is_ is not None else ""
                    elif kind == "b":
                        val = "TRUE" if v is not None and v.text == "1" else "FALSE"
                    else:
                        val = v.text if v is not None and v.text is not None else ""
                    cells[col_index(c.get("r"))] = val.strip()
                if cells:
                    width = max(cells) + 1
                    rows.append((int(row.get("r") or pos), [cells.get(i, "") for i in range(width)]))
            out[sheet.get("name")] = rows
    return out


def num(sheet, row_no, col, value):
    if value == "":
        return None
    try:
        f = float(value)
    except ValueError:
        f = math.nan
    if not math.isfinite(f) or f != int(f):
        raise DataError(f"Arkusz '{sheet}', wiersz {row_no}, kolumna '{col}': oczekiwano liczby całkowitej, jest '{value}'")
    return int(f)


def table(book, name):
    if name not in book:
        raise DataError(f"Brak arkusza '{name}' w pliku (to może być xlsx ze starszej wersji: zob. macierz.md)")
    rows = book[name]
    want = SHEETS[name]
    head = rows[0][1] if rows else []
    for col in want:
        if col not in head:
            raise DataError(f"Arkusz '{name}': brak kolumny '{col}'")
    idx = {col: head.index(col) for col in want}
    out = []
    for n, row in rows[1:]:
        rec = {col: (row[i] if i < len(row) else "") for col, i in idx.items()}
        if not any(rec.values()):
            continue
        for col in INT & set(want):
            rec[col] = num(name, n, col, rec[col])
        rec["_row"] = n
        out.append(rec)
    return out


def convert(xlsx, csv_dir, js_path):
    book = read_xlsx(xlsx)
    t = {name: table(book, name) for name in SHEETS}
    for name in ("punkty_styku", "cechy", "akcje"):
        seen = set()
        for r in t[name]:
            if not r["id"]:
                raise DataError(f"Arkusz '{name}', wiersz {r['_row']}: brak id")
            if r["id"] in seen:
                raise DataError(f"Arkusz '{name}', wiersz {r['_row']}: powtórzone id '{r['id']}'")
            seen.add(r["id"])
    ids = {r["id"] for r in t["punkty_styku"]}
    for name in ("cechy", "akcje"):
        for r in t[name]:
            if r["punkt_id"] not in ids:
                raise DataError(f"Arkusz '{name}', wiersz {r['_row']}: punkt_id '{r['punkt_id']}' nie istnieje w 'punkty_styku'")
    for r in t["procesy"]:
        if r["lp"] is None or not r["nazwa"]:
            raise DataError(f"Arkusz 'procesy', wiersz {r['_row']}: wymagane lp i nazwa")
    processes = [r["nazwa"] for r in sorted(t["procesy"], key=lambda r: r["lp"])]
    for r in t["punkty_styku"]:
        if r["proces"] not in processes:
            raise DataError(f"Arkusz 'punkty_styku', wiersz {r['_row']}: proces '{r['proces']}' nie istnieje w 'procesy'")
    statuses = {r["status_danych"] for r in t["punkty_styku"]}
    if len(statuses) != 1:
        raise DataError(f"Arkusz 'punkty_styku': kolumna status_danych musi mieć jedną wartość, jest {sorted(statuses)}")
    labels = {g: {} for g in LABEL_GROUPS + FLOW_GROUPS}
    for r in t["slowniki"]:
        if r["grupa"] not in labels:
            raise DataError(f"Arkusz 'slowniki', wiersz {r['_row']}: nieznana grupa '{r['grupa']}'")
        labels[r["grupa"]][r["klucz"]] = r["etykieta"]
    lane_labels, state_labels = labels.pop("tor"), labels.pop("stan")

    def known(sheet, r, col, group, value):
        if value not in labels[group]:
            raise DataError(f"Arkusz '{sheet}', wiersz {r['_row']}: {col} '{value}' nie istnieje w 'slowniki' (grupa '{group}')")

    def scale(sheet, r, col):
        if r[col] is not None and not 1 <= r[col] <= 5:
            raise DataError(f"Arkusz '{sheet}', wiersz {r['_row']}: {col} musi być liczbą 1-5 lub puste, jest {r[col]}")

    for r in t["punkty_styku"]:
        known("punkty_styku", r, "macierz", "matrix", r["macierz"])
        known("punkty_styku", r, "ocena_cx", "rating", r["ocena_cx"])
        known("punkty_styku", r, "monitoring", "monitoring", r["monitoring"])
        if r["podtyp"]:
            known("punkty_styku", r, "podtyp", "subtype", r["podtyp"])
        scale("punkty_styku", r, "emocja_1_5")
        scale("punkty_styku", r, "zaopiekowanie_1_5")
        if r["tor_nadpisanie"] and r["tor_nadpisanie"] not in lane_labels:
            raise DataError(f"Arkusz 'punkty_styku', wiersz {r['_row']}: tor_nadpisanie '{r['tor_nadpisanie']}' nie ma etykiety w 'slowniki' (grupa 'tor')")
    for r in t["cechy"]:
        known("cechy", r, "typ", "featureType", r["typ"])
    for r in t["akcje"]:
        known("akcje", r, "rodzaj", "actionKind", r["rodzaj"])
        if r["czas_wdrozenia_tyg"] is None or r["czas_wdrozenia_tyg"] < 0:
            raise DataError(f"Arkusz 'akcje', wiersz {r['_row']}: czas_wdrozenia_tyg musi być liczbą tygodni >= 0")
        for col in ("koszt", "ryzyko", "zysk"):
            if r[col] not in LEVELS:
                raise DataError(f"Arkusz 'akcje', wiersz {r['_row']}: {col} musi być jednym z: {', '.join(LEVELS)}, jest '{r[col]}'")

    edge_seen = set()
    for r in t["nastepne"]:
        for col in ("punkt_id", "nastepny_id"):
            if r[col] not in ids:
                raise DataError(f"Arkusz 'nastepne', wiersz {r['_row']}: {col} '{r[col]}' nie istnieje w 'punkty_styku'")
        if r["punkt_id"] == r["nastepny_id"]:
            raise DataError(f"Arkusz 'nastepne', wiersz {r['_row']}: punkt '{r['punkt_id']}' nie może być swoim następnikiem")
        if (r["punkt_id"], r["nastepny_id"]) in edge_seen:
            raise DataError(f"Arkusz 'nastepne', wiersz {r['_row']}: powtórzona krawędź {r['punkt_id']} → {r['nastepny_id']}")
        edge_seen.add((r["punkt_id"], r["nastepny_id"]))
        if r["opcjonalny"] not in ("", "tak", "nie"):
            raise DataError(f"Arkusz 'nastepne', wiersz {r['_row']}: opcjonalny musi być 'tak', 'nie' lub puste, jest '{r['opcjonalny']}'")
    case_ids = set()
    for r in t["przypadki"]:
        if not r["nazwa"]:
            raise DataError(f"Arkusz 'przypadki', wiersz {r['_row']}: brak nazwy przypadku '{r['przypadek_id']}'")
        if not r["przypadek_id"] or r["przypadek_id"] in case_ids:
            raise DataError(f"Arkusz 'przypadki', wiersz {r['_row']}: brak lub powtórzone przypadek_id '{r['przypadek_id']}'")
        case_ids.add(r["przypadek_id"])
    step_seen = set()
    for r in t["kroki_przypadku"]:
        if r["lp"] is None:
            raise DataError(f"Arkusz 'kroki_przypadku', wiersz {r['_row']}: brak lp")
        if (r["przypadek_id"], r["lp"]) in step_seen:
            raise DataError(f"Arkusz 'kroki_przypadku', wiersz {r['_row']}: powtórzone lp {r['lp']} w przypadku '{r['przypadek_id']}'")
        step_seen.add((r["przypadek_id"], r["lp"]))
        if r["przypadek_id"] not in case_ids:
            raise DataError(f"Arkusz 'kroki_przypadku', wiersz {r['_row']}: przypadek_id '{r['przypadek_id']}' nie istnieje w 'przypadki'")
        if r["punkt_id"] not in ids:
            raise DataError(f"Arkusz 'kroki_przypadku', wiersz {r['_row']}: punkt_id '{r['punkt_id']}' nie istnieje w 'punkty_styku'")
        if r["stan"] not in state_labels:
            raise DataError(f"Arkusz 'kroki_przypadku', wiersz {r['_row']}: stan '{r['stan']}' nie istnieje w 'slowniki' (grupa 'stan')")
    for r in t["przypadki"]:
        if not any(k["przypadek_id"] == r["przypadek_id"] for k in t["kroki_przypadku"]):
            raise DataError(f"Arkusz 'przypadki', wiersz {r['_row']}: przypadek '{r['przypadek_id']}' nie ma kroków w 'kroki_przypadku'")

    csv_dir.mkdir(exist_ok=True)
    for name in CSV_SHEETS:
        with open(csv_dir / f"{name}.csv", "w", newline="", encoding="utf-8-sig") as fh:
            w = csv.writer(fh, delimiter=";")
            w.writerow(SHEETS[name])
            for r in t[name]:
                w.writerow(["" if r[c] is None else r[c] for c in SHEETS[name]])

    tp = []
    for r in t["punkty_styku"]:
        item = dict(id=r["id"], matrix=r["macierz"], title=r["punkt_styku"], process=r["proces"], emotion=r["emocja"], emotionValue=r["emocja_1_5"],
                    emotionImpact=r["wplyw_na_emocje"], monitoring=r["monitoring"], owner=r["wlasciciel"], rating=r["ocena_cx"], care=r["zaopiekowanie_1_5"])
        if r["podtyp"]:
            item["subtype"] = r["podtyp"]
        if r["tor_nadpisanie"]:
            item["lane"] = r["tor_nadpisanie"]
        tp.append(item)
    ft = [dict(id=c["id"], touchpointId=c["punkt_id"], type=c["typ"], text=c["tresc"]) for c in t["cechy"]]
    ac = [dict(id=a["id"], touchpointId=a["punkt_id"], kind=a["rodzaj"], text=a["opis"], cost=a["koszt"], risk=a["ryzyko"], gain=a["zysk"],
               weeks=a["czas_wdrozenia_tyg"], implementationRisks=a["ryzyka_wdrozenia"]) for a in t["akcje"]]

    def lines(items):
        return "[\n" + ",\n".join("    " + json.dumps(i, ensure_ascii=False) for i in items) + "\n  ]"

    hdr = ("// DANE wygenerowane przez tools/xlsx-to-data.py z macierz-demo.xlsx. NIE EDYTUJ RĘCZNIE:\n"
           "// źródłem jest xlsx (po zmianach uruchom skrypt ponownie; nadpisuje CSV i ten plik). Zostaw window.CX_MATRIX = oraz końcowy średnik.\n")
    body = ("window.CX_MATRIX = {\n  \"status\": " + json.dumps(statuses.pop(), ensure_ascii=False) + ",\n  \"labels\": " + json.dumps(labels, ensure_ascii=False)
            + ",\n  \"processes\": " + json.dumps(processes, ensure_ascii=False) + ",\n  \"touchpoints\": " + lines(tp)
            + ",\n  \"features\": " + lines(ft) + ",\n  \"actions\": " + lines(ac) + "\n};\n")
    with open(js_path, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(hdr + body)

    edges = []
    for r in t["nastepne"]:
        edge = dict({"from": r["punkt_id"], "to": r["nastepny_id"]}, optional=r["opcjonalny"] == "tak")
        if r["etykieta"]:
            edge["label"] = r["etykieta"]
        edges.append(edge)
    cases = []
    for c in t["przypadki"]:
        case = dict(id=c["przypadek_id"], name=c["nazwa"])
        for key, col in (("client", "klient"), ("vehicle", "model_pojazdu"), ("caseNumber", "numer_sprawy")):
            if c[col]:
                case[key] = c[col]
        steps = sorted((k for k in t["kroki_przypadku"] if k["przypadek_id"] == c["przypadek_id"]), key=lambda k: k["lp"])
        case["steps"] = []
        for k in steps:
            step = dict(n=k["lp"], touchpointId=k["punkt_id"], state=k["stan"])
            if k["co_sie_stalo"]:
                step["note"] = k["co_sie_stalo"]
            case["steps"].append(step)
        cases.append(case)
    flow_status = {r["status_danych"] for name in ("nastepne", "przypadki", "kroki_przypadku") for r in t[name]} | {r["status_danych"] for r in t["punkty_styku"]}
    fhdr = ("// DANE wygenerowane przez tools/xlsx-to-data.py z macierz-demo.xlsx (arkusze nastepne, przypadki, kroki_przypadku, slowniki). NIE EDYTUJ RĘCZNIE.\n"
            "// Zostaw window.CX_FLOW = oraz końcowy średnik.\n")
    fbody = ("window.CX_FLOW = {\n  \"status\": " + json.dumps("DEMO" if flow_status == {"DEMO"} else "/".join(sorted(flow_status)), ensure_ascii=False)
             + ",\n  \"labels\": " + json.dumps({"lane": lane_labels, "state": state_labels}, ensure_ascii=False)
             + ",\n  \"edges\": " + lines(edges) + ",\n  \"cases\": " + lines(cases) + "\n};\n")
    with open(js_path.parent / "flow.js", "w", encoding="utf-8", newline="\n") as fh:
        fh.write(fhdr + fbody)
    return len(tp), len(ft), len(ac), len(edges), len(cases)


if __name__ == "__main__":
    xlsx = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "macierz-demo.xlsx"
    try:
        print("Gotowe. punkty, cechy, akcje, krawędzie, przypadki:", *convert(xlsx, ROOT / "macierz-demo", ROOT / "data" / "matrix.js"))
    except DataError as error:
        sys.exit(f"BŁĄD DANYCH: {error}")
