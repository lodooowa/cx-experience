# Źródłem danych widoku Customer Journey jest macierz_CX.xlsx. Skrypt czyta go i zapisuje data/cj.js (window.CX_CJ).
# Tylko biblioteka standardowa Pythona 3. Użycie: python3 tools/cj-xlsx-to-data.py [plik.xlsx]
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
# Prognoza i Initiative ID to opcjonalne kolumny zakładki "Macierz CX" (obok poziomu emocji); brak kolumn lub pusta komórka = brak prognozy.
# Initiative ID: brak = powiązanie tylko przez root cause.
FORECAST = ["Po Quick Wins", "Po Mid Term", "Po Long Term", "Status prognozy", "Initiative ID"]


def table(book, name, columns, required=True, optional=()):
    if name not in book:
        if required:
            raise DataError(f"Brak zakładki '{name}' w pliku")
        return []
    rows = book[name]
    head = rows[0][1] if rows else []
    for col in columns:
        if col not in head:
            raise DataError(f"Zakładka '{name}': brak kolumny '{col}'")
    idx = {col: head.index(col) for col in columns}
    idx.update({col: head.index(col) for col in optional if col in head})
    out = []
    for n, row in rows[1:]:
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


def convert(xlsx, js_path):
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
    known([r for r in t["Macierz CX"] if "Initiative ID" in r], "Macierz CX", "Initiative ID", in_ids)
    pairs = {(r["Pain Point ID"], r["Root Cause ID"]) for r in t["Mapowanie_PP_RC"]}

    fc, initiative, fstatus = {}, {}, set()
    for r in t["Macierz CX"]:
        if not any(r.get(c) for c in FORECAST[:3]):
            continue
        where = "Prognoza " + r["Touchpoint ID"]
        fc[r["Touchpoint ID"]] = dict(qw=number(r["Po Quick Wins"], where + " (Quick Wins)", warnings), mid=number(r["Po Mid Term"], where + " (Mid Term)", warnings),
                                      long=number(r["Po Long Term"], where + " (Long Term)", warnings))
        initiative[r["Touchpoint ID"]] = r.get("Initiative ID", "")
        if r.get("Status prognozy"):
            fstatus.add(r["Status prognozy"])
    fstatus = sorted(fstatus)

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
            if initiative.get(r["Touchpoint ID"]):
                item["initiative"] = initiative[r["Touchpoint ID"]]
        tps.append(item)
    if no_title:
        warnings.append("Punkty bez nazwy (kolumna 'Punkt styku'): " + ", ".join(no_title))

    stages = []
    for s in steps.values():
        if not stages or stages[-1]["name"] != s["stage"]:
            stages.append(dict(name=s["stage"], group=s["group"], color=s["color"]))
    data = dict(
        forecastStatus="/".join(fstatus) if len(fstatus) else "", stages=stages, steps=list(steps.values()), touchpoints=tps,
        painPoints=[dict(id=r["Pain Point ID"], name=r["Pain Point"], description=r["Opis"]) for r in t["Pain pointy strategiczne"]],
        rootCauses=[dict(id=r["Root Cause ID"], name=r["Root Cause"], description=r["Opis"]) for r in t["Root Causes"]],
        initiatives=[dict(id=r["Initiative ID"], painPoint=r["Pain Point ID"], rootCause=r["Root Cause ID"], type=r["Typ"], name=r["Inicjatywa"]) for r in t["Inicjatywy"]],
        painRoot=[[r["Pain Point ID"], r["Root Cause ID"]] for r in t["Mapowanie_PP_RC"]],
        rootInitiative=[[r["Root Cause ID"], r["Initiative ID"]] for r in t["Mapowanie_RC_IN"]],
        warnings=warnings)
    hdr = ("// DANE wygenerowane przez tools/cj-xlsx-to-data.py z macierz_CX.xlsx. NIE EDYTUJ RĘCZNIE:\n"
           "// źródłem jest xlsx (po zmianach uruchom skrypt ponownie). Zostaw window.CX_CJ = oraz końcowy średnik.\n")
    with open(js_path, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(hdr + "window.CX_CJ = " + json.dumps(data, ensure_ascii=False, indent=1) + ";\n")
    return len(tps), len(steps), len(stages), len(warnings)


if __name__ == "__main__":
    xlsx = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "macierz_CX.xlsx"
    try:
        print("Gotowe. punkty, kroki, etapy, ostrzeżenia:", *convert(xlsx, ROOT / "data" / "cj.js"))
    except DataError as error:
        sys.exit(f"BŁĄD DANYCH: {error}")
