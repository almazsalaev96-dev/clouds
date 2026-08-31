import SwiftUI
import PDFKit

/// The page rail.
///
/// Thumbnails are rendered lazily and only while visible — a 500-page textbook
/// must not render 500 images to show the first eight. Pages carrying the
/// student's ink get a dot, which turns the rail into a map of what's done.
struct ThumbnailStrip: View {

    let pdf: PDFDocument
    let currentPage: Int
    let hasInk: (Int) -> Bool
    let onSelect: (Int) -> Void

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView(showsIndicators: false) {
                LazyVStack(spacing: Theme.Space.m) {
                    ForEach(0..<pdf.pageCount, id: \.self) { index in
                        ThumbnailCell(
                            page: pdf.page(at: index),
                            number: index + 1,
                            isCurrent: index == currentPage,
                            hasInk: hasInk(index)
                        )
                        .id(index)
                        .onTapGesture { onSelect(index) }
                    }
                }
                .padding(Theme.Space.m)
            }
            .frame(width: 132)
            .background(.regularMaterial)
            .overlay(alignment: .trailing) { Divider() }
            .onAppear { proxy.scrollTo(currentPage, anchor: .center) }
            .onChange(of: currentPage) { _, page in
                withAnimation(Theme.Motion.fade) { proxy.scrollTo(page, anchor: .center) }
            }
        }
        .padding(.top, 56) // clear the top bar
        .frame(maxHeight: .infinity, alignment: .top)
        .accessibilityLabel("Page thumbnails")
    }
}

private struct ThumbnailCell: View {

    let page: PDFPage?
    let number: Int
    let isCurrent: Bool
    let hasInk: Bool

    @State private var image: UIImage?

    var body: some View {
        VStack(spacing: Theme.Space.xs) {
            ZStack {
                Theme.Palette.page
                if let image {
                    Image(uiImage: image)
                        .resizable()
                        .aspectRatio(contentMode: .fit)
                }
            }
            .frame(width: 96, height: 128)
            .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 6, style: .continuous)
                    .strokeBorder(isCurrent ? Theme.Palette.accent : Theme.Palette.separator,
                                  lineWidth: isCurrent ? 2 : 0.5)
            )

            HStack(spacing: 4) {
                if hasInk {
                    Circle()
                        .fill(Theme.Palette.success)
                        .frame(width: 5, height: 5)
                }
                Text("\(number)")
                    .font(Theme.Text.numeric)
                    .foregroundStyle(isCurrent ? Theme.Palette.accent : Theme.Palette.textSecondary)
            }
        }
        .contentShape(Rectangle())
        .task(id: number) {
            guard image == nil, let page else { return }
            // Rendered on the main actor deliberately. `PDFPage` is not
            // thread-safe and the same page object is being drawn by the live
            // `PDFView`; rendering it concurrently is a data race, not a
            // performance win. Thumbnails are kept to 200pt so the cost stays
            // in the low milliseconds, and `LazyVStack` means only the visible
            // handful are ever rendered.
            image = PDFPageRenderer.image(of: page, longEdge: 200)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Page \(number)\(hasInk ? ", has your writing" : "")")
        .accessibilityAddTraits(isCurrent ? [.isSelected, .isButton] : .isButton)
    }
}
