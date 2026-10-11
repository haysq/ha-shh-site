# Contributing

Thank you for helping! The most useful contribution is fixing translations. Eight of the ten languages were first translated with the help of AI, so native speakers can make them much better.

## Fixing a translation
1. Edit `texts/<language>.json`. Only change the values, never the keys or the order.
2. Keep placeholders exactly as they are: `{brand}`, `{email}`, `{m}`, `{n}`.
3. HTML is limited on purpose. Only `<b>`, `<p>`, `<ul>`, `<li>` and the contact link `<a href="mailto:{email}">` are allowed, with no other attributes. Use the same tags as the English text.
4. Mode names should match the app: Normal, Focus, Sleep, Sports.
5. Privacy texts must keep exactly the same meaning as the English version. Please do not add or remove promises.
6. Run `python3 check_texts.py` and `python3 build.py`, then open a pull request.

## Features
The site only describes features that exist in the app. Please do not add feature claims; open an issue instead.

## Security
Please do not report security problems in public issues. See [SECURITY.md](SECURITY.md).
