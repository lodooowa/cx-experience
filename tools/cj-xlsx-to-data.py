# Źródłem danych widoku Customer Journey są dwa pliki: macierz_CX.xlsx (produkcyjny, edytuje go ekspert, poza repozytorium) → data/cj.js (window.CX_CJ)
# oraz macierz_CX_demo.xlsx (przykładowy, w repozytorium) → data/cj-demo.js (window.CX_CJ_DEMO). Brak pliku produkcyjnego nie jest błędem.
# Tylko biblioteka standardowa Pythona 3. Użycie: python3 tools/cj-xlsx-to-data.py [plik.xlsx]; z argumentem plik z "demo" w nazwie trafia do cj-demo.js.
# Błędy referencji przerywają konwersję (BŁĄD DANYCH); niejednoznaczne wartości trafiają do "warnings" i są widoczne na stronie.
import importlib.util, json, math, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
_spec = importlib.util.spec_from_file_location("xlsx_to_data", Path(__file__).with_name("xlsx-to-data.py"))
x2d = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(x2d)
DataError = x2d.DataError

MATRIX = {
    "step": "Nr kroku CJ", "stepName": "Krok Customer Journey", "stage": "Segment / Etap podróży", "id": "Touchpoint ID", "title": "Punkt styku",
    "channel": "Kanał", "owner": "Właściciel biznesowy", "coOwner": "Współwłaściciel", "problem": "Zidentyfikowane Problemy",
    "painPoint": "Pain Point ID", "rootCause": "Dominating Root Cause ID", "recommendation": "Rekomendowany kierunek zmian",
    "quickWin": "Quick Win", "midTerm": "Mid Term", "longTerm": "Long term", "emotion": "Dominująca emocja", "emotionValue": "Poziom emocji (-5 do +5)",
    "justification": "Uzasadnienie z danych",
}
SHEETS = {
    "Macierz CX": list(MATRIX.values()),
    "Pain pointy strategiczne": ["Pain Point ID", "Pain Point", "Opis"],
    "Root Causes": ["Root Cause ID", "Root Cause", "Opis"],
    "Inicjatywy": ["Initiative ID", "Pain Point ID", "Root Cause ID", "Typ", "Inicjatywa"],
    "Mapowanie_PP_RC": ["Pain Point ID", "Root Cause ID"],
    "Mapowanie_RC_IN": ["Root Cause ID", "Initiative ID"],
    "Dane": ["Kolejność", "Nr", "Krok / opis", "Segment / etap", "Grupa", "Kolor HEX"],
}
# Prognoza to opcjonalne kolumny zakładki "Macierz CX" (obok poziomu emocji); brak kolumn lub pusta komórka = brak prognozy.
FORECAST = ["Po Quick Wins", "Po Mid Term", "Po Long Term"]


def table(book, name, columns, required=True, optional=()):
    if name not in book:
        if required:
            raise DataError(f"Brak zakładki '{name}' w pliku")
        return []
    rows = book[name]
    # Wiersz nagłówków to pierwszy wiersz zawierający wszystkie wymagane kolumny: nad nim mogą być dodatkowe wiersze (np. scalone nagłówki grup).
    # Nazwy porównujemy bez różnic w wielkości liter i spacjach na brzegach.
    norm = lambda v: " ".join(v.split()).casefold()
    start = next((k for k, (_, r) in enumerate(rows) if {norm(c) for c in columns} <= {norm(v) for v in r}), None)
    if start is None:
        head = {norm(v) for _, r in rows for v in r}
        raise DataError(f"Zakładka '{name}': brak kolumny '{next((c for c in columns if norm(c) not in head), columns[0])}'")
    head = [norm(v) for v in rows[start][1]]
    idx = {col: head.index(norm(col)) for col in columns}
    idx.update({col: head.index(norm(col)) for col in optional if norm(col) in head})
    out = []
    for n, row in rows[start + 1:]:
        rec = {col: (row[i].strip() if i < len(row) else "") for col, i in idx.items()}
        if any(rec.values()):
            rec["_row"] = n
            out.append(rec)
    return out


def text(value):
    return "" if value in ("", "brak danych") else value


def number(value, where, warnings):
    """Liczba -5..5 (także ułamek) albo None. Niejednoznaczny lub spoza zakresu tekst: ostrzeżenie, bez zgadywania."""
    if value == "":
        return None
    try:
        f = float(value.replace(",", "."))
        if math.isfinite(f) and -5 <= f <= 5:
            return int(f) if f == int(f) else f
        warnings.append(f"{where}: wartość '{value}' poza zakresem -5..+5, pominięta")
    except ValueError:
        warnings.append(f"{where}: wartość '{value}' nie jest liczbą, pominięta")
    return None


def convert(xlsx, js_path, var="CX_CJ"):
    book = x2d.read_xlsx(xlsx)
    t = {name: table(book, name, cols, optional=FORECAST if name == "Macierz CX" else ()) for name, cols in SHEETS.items()}
    warnings = []

    def unique(rows, col, name):
        seen = set()
        for r in rows:
            if not r[col] or r[col] in seen:
                raise DataError(f"Zakładka '{name}', wiersz {r['_row']}: brak lub powtórzone '{col}' ('{r[col]}')")
            seen.add(r[col])
        return seen

    pp_ids = unique(t["Pain pointy strategiczne"], "Pain Point ID", "Pain pointy strategiczne")
    rc_ids = unique(t["Root Causes"], "Root Cause ID", "Root Causes")
    in_ids = unique(t["Inicjatywy"], "Initiative ID", "Inicjatywy")
    tp_ids = unique(t["Macierz CX"], "Touchpoint ID", "Macierz CX")
    steps = {}
    for r in sorted(t["Dane"], key=lambda r: float(r["Kolejność"] or 0)):
        if not r["Nr"] or r["Nr"] in steps:
            raise DataError(f"Zakładka 'Dane', wiersz {r['_row']}: brak lub powtórzony 'Nr' ('{r['Nr']}')")
        steps[r["Nr"]] = dict(nr=r["Nr"], name=r["Krok / opis"], stage=r["Segment / etap"], group=r["Grupa"], color=r["Kolor HEX"])

    def known(rows, sheet, col, ids):
        for r in rows:
            if r[col] and r[col] not in ids:
                raise DataError(f"Zakładka '{sheet}', wiersz {r['_row']}: {col} '{r[col]}' nie istnieje")

    known(t["Macierz CX"], "Macierz CX", "Pain Point ID", pp_ids)
    known(t["Macierz CX"], "Macierz CX", "Dominating Root Cause ID", rc_ids)
    known(t["Inicjatywy"], "Inicjatywy", "Pain Point ID", pp_ids)
    known(t["Inicjatywy"], "Inicjatywy", "Root Cause ID", rc_ids)
    known(t["Mapowanie_PP_RC"], "Mapowanie_PP_RC", "Pain Point ID", pp_ids)
    known(t["Mapowanie_PP_RC"], "Mapowanie_PP_RC", "Root Cause ID", rc_ids)
    known(t["Mapowanie_RC_IN"], "Mapowanie_RC_IN", "Root Cause ID", rc_ids)
    known(t["Mapowanie_RC_IN"], "Mapowanie_RC_IN", "Initiative ID", in_ids)
    pairs = {(r["Pain Point ID"], r["Root Cause ID"]) for r in t["Mapowanie_PP_RC"]}

    fc = {}
    for r in t["Macierz CX"]:
        if not any(r.get(c) for c in FORECAST[:3]):
            continue
        where = "Prognoza " + r["Touchpoint ID"]
        fc[r["Touchpoint ID"]] = dict(qw=number(r["Po Quick Wins"], where + " (Quick Wins)", warnings), mid=number(r["Po Mid Term"], where + " (Mid Term)", warnings),
                                      long=number(r["Po Long Term"], where + " (Long Term)", warnings))

    tps, no_title = [], []
    for r in t["Macierz CX"]:
        step = steps.get(r["Nr kroku CJ"])
        if not step:
            raise DataError(f"Zakładka 'Macierz CX', wiersz {r['_row']}: Nr kroku CJ '{r['Nr kroku CJ']}' nie istnieje w zakładce 'Dane'")
        if r["Segment / Etap podróży"] != step["stage"]:
            warnings.append(f"{r['Touchpoint ID']}: etap '{r['Segment / Etap podróży']}' w 'Macierz CX' różni się od '{step['stage']}' w 'Dane' (użyto 'Dane')")
        if r["Pain Point ID"] and r["Dominating Root Cause ID"] and (r["Pain Point ID"], r["Dominating Root Cause ID"]) not in pairs:
            warnings.append(f"{r['Touchpoint ID']}: para {r['Pain Point ID']} / {r['Dominating Root Cause ID']} nie występuje w 'Mapowanie_PP_RC'")
        if not r["Punkt styku"]:
            no_title.append(r["Touchpoint ID"])
        item = {key: text(r[col]) for key, col in MATRIX.items() if key not in ("emotionValue", "step", "stage", "stepName")}
        item.update(step=step["nr"], stage=step["stage"], emotionValue=number(r[MATRIX["emotionValue"]], r["Touchpoint ID"] + " (emocja)", warnings))
        if item["emotionValue"] is None and r[MATRIX["emotionValue"]] == "":
            warnings.append(f"{r['Touchpoint ID']}: brak poziomu emocji")
        if r["Touchpoint ID"] in fc:
            item["forecast"] = fc[r["Touchpoint ID"]]
        tps.append(item)
    if no_title:
        warnings.append("Punkty bez nazwy (kolumna 'Punkt styku'): " + ", ".join(no_title))

    stages = []
    for s in steps.values():
        if not stages or stages[-1]["name"] != s["stage"]:
            stages.append(dict(name=s["stage"], group=s["group"], color=s["color"]))
    data = dict(
        stages=stages, steps=list(steps.values()), touchpoints=tps,
        painPoints=[dict(id=r["Pain Point ID"], name=r["Pain Point"], description=r["Opis"]) for r in t["Pain pointy strategiczne"]],
        rootCauses=[dict(id=r["Root Cause ID"], name=r["Root Cause"], description=r["Opis"]) for r in t["Root Causes"]],
        initiatives=[dict(id=r["Initiative ID"], painPoint=r["Pain Point ID"], rootCause=r["Root Cause ID"], type=r["Typ"], name=r["Inicjatywa"]) for r in t["Inicjatywy"]],
        painRoot=[[r["Pain Point ID"], r["Root Cause ID"]] for r in t["Mapowanie_PP_RC"]],
        rootInitiative=[[r["Root Cause ID"], r["Initiative ID"]] for r in t["Mapowanie_RC_IN"]],
        warnings=warnings)
    hdr = (f"// DANE wygenerowane przez tools/cj-xlsx-to-data.py z {xlsx.name}. NIE EDYTUJ RĘCZNIE:\n"
           f"// źródłem jest xlsx (po zmianach uruchom skrypt ponownie). Zostaw window.{var} = oraz końcowy średnik.\n")
    with open(js_path, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(hdr + f"window.{var} = " + json.dumps(data, ensure_ascii=False, indent=1) + ";\n")
    return len(tps), len(steps), len(stages), len(warnings)


if __name__ == "__main__":
    if len(sys.argv) > 1:
        xlsx = Path(sys.argv[1])
        jobs = [(xlsx, ROOT / "data" / ("cj-demo.js" if "demo" in xlsx.stem.lower() else "cj.js"), "CX_CJ_DEMO" if "demo" in xlsx.stem.lower() else "CX_CJ")]
    else:
        jobs = [(ROOT / "macierz_CX.xlsx", ROOT / "data" / "cj.js", "CX_CJ"), (ROOT / "macierz_CX_demo.xlsx", ROOT / "data" / "cj-demo.js", "CX_CJ_DEMO")]
    failed = False
    for xlsx, js, var in jobs:
        if not xlsx.exists():
            print(f"Pominięto {xlsx.name}: brak pliku" + (" (widok Real będzie niedostępny)" if var == "CX_CJ" else ""))
            if var == "CX_CJ" and not js.exists():
                js.write_text("// Brak macierz_CX.xlsx: widok Real niedostępny, strona pokazuje dane demo.\nwindow.CX_CJ = null;\n", encoding="utf-8", newline="\n")
            continue
        try:
            print(f"{xlsx.name} → {js.name}. punkty, kroki, etapy, ostrzeżenia:", *convert(xlsx, js, var))
        except DataError as error:
            failed = True
            print(f"BŁĄD DANYCH ({xlsx.name}): {error}", file=sys.stderr)
    sys.exit(1 if failed else 0)
