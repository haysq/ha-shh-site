#!/usr/bin/env python3
"""Checks texts/raw/<lang>.txt (Gemini output) against texts/en.json and writes texts/<lang>.json when it matches.
Also checks existing texts/<lang>.json files. Usage: python3 check_texts.py [lang ...]"""
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
TEXTS = os.path.join(HERE, "texts")
TAG = re.compile(r"</?[a-z]+")
PH = re.compile(r"\{(brand|email|m|n)\}")
# Texts are inserted into pages as HTML, so only these plain tags are allowed (no attributes, no scripts).
# The single exception is the contact link: <a href="mailto:{email}">.
ANY_TAG = re.compile(r"<[^>]*>")
SAFE_TAG = re.compile(r'</?(b|p|ul|li)>|<a href="mailto:\{email\}">|</a>')
KEEP =["ha!shh", "Seçkin Çelik", "12:30", "18:00", "21:00"]


def parse(raw):
    raw = raw.strip()
    raw = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw)
    start, end = raw.find("{"), raw.rfind("}")
    return json.loads(raw[start:end + 1])


def compare(en, other, path, errors):
    if isinstance(en, dict):
        if not isinstance(other, dict):
            errors.append(path + ": not an object")
            return
        for k in en:
            if k not in other:
                errors.append(path + "." + k + ": missing")
            else:
                compare(en[k], other[k], path + "." + k, errors)
        for k in other:
            if k not in en:
                errors.append(path + "." + k + ": extra key")
    elif isinstance(en, list):
        if not isinstance(other, list) or len(other) != len(en):
            errors.append(path + ": list length differs")
            return
        for i, (a, b) in enumerate(zip(en, other)):
            compare(a, b, "%s[%d]" % (path, i), errors)
    elif isinstance(en, str):
        if not isinstance(other, str):
            errors.append(path + ": not a string")
            return
        if sorted(TAG.findall(en)) != sorted(TAG.findall(other)):
            errors.append(path + ": HTML tags differ")
        if sorted(PH.findall(en)) != sorted(PH.findall(other)):
            errors.append(path + ": placeholders differ")
        if en and not other.strip() and path != "$.common.mt_note":
            errors.append(path + ": empty")
        for tag in ANY_TAG.findall(other):
            if not SAFE_TAG.fullmatch(tag):
                errors.append(path + ": unsafe HTML " + tag[:60])


def main():
    en = json.load(open(os.path.join(TEXTS, "en.json"), encoding="utf-8"))
    langs = sys.argv[1:] or ["en", "tr", "ar", "de", "es", "fr", "hi", "id", "pt", "ru"]
    bad = 0
    for lang in langs:
        raw_path = os.path.join(TEXTS, "raw", lang + ".txt")
        out_path = os.path.join(TEXTS, lang + ".json")
        try:
            if os.path.exists(raw_path) and (not os.path.exists(out_path) or os.path.getmtime(raw_path) > os.path.getmtime(out_path)):
                data = parse(open(raw_path, encoding="utf-8").read())
                source = "raw"
            else:
                data = json.load(open(out_path, encoding="utf-8"))
                source = "json"
        except Exception as e:  # noqa: BLE001
            print("%s: cannot parse (%s)" % (lang, e))
            bad += 1
            continue
        errors = []
        compare(en, data, "$", errors)
        flat = json.dumps(data, ensure_ascii=False)
        errors += ["missing name/number: " + k for k in KEEP if k not in flat]
        if lang not in ("en", "tr") and not data["common"].get("mt_note"):
            errors.append("$.common.mt_note: empty")
        if errors:
            bad += 1
            print("%s (%s): %d problem(s)" % (lang, source, len(errors)))
            for e in errors[:15]:
                print("   " + e)
            continue
        if source == "raw":
            with open(out_path, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
                f.write("\n")
        print("%s: ok (%s, %s)" % (lang, data["meta"]["name"], data["meta"]["dir"]))
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
