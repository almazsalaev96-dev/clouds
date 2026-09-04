# Running the Reader's Docket on your own computer

Two files matter here:

- **`readers-docket.html`** — the whole thing in one file. Nothing else needed.
- **`index.html` + `vendor/anthropic.js`** — the same site split in two, for hosting.

Use the single file unless you are putting it on a web host.

---

## Just open it

Double-click **`readers-docket.html`**. Everything works: the form, the ratings,
the probability, the essay diagnostic.

The one thing that may **not** work this way is the *Read my essay* button. Opened
as a file, the browser gives the page no web address, and browsers block requests
to other sites from a page with no address. If the read fails, use the localhost
method below — it takes one command and fixes it.

---

## Run it on localhost (recommended)

You need a terminal open in this folder.

**Mac** — open Terminal, then:

```
cd ~/Downloads
python3 -m http.server 8000
```

**Windows** — open Command Prompt, then:

```
cd %USERPROFILE%\Downloads
python -m http.server 8000
```

(Replace `Downloads` with wherever you saved the file.)

Then open your browser at:

```
http://localhost:8000/readers-docket.html
```

Leave the terminal window open while you use it. Press `Ctrl + C` to stop.

**No Python?** If you have Node.js instead:

```
npx --yes serve -l 8000
```

---

## Your API key

The key box is at the bottom of the page, under **Deep read**.

- The key is stored **only in your own browser**, and is sent **only to Anthropic**.
- It never reaches this page's author, a server, or anyone else.
- **Forget key** removes it.
- Each read costs a few cents on your own Anthropic account.

Get a key at <https://console.anthropic.com/settings/keys>.

---

## Saving your work

The page does not save automatically. Press **Save profile** before closing the
tab, and **Load saved** when you come back. That is also stored only in your
browser, so it will not follow you to another computer.
