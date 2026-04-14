import AppKit
import Foundation

let outputPath = "/Users/jpoole/python_practice/codex/poolej.github.io/emoji-browser/icons/phoenix-native-master.png"
let size = NSSize(width: 1024, height: 1024)
let emoji = "🐦‍🔥"

let image = NSImage(size: size)
image.lockFocus()

guard let context = NSGraphicsContext.current?.cgContext else {
    fatalError("Missing graphics context")
}

context.setAllowsAntialiasing(true)
context.setShouldAntialias(true)

let rect = NSRect(origin: .zero, size: size)
let backgroundPath = NSBezierPath(roundedRect: rect.insetBy(dx: 48, dy: 48), xRadius: 220, yRadius: 220)
NSColor.black.setFill()
backgroundPath.fill()

let shadow = NSShadow()
shadow.shadowOffset = NSSize(width: 0, height: -24)
shadow.shadowBlurRadius = 32
shadow.shadowColor = NSColor(calibratedRed: 0.95, green: 0.38, blue: 0.04, alpha: 0.24)
shadow.set()

let paragraph = NSMutableParagraphStyle()
paragraph.alignment = .center

let attributed = NSAttributedString(
    string: emoji,
    attributes: [
        .font: NSFont(name: "Apple Color Emoji", size: 590) ?? NSFont.systemFont(ofSize: 590),
        .paragraphStyle: paragraph
    ]
)

let textRect = NSRect(x: 86, y: 104, width: 852, height: 800)
attributed.draw(in: textRect)

image.unlockFocus()

guard
    let tiffData = image.tiffRepresentation,
    let bitmap = NSBitmapImageRep(data: tiffData),
    let pngData = bitmap.representation(using: .png, properties: [:])
else {
    fatalError("Failed to create PNG")
}

try pngData.write(to: URL(fileURLWithPath: outputPath))
