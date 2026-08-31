# The Pencil and PDF engine

## The decision everything follows from

There are two ways to put ink on a PDF page.

**The wrong one:** put a `PKCanvasView` over the whole `PDFView` and convert
between screen space and page space yourself. It works until the student pinches.
Then the ink drifts, because you are now maintaining a transform by hand, sixty
times a second, against a scroll view that is also moving.

**The one this uses:** PDFKit's `PDFPageOverlayViewProvider`. PDFKit hands each
page a view positioned in *that page's own coordinate space* and keeps it
positioned. PDFKit owns scrolling, zooming and page layout. PencilKit owns the
stroke pipeline, which is where the low latency lives.

```swift
pdfView.pageOverlayViewProvider = self

func pdfView(_ view: PDFView, overlayViewFor page: PDFPage) -> UIView? {
    let canvas = PKCanvasView()
    canvas.isScrollEnabled = false   // it is a scroll view; left on, it fights PDFKit
    canvas.backgroundColor = .clear
    canvas.drawing = drawingProvider(index)
    return canvas
}
```

**No coordinate maths runs during a gesture.** That is the point.

It also means a stroke belongs to a *page*, not to a screen position — so it
survives rotation, Split View, Stage Manager, and being opened on a different
iPad.

## Consequences worth knowing

**Fingers scroll, Pencil writes.** `drawingPolicy = .pencilOnly` means finger
touches pass through to PDFKit's scroll view. Palm rejection and two-finger pan
are not features anyone implemented; they fall out of using the right input
policy.

**Canvases are per-page and transient.** `willEndDisplayingOverlayView` flushes
the page's ink and drops the canvas. A 500-page document never holds 500
canvases.

**Ink sharpness under zoom.** PencilKit rasterises finished strokes. Inside a PDF
overlay that means ink laid down at 1× can look soft at 4×. `scaleChanged()`
raises each canvas's `contentScaleFactor` with the zoom so it re-renders at the
new resolution. This is the standard mitigation. It is unverified on a device —
see [`status.md`](status.md).

**Undo goes to the canvas.** PencilKit registers stroke undo with the canvas's
own `UndoManager`, so ⌘Z must talk to `canvases[currentPageIndex]?.undoManager`.
The view controller's own manager knows nothing about strokes.

## What is not built

PencilKit exposes no public API for **shape straightening** — that lives inside
the system `PKToolPicker`, which this app replaces with its own toolbar. Rather
than ship a switch that does nothing, there isn't one. If shape straightening
matters more than the custom toolbar, the fix is to adopt `PKToolPicker` and
give up the floating design.

## The autosave contract

`PKCanvasView` reports a change on every stroke. Writing to disk on every stroke
would be wasteful and, on a dense page, visible as a hitch. `DrawingRepository`
therefore:

- updates the in-memory drawing **immediately** — nothing is ever queued up
  waiting to become true;
- coalesces the disk write to at most one per second per page;
- flushes any pending write on **page change**, on **backgrounding**, and on
  **document close**.

Worst case for a crash is under a second of ink. In practice it is zero, because
backgrounding is how an app normally goes away, and that path flushes.

Ink is stored as `PKDrawing.dataRepresentation()` in an `@Attribute(.externalStorage)`
field, so a page of dense notes lives beside the store rather than inside it.

## Memory

Decoded drawings are held only for pages within three of the current one.
`trimCache(around:)` drops the rest — except dirty pages, which are flushed
first and never evicted with unsaved work in them.

Thumbnails render lazily inside a `LazyVStack`, on the main actor. That last part
is deliberate: `PDFPage` is not thread-safe and the live `PDFView` is drawing the
same page objects, so rendering thumbnails concurrently is a data race, not a
performance win. They are kept to 200pt so the cost stays in the low
milliseconds.

## Export

The obvious implementation rasterises each page and stamps the ink on top. It is
also the wrong one: the teacher gets a fuzzy image, no selectable text, no
working links, and four times the file size.

`PDFExporter` instead *draws* each page into the new PDF context with
`PDFPage.draw(with:to:)`, which replays the original page's own drawing
operations. Text stays text. Vectors stay vectors. Only the student's ink is
rasterised, at 3× page resolution, and only where they wrote.

Mixed page sizes survive, because each page declares its own media box rather
than inheriting the first page's.

The original file in `Originals/` is not touched by any of this. The export is a
new file in `Submissions/`, which is what the student shares and what stays in
their submission history.
