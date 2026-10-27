import PhotosUI
import SwiftUI

extension AppStore {
  func uploadImage(_ item: PhotosPickerItem) async throws -> String {
    guard let data = try await item.loadTransferable(type: Data.self),
      let image = UIImage(data: data), let jpeg = image.jpegData(compressionQuality: 0.85),
      jpeg.count <= 8_000_000
    else { throw APIError("This image could not be prepared under 8 MB. Choose a smaller image.") }
    let result = try await mutate(
      "upload.uploadImage",
      .object([
        "fileData": .string(jpeg.base64EncodedString()),
        "fileName": .string(UUID().uuidString + ".jpg"), "contentType": .string("image/jpeg"),
        "folder": .string("uploads"),
      ]))
    guard let url = URL(string: result["url"].string), url.scheme == "https" else {
      throw APIError("The uploaded image address could not be verified.")
    }
    return url.absoluteString
  }
}
