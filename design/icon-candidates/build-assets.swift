#!/usr/bin/env swift
import AppKit
import CryptoKit
import Foundation

let repository = URL(fileURLWithPath: #filePath).deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
let design = repository.appendingPathComponent("design/icon-candidates")
let assets = repository.appendingPathComponent("apps/desktop/public/icon-candidates")
let fileManager = FileManager.default
let prompts = try JSONSerialization.jsonObject(with: Data(contentsOf: design.appendingPathComponent("prompts.json"))) as! [[String: Any]]
let thumbnailDirectory = assets.appendingPathComponent("thumbnails")
let reviewDirectory = design.appendingPathComponent("small-size")
try fileManager.createDirectory(at: thumbnailDirectory, withIntermediateDirectories: true)
try fileManager.createDirectory(at: reviewDirectory, withIntermediateDirectories: true)

/// Creates an exact-pixel canvas for catalog derivatives when this build script runs.
/// The drawing closure receives an AppKit context; failed PNG encoding aborts the build.
func render(width: Int, height: Int, to destination: URL, draw: () -> Void) throws {
    let bitmap = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: width, pixelsHigh: height, bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: width * 4, bitsPerPixel: 32)!
    let context = NSGraphicsContext(bitmapImageRep: bitmap)!
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = context
    context.imageInterpolation = .high
    draw()
    context.flushGraphics()
    NSGraphicsContext.restoreGraphicsState()
    try bitmap.representation(using: .png, properties: [:])!.write(to: destination)
}

/// Draws catalog labels in top-origin coordinates so contact and review sheets share alignment.
func label(_ text: String, x: Int, top: Int, height: Int, fontSize: CGFloat = 12, color: NSColor = .white) {
    (text as NSString).draw(at: NSPoint(x: x, y: height - top - Int(fontSize) - 4), withAttributes: [.font: NSFont.systemFont(ofSize: fontSize, weight: .medium), .foregroundColor: color])
}

var manifest: [[String: Any]] = []
var images: [NSImage] = []
var hashes = Set<String>()
guard prompts.count == 64 else { fatalError("Expected 64 prompt records") }
// Every source is independently generated; validate IDs and source dimensions before publishing.
for (index, prompt) in prompts.enumerated() {
    let id = prompt["id"] as! String
    guard id == String(format: "I%02d", index + 1) else { fatalError("Unexpected ID order: \(id)") }
    let source = assets.appendingPathComponent("\(id).png")
    let data = try Data(contentsOf: source)
    let bitmap = NSBitmapImageRep(data: data)!
    // Generated antialiasing can leave one alpha level (1/255) at a corner; reject opaque backgrounds.
    let corners = [(0, 0), (bitmap.pixelsWide - 1, 0), (0, bitmap.pixelsHigh - 1), (bitmap.pixelsWide - 1, bitmap.pixelsHigh - 1)]
    guard bitmap.pixelsWide == bitmap.pixelsHigh, bitmap.pixelsWide >= 1024, bitmap.hasAlpha,
          corners.allSatisfy({ bitmap.colorAt(x: $0.0, y: $0.1)!.alphaComponent <= 1.0 / 255.0 }) else { fatalError("Invalid dimensions or transparent corners: \(id)") }
    let hash = SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
    guard hashes.insert(hash).inserted else { fatalError("Duplicate image: \(id)") }
    let image = NSImage(data: data)!
    images.append(image)
    try render(width: 128, height: 128, to: thumbnailDirectory.appendingPathComponent("\(id).png")) {
        image.draw(in: NSRect(x: 0, y: 0, width: 128, height: 128))
    }
    var candidate = prompt.filter { ["id", "name", "family", "intent", "palette", "src"].contains($0.key) }
    candidate["thumbnail"] = "/icon-candidates/thumbnails/\(id).png"
    candidate["width"] = bitmap.pixelsWide
    candidate["height"] = bitmap.pixelsHigh
    candidate["sha256"] = hash
    manifest.append(candidate)
}

let contactWidth = 1600
let contactHeight = 1760
try render(width: contactWidth, height: contactHeight, to: design.appendingPathComponent("contact-sheet.png")) {
    NSColor(calibratedWhite: 0.075, alpha: 1).setFill()
    NSRect(x: 0, y: 0, width: contactWidth, height: contactHeight).fill()
    // Eight rows preserve the eight visual directions, with eight individual candidates per row.
    for (index, candidate) in manifest.enumerated() {
        let x = (index % 8) * 200
        let top = (index / 8) * 220
        images[index].draw(in: NSRect(x: x + 20, y: contactHeight - top - 170, width: 160, height: 160))
        label("\(candidate["id"]!) · \(candidate["name"]!)", x: x + 12, top: top + 176, height: contactHeight, fontSize: 11)
        label(candidate["family"] as! String, x: x + 12, top: top + 195, height: contactHeight, fontSize: 10, color: .lightGray)
    }
}

// Each sheet contains 1:1 samples on light and dark surfaces; do not upscale these during review.
for family in 0..<8 {
    let width = 1000
    let height = 1240
    try render(width: width, height: height, to: reviewDirectory.appendingPathComponent(String(format: "family-%02d.png", family + 1))) {
        NSColor(calibratedWhite: 0.07, alpha: 1).setFill()
        NSRect(x: 0, y: 0, width: width, height: height).fill()
        NSColor(calibratedWhite: 0.93, alpha: 1).setFill()
        NSRect(x: 500, y: 0, width: 500, height: height).fill()
        for row in 0..<8 {
            let index = family * 8 + row
            let top = row * 155
            for surface in 0..<2 {
                let offset = surface * 500
                let color = surface == 0 ? NSColor.white : NSColor.black
                label("\(manifest[index]["id"]!) · \(manifest[index]["name"]!)", x: offset + 10, top: top + 4, height: height, color: color)
                for (size, x) in [(16, 18), (32, 76), (64, 152), (128, 260)] {
                    images[index].draw(in: NSRect(x: offset + x, y: height - top - 147, width: size, height: size))
                    label("\(size)", x: offset + x, top: top + 27, height: height, fontSize: 10, color: color)
                }
            }
        }
    }
}
let catalog: [String: Any] = ["schemaVersion": 1, "candidates": manifest, "recommendedIds": ["I17", "I33", "I01", "I57", "I41", "I25"]]
let json = try JSONSerialization.data(withJSONObject: catalog, options: [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes])
try (json + Data("\n".utf8)).write(to: assets.appendingPathComponent("manifest.json"))
print("Validated 64 unique square PNGs (minimum 1024px, alpha). Wrote 64 thumbnails, contact sheet, 8 small-size review sheets, and manifest.")
