// EmuSurfaceView — the Metal surface the game renders into. A passive
// sink: MTKView drives its own 60 Hz draw loop on the main thread and
// pulls the latest completed frame from EmuSession under frameLock; the
// emulation thread never blocks on rendering.
//
// The shader is a runtime-compiled source string on purpose: no .metal
// file plumbing in the podspec, and a compile failure becomes a readable
// diagnostic (EmuSession.lastError) instead of a silent black screen.

import ExpoModulesCore
import MetalKit

private let shaderSource = """
#include <metal_stdlib>
using namespace metal;

struct VOut {
  float4 pos [[position]];
  float2 uv;
};

// Fullscreen triangle; uv flipped so row 0 lands at the top.
vertex VOut emu_vertex(uint vid [[vertex_id]]) {
  float2 pos[3] = { float2(-1.0, -1.0), float2(3.0, -1.0), float2(-1.0, 3.0) };
  VOut out;
  out.pos = float4(pos[vid], 0.0, 1.0);
  out.uv = float2(pos[vid].x * 0.5 + 0.5, 1.0 - (pos[vid].y * 0.5 + 0.5));
  return out;
}

// Two samplers, chosen per pipeline rather than branched per pixel.
//
// nearest gives exact source pixels, but none of these screens divides
// evenly into a phone display (a 400px 3DS screen into ~1170 physical
// px is 2.9x), so some source pixels come out a row wider than their
// neighbours -- uneven edges, and shimmer on scrolling text. linear
// trades that for a slight softness.
fragment float4 emu_fragment(VOut in [[stage_in]],
                             texture2d<float> tex [[texture(0)]]) {
  constexpr sampler s(coord::normalized, filter::nearest);
  return tex.sample(s, in.uv);
}

fragment float4 emu_fragment_smooth(VOut in [[stage_in]],
                                    texture2d<float> tex [[texture(0)]]) {
  constexpr sampler s(coord::normalized, filter::linear);
  return tex.sample(s, in.uv);
}
"""

final class EmuSurfaceView: ExpoView, MTKViewDelegate {
  var screenIndex = 0

  /// "sharp" (nearest) or "smooth" (linear). Both pipelines are built up
  /// front so switching is a pointer swap, not a shader compile.
  var filter: String = "smooth" {
    didSet { pipeline = filter == "sharp" ? sharpPipeline : smoothPipeline }
  }

  private let mtkView = MTKView()
  private var commandQueue: MTLCommandQueue?
  private var pipeline: MTLRenderPipelineState?
  private var sharpPipeline: MTLRenderPipelineState?
  private var smoothPipeline: MTLRenderPipelineState?
  private var texture: MTLTexture?

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)

    guard let device = MTLCreateSystemDefaultDevice() else {
      EmuSession.shared.reportError("no Metal device")
      return
    }
    mtkView.device = device
    mtkView.framebufferOnly = true
    mtkView.isPaused = false
    mtkView.enableSetNeedsDisplay = false
    mtkView.preferredFramesPerSecond = 60
    mtkView.clearColor = MTLClearColor(red: 0, green: 0, blue: 0, alpha: 1)
    mtkView.delegate = self
    addSubview(mtkView)

    commandQueue = device.makeCommandQueue()
    do {
      let library = try device.makeLibrary(source: shaderSource, options: nil)
      let vertexFn = library.makeFunction(name: "emu_vertex")
      func makePipeline(_ fragment: String) throws -> MTLRenderPipelineState {
        let desc = MTLRenderPipelineDescriptor()
        desc.vertexFunction = vertexFn
        desc.fragmentFunction = library.makeFunction(name: fragment)
        desc.colorAttachments[0].pixelFormat = mtkView.colorPixelFormat
        return try device.makeRenderPipelineState(descriptor: desc)
      }
      sharpPipeline = try makePipeline("emu_fragment")
      smoothPipeline = try makePipeline("emu_fragment_smooth")
      pipeline = filter == "sharp" ? sharpPipeline : smoothPipeline
    } catch {
      EmuSession.shared.reportError("Metal pipeline: \(error.localizedDescription)")
    }
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    mtkView.frame = bounds
  }

  // MARK: - MTKViewDelegate

  func mtkView(_ view: MTKView, drawableSizeWillChange size: CGSize) {}

  func draw(in view: MTKView) {
    guard let pipeline,
          let commandQueue,
          let drawable = view.currentDrawable,
          let passDescriptor = view.currentRenderPassDescriptor,
          let commandBuffer = commandQueue.makeCommandBuffer() else { return }

    // Pull the latest completed frame. Upload happens under the lock;
    // it's a ~200 KB CPU copy, cheap at 60 Hz.
    let session = EmuSession.shared
    session.frameLock.lock()
    if screenIndex < session.frames.count {
      let frame = session.frames[screenIndex]
      if frame.width > 0 && frame.height > 0 {
        if texture == nil || texture!.width != frame.width || texture!.height != frame.height {
          let td = MTLTextureDescriptor.texture2DDescriptor(pixelFormat: .rgba8Unorm,
                                                            width: frame.width,
                                                            height: frame.height,
                                                            mipmapped: false)
          td.usage = .shaderRead
          td.storageMode = .shared
          texture = view.device?.makeTexture(descriptor: td)
        }
        if let texture {
          frame.pixels.withUnsafeBufferPointer { src in
            if let base = src.baseAddress {
              texture.replace(region: MTLRegionMake2D(0, 0, frame.width, frame.height),
                              mipmapLevel: 0,
                              withBytes: base,
                              bytesPerRow: frame.width * 4)
            }
          }
        }
      }
    }
    session.frameLock.unlock()

    guard let encoder = commandBuffer.makeRenderCommandEncoder(descriptor: passDescriptor) else { return }
    if let texture {
      encoder.setRenderPipelineState(pipeline)
      encoder.setFragmentTexture(texture, index: 0)
      encoder.drawPrimitives(type: .triangle, vertexStart: 0, vertexCount: 3)
    }
    encoder.endEncoding()
    commandBuffer.present(drawable)
    commandBuffer.commit()
  }
}
