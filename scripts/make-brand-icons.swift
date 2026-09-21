import CoreGraphics
import CoreText
import Foundation
import ImageIO
import UniformTypeIdentifiers

let ink = CGColor(srgbRed: 23 / 255, green: 19 / 255, blue: 18 / 255, alpha: 1)
let cream = CGColor(srgbRed: 255 / 255, green: 246 / 255, blue: 236 / 255, alpha: 1)
let coral = CGColor(srgbRed: 255 / 255, green: 90 / 255, blue: 61 / 255, alpha: 1)
let yellow = CGColor(srgbRed: 255 / 255, green: 201 / 255, blue: 60 / 255, alpha: 1)
let teal = CGColor(srgbRed: 18 / 255, green: 179 / 255, blue: 155 / 255, alpha: 1)
let creamSoft = CGColor(srgbRed: 255 / 255, green: 246 / 255, blue: 236 / 255, alpha: 0.7)

func makeContext(width: Int, height: Int) -> CGContext {
  let space = CGColorSpaceCreateDeviceRGB()
  guard let ctx = CGContext(
    data: nil,
    width: width,
    height: height,
    bitsPerComponent: 8,
    bytesPerRow: 0,
    space: space,
    bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
  ) else {
    fatalError("Could not make a bitmap")
  }
  ctx.setFillColor(ink)
  ctx.fill(CGRect(x: 0, y: 0, width: width, height: height))
  return ctx
}

func fillDots(_ ctx: CGContext, cx: CGFloat, cy: CGFloat, size: CGFloat) {
  let gap = size * 0.45
  let total = size * 3 + gap * 2
  var x = cx - total / 2
  let y = cy - size / 2
  for colour in [coral, yellow, teal] {
    ctx.setFillColor(colour)
    ctx.fillEllipse(in: CGRect(x: x, y: y, width: size, height: size))
    x += size + gap
  }
}

func writePNG(_ ctx: CGContext, to path: String) {
  guard let image = ctx.makeImage() else { fatalError("No image") }
  let url = URL(fileURLWithPath: path)
  guard let dest = CGImageDestinationCreateWithURL(url as CFURL, UTType.png.identifier as CFString, 1, nil) else {
    fatalError("Could not write \(path)")
  }
  CGImageDestinationAddImage(dest, image, nil)
  CGImageDestinationFinalize(dest)
  print("wrote \(path)")
}

func fontNamed(_ name: String, size: CGFloat) -> CTFont {
  CTFontCreateWithName(name as CFString, size, nil)
}

func drawCentered(_ ctx: CGContext, text: String, font: CTFont, color: CGColor, cx: CGFloat, baseline: CGFloat) {
  let attrs: [CFString: Any] = [
    kCTFontAttributeName: font,
    kCTForegroundColorAttributeName: color,
  ]
  let attr = CFAttributedStringCreate(nil, text as CFString, attrs as CFDictionary)!
  let line = CTLineCreateWithAttributedString(attr)
  let width = CGFloat(CTLineGetTypographicBounds(line, nil, nil, nil))
  ctx.textPosition = CGPoint(x: cx - width / 2, y: baseline)
  CTLineDraw(line, ctx)
}

func fillPill(_ ctx: CGContext, x: CGFloat, y: CGFloat, w: CGFloat, h: CGFloat, color: CGColor) {
  let path = CGPath(
    roundedRect: CGRect(x: x, y: y, width: w, height: h),
    cornerWidth: h / 2,
    cornerHeight: h / 2,
    transform: nil
  )
  ctx.setFillColor(color)
  ctx.addPath(path)
  ctx.fillPath()
}

func register(_ path: String) {
  var error: Unmanaged<CFError>?
  CTFontManagerRegisterFontsForURL(URL(fileURLWithPath: path) as CFURL, .process, &error)
}

let fontDir = "/tmp/ddd-fonts"
register("\(fontDir)/BricolageGrotesque.ttf")
register("\(fontDir)/Jost.ttf")

let root = "/Users/nik/Downloads/date-dinner-dance/public"

let icon1024 = makeContext(width: 1024, height: 1024)
fillDots(icon1024, cx: 512, cy: 512, size: 140)
writePNG(icon1024, to: "\(root)/app-icon.png")

let icon180 = makeContext(width: 180, height: 180)
fillDots(icon180, cx: 90, cy: 90, size: 28)
writePNG(icon180, to: "\(root)/apple-touch-icon.png")

let og = makeContext(width: 1200, height: 630)
fillDots(og, cx: 600, cy: 470, size: 36)
drawCentered(og, text: "date dinner dance", font: fontNamed("Bricolage Grotesque", size: 64), color: cream, cx: 600, baseline: 360)
drawCentered(
  og,
  text: "Plan your perfect day then tell somebody special.",
  font: fontNamed("Jost", size: 26),
  color: creamSoft,
  cx: 600,
  baseline: 300
)
fillPill(og, x: 430, y: 160, w: 340, h: 72, color: coral)
drawCentered(og, text: "Plan yours →", font: fontNamed("Jost", size: 28), color: cream, cx: 600, baseline: 182)
writePNG(og, to: "\(root)/og.png")
