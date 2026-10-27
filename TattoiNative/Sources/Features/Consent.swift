import PencilKit
import SwiftUI

struct ConsentFormView: View {
  @Environment(AppStore.self) private var store
  @Environment(\.dismiss) private var dismiss
  let form: JSONValue
  @State private var answers: [String: String] = [:]
  @State private var photoPermission = false
  @State private var agrees = false
  @State private var drawing = PKDrawing()
  @State private var busy = false
  @State private var error: String?
  private var questions: [(String, String)] {
    guard form["formType"].string == "medical_release" else { return [] }
    return form["content"].string.components(separatedBy: .newlines).compactMap { line in
      guard let dot = line.firstIndex(of: "."), let number = Int(line[..<dot]) else { return nil }
      return (
        String(number), String(line[line.index(after: dot)...]).trimmingCharacters(in: .whitespaces)
      )
    }
  }
  var body: some View {
    Form {
      Section {
        Text(form["title"].string.replacingOccurrences(of: "**", with: "")).font(Ivory.heading(28))
        Text(LocalizedStringKey(form["content"].string)).textSelection(.enabled)
      }
      ForEach(questions, id: \.0) { key, question in
        Section(question) {
          Picker(
            "Answer", selection: Binding(get: { answers[key] ?? "" }, set: { answers[key] = $0 })
          ) {
            Text("Choose").tag("")
            Text("Yes").tag("yes")
            Text("No").tag("no")
          }.pickerStyle(.segmented)
        }
      }
      Section("Signature") {
        SignatureCanvas(drawing: $drawing).frame(height: 180).background(.white).clipShape(
          RoundedRectangle(cornerRadius: 12))
        Button("Clear signature") { drawing = PKDrawing() }
        Toggle("I have read this form and confirm my answers and signature", isOn: $agrees)
        if form["formType"].string == "procedure_consent" {
          Toggle(
            "I give permission for photography as described in this form", isOn: $photoPermission)
        }
      }
      if let error { Text(error).foregroundStyle(.red) }
      Button(busy ? "Submitting…" : "Sign and submit") { submit() }.disabled(
        busy || !agrees || drawing.strokes.isEmpty || !questions.allSatisfy { answers[$0.0] != nil }
      )
    }.navigationTitle("Your form").toolbar { Button("Finish later") { dismiss() }.disabled(busy) }
      .interactiveDismissDisabled(busy)
  }
  private func submit() {
    guard !busy, agrees, !drawing.strokes.isEmpty, questions.allSatisfy({ answers[$0.0] != nil })
    else { return }
    busy = true
    Task {
      defer { busy = false }
      do {
        let image = drawing.image(from: drawing.bounds.insetBy(dx: -8, dy: -8), scale: 1)
        guard let data = image.pngData(), data.count < 350000 else {
          throw APIError("This signature is too large. Clear it and sign again.")
        }
        try await store.mutate(
          "forms.signForm",
          .object([
            "formId": form["id"],
            "signature": .string("data:image/png;base64," + data.base64EncodedString()),
            "answers": .object(answers.mapValues(JSONValue.string)),
            "photoPermission": .bool(photoPermission),
          ]))
        dismiss()
      } catch { self.error = error.localizedDescription }
    }
  }
}
private struct SignatureCanvas: UIViewRepresentable {
  @Binding var drawing: PKDrawing
  func makeUIView(context: Context) -> PKCanvasView {
    let canvas = PKCanvasView()
    canvas.delegate = context.coordinator
    canvas.drawingPolicy = .anyInput
    canvas.tool = PKInkingTool(.pen, color: .black, width: 2)
    canvas.backgroundColor = .white
    canvas.isOpaque = true
    canvas.accessibilityLabel = "Draw your signature"
    return canvas
  }
  func updateUIView(_ canvas: PKCanvasView, context: Context) {
    if canvas.drawing != drawing { canvas.drawing = drawing }
  }
  func makeCoordinator() -> Coordinator { Coordinator(self) }
  final class Coordinator: NSObject, PKCanvasViewDelegate {
    var parent: SignatureCanvas
    init(_ parent: SignatureCanvas) { self.parent = parent }
    func canvasViewDrawingDidChange(_ canvasView: PKCanvasView) {
      parent.drawing = canvasView.drawing
    }
  }
}
