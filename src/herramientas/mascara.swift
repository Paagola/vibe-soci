// Máscara del sujeto principal con Apple Vision (local, sin red, macOS 14 o posterior).
// Uso: mascara <entrada> <salida.png>
// Es un adaptador local de F1: el compositor solo necesita un PNG de máscara, venga de donde venga.
import Foundation
import Vision
import CoreImage

let argumentos = CommandLine.arguments
guard argumentos.count == 3 else {
  FileHandle.standardError.write("Uso: mascara <entrada> <salida.png>\n".data(using: .utf8)!)
  exit(64)
}
let handler = VNImageRequestHandler(url: URL(fileURLWithPath: argumentos[1]))
let peticion = VNGenerateForegroundInstanceMaskRequest()
try handler.perform([peticion])
guard let resultado = peticion.results?.first else {
  FileHandle.standardError.write("No se ha encontrado ningún sujeto.\n".data(using: .utf8)!)
  exit(2)
}
let mascara = try resultado.generateScaledMaskForImage(forInstances: resultado.allInstances, from: handler)
try CIContext().writePNGRepresentation(
  of: CIImage(cvPixelBuffer: mascara),
  to: URL(fileURLWithPath: argumentos[2]),
  format: .L8,
  colorSpace: CGColorSpaceCreateDeviceGray(),
  options: [:]
)
print("instancias: \(resultado.allInstances.count)")
