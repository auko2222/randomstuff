# Portfolio site

A static portfolio hosted on GitHub Pages. Every page, tab, image and font is set in one file, `content/site.json`, and you edit that file through the editor at `/admin`.

- Live site: https://auko2222.github.io/randomstuff/
- Editor: https://auko2222.github.io/randomstuff/admin/

## Editing

1. Open the editor and click **Settings**. Under GitHub, follow the link to make a fine-grained token for this repo with **Contents: Read and write**, and paste it in. This is needed once per browser.
2. Pick a page from the dropdown. Click a block to open it and edit its text, links, images or font. The preview on the right updates as you type.
3. **+ New page** makes a project page with image holders and can add a homepage tab and a link in the “What you will find inside?” list.
4. Click **Publish**. The live site updates about a minute later.

Unpublished changes are kept in your browser, so you can close the tab and come back. **Undo** (or Ctrl+Z outside a text box) steps back.

## Blocks

| Block | Use |
| --- | --- |
| Homepage poster | The big title, the lines around it, and the tabs. Each tab has a position in % from the left and top. |
| Columns | Side-by-side sections with a heading, paragraph, list and optional framed image (About me). |
| Top line | Small text on the left and right edges. |
| Big heading | Large light or italic heading. |
| Underlined links | The big underlined list under “What you will find inside?”. |
| Project intro | Title, label, tags, description and an italic note (the top of each project page). |
| Text, Button, Space | General content. |
| Image, Image grid | Mockups. An empty image shows as a grey holder until you upload one. |

A link can be a page's web address (like `branding`), a section of a page (`home#works`, using a block's section name), `#top`, a `mailto:` address, or a full `https://` URL. The bottom menu is set in **Settings** and appears on the homepage once you scroll past the big title.

## Fonts

In **Settings**, type any family name from [Google Fonts](https://fonts.google.com) for body text, headings, and the big display title. Blocks that show text also have their own font box.

## Files

```
index.html          the site shell
assets/app.js       draws pages from content/site.json
assets/style.css    all styling
content/site.json   all content
images/             uploaded images
admin/              the editor (config.js sets the repo and branch it publishes to)
```
