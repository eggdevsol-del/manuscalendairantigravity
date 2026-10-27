import SwiftUI

struct SuppliersView: View {
  @Environment(AppStore.self) private var store
  @State private var search = ""
  var body: some View {
    NativePage(title: "Supplies", subtitle: "Your trusted suppliers") {
      QueryScreen(path: "suppliers.getSuppliers") { data in
        let suppliers = data.array.filter {
          search.isEmpty || $0["name"].string.localizedCaseInsensitiveContains(search)
        }
        if suppliers.isEmpty { Text("No suppliers match.") }
        ForEach(suppliers, id: \.id) { supplier in
          NavigationLink {
            SupplierShop(supplier: supplier)
          } label: {
            NativePanel {
              if let url = URL(string: supplier["logoUrl"].string), url.scheme == "https" {
                AsyncImage(url: url) { image in
                  image.resizable().scaledToFill()
                } placeholder: {
                  Color.clear
                }.frame(height: 100).clipped()
              }
              Text(supplier["name"].string).font(Ivory.heading(27))
              Text(supplier["description"].string).foregroundStyle(Ivory.muted).lineLimit(2)
            }
          }.buttonStyle(.plain)
        }
      }
    }.searchable(text: $search).refreshable { store.invalidate() }
  }
}
struct SupplierShop: View {
  @Environment(AppStore.self) private var store
  let supplier: JSONValue
  @State private var search = ""
  @State private var quantities: [String: Int] = [:]
  @State private var inStock = false
  @State private var cart = false
  private var storageKey: String { "native.cart.\(store.userID).\(supplier.id)" }
  var body: some View {
    NativePage(title: supplier["name"].string) {
      Toggle("In stock only", isOn: $inStock)
      QueryScreen(
        path: "suppliers.getSupplierProducts", input: .object(["supplierId": supplier["id"]])
      ) { data in
        let products = data.array.filter {
          (search.isEmpty || $0["title"].string.localizedCaseInsensitiveContains(search))
            && (!inStock || $0["variants"].array.contains { $0["inventoryCount"].int > 0 })
        }
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 18) {
          ForEach(products, id: \.id) { product in
            ProductTile(product: product, quantities: $quantities)
          }
        }
        if products.isEmpty { Text("No products match.") }
      }
    }.searchable(text: $search).toolbar {
      Button {
        cart = true
      } label: {
        Label("Cart \(quantities.values.reduce(0, +))", systemImage: "cart")
      }
    }
    .sheet(isPresented: $cart) {
      NavigationStack {
        NativePage(title: "Your order") {
          QueryScreen(
            path: "suppliers.getSupplierProducts", input: .object(["supplierId": supplier["id"]])
          ) { products in
            ForEach(products.array, id: \.id) { product in
              ForEach(product["variants"].array, id: \.id) { variant in
                if let count = quantities[variant.id], count > 0 {
                  NativePanel {
                    Text(product["title"].string).font(.headline)
                    Text(variant["title"].string)
                    Stepper(
                      "Quantity: \(min(count, max(0, variant["inventoryCount"].int)))",
                      value: Binding(
                        get: {
                          min(quantities[variant.id] ?? 0, max(0, variant["inventoryCount"].int))
                        }, set: { quantities[variant.id] = $0 }),
                      in: 0...max(0, variant["inventoryCount"].int))
                    Button("Remove", role: .destructive) { quantities[variant.id] = nil }
                  }
                }
              }
            }
          }
          QueryScreen(
            path: "supplierOrders.getShippingRates", input: .object(["supplierId": supplier["id"]])
          ) { shipping in
            ForEach(Array(shipping["rates"].array.enumerated()), id: \.offset) { _, rate in
              MoneyRow(
                title: rate["name"].string, cents: rate["priceCents"].int,
                currency: rate["currency"].string)
            }
          }
          Text(
            "Native supplier checkout is not yet connected. No payment or stock reservation has been created."
          ).foregroundStyle(Ivory.muted)
        }.toolbar { Button("Done") { cart = false } }
      }
    }
    .onAppear {
      if let data = UserDefaults.standard.data(forKey: storageKey),
        let saved = try? JSONDecoder().decode([String: Int].self, from: data)
      {
        quantities = saved.filter { $0.value > 0 }
      }
    }
    .onChange(of: quantities) { _, next in
      if let data = try? JSONEncoder().encode(next) {
        UserDefaults.standard.set(data, forKey: storageKey)
      }
    }
  }
}
struct ProductTile: View {
  let product: JSONValue
  @Binding var quantities: [String: Int]
  @State private var selected = ""
  var body: some View {
    VStack(alignment: .leading, spacing: 10) {
      if let url = URL(string: product["imageUrl"].string), url.scheme == "https" {
        AsyncImage(url: url) { image in
          image.resizable().scaledToFit()
        } placeholder: {
          Image(systemName: "shippingbox").frame(height: 120)
        }.frame(height: 140)
      }
      Text(product["title"].string).font(.headline)
      let variants = product["variants"].array
      Picker("Variant", selection: $selected) {
        Text("Choose variant").tag("")
        ForEach(variants, id: \.id) { Text($0["title"].string).tag($0.id) }
      }.pickerStyle(.menu)
      if let variant = variants.first(where: { $0.id == selected }) {
        Text(
          NativeMoney.format(
            variant["priceCents"].int,
            currency: product["currency"].string.isEmpty ? "AUD" : product["currency"].string))
        let stock = max(0, variant["inventoryCount"].int)
        Stepper(
          "Qty \(min(quantities[selected] ?? 0, stock))",
          value: Binding(
            get: { min(quantities[selected] ?? 0, stock) }, set: { quantities[selected] = $0 }),
          in: 0...stock)
        if stock == 0 {
          Text("Out of stock").font(.caption)
        } else if (quantities[selected] ?? 0) >= stock {
          Text("All available stock is in your cart.").font(.caption)
        }
      }
    }.padding(12).background(Ivory.surface, in: RoundedRectangle(cornerRadius: 16)).onAppear {
      if selected.isEmpty && product["variants"].array.count == 1 {
        selected = product["variants"].array[0].id
      }
    }
  }
}
