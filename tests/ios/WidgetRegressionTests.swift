import Foundation
import WidgetKit

private final class SubHabitFixtureProtocol: URLProtocol {
  override class func canInit(with request: URLRequest) -> Bool {
    request.url?.host == "widget-test.invalid"
  }

  override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

  override func startLoading() {
    let parent = Int(request.url!.pathComponents.dropLast().last!)!
    let data = try! JSONSerialization.data(withJSONObject: [
      ["id": parent * 10, "name": "First step", "order_index": 0],
      ["id": parent * 10 + 1, "name": "Second step", "order_index": 1],
    ])
    let response = HTTPURLResponse(
      url: request.url!, statusCode: 200, httpVersion: nil,
      headerFields: ["Content-Type": "application/json"]
    )!
    client!.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
    client!.urlProtocol(self, didLoad: data)
    client!.urlProtocolDidFinishLoading(self)
  }

  override func stopLoading() {}
}

extension Hue2WidgetLoader {
  fileprivate static func verifyReleaseSubHabitFetch() async throws {
    let payload = (1...3).map { id in
      [
        "id": id, "name": "Routine", "has_counts": false, "is_weight": false,
        "created_at": "2026-09-05T12:00:00Z",
      ] as [String: Any]
    }
    let habits = try JSONDecoder().decode(
      [APIHabit].self, from: JSONSerialization.data(withJSONObject: payload)
    )
    let client = try Hue2APIClient(baseURLString: "https://widget-test.invalid", token: "fixture")
    let loaded = await fetchSubHabits(for: habits, client: client)
    for habit in habits {
      guard loaded[habit.id]?.map(\.id) == [habit.id * 10, habit.id * 10 + 1] else {
        fatalError("Release fetch lost subhabits for parent \(habit.id)")
      }
    }
  }
}

@main
struct WidgetReleaseRegression {
  static func main() async throws {
    URLProtocol.registerClass(SubHabitFixtureProtocol.self)
    try await Hue2WidgetLoader.verifyReleaseSubHabitFetch()

    let subHabits = (1...5).map {
      WidgetSubHabit(id: $0, name: "Step \($0)", checked: $0 == 2)
    }
    for family in [WidgetFamily.systemSmall, .systemMedium, .systemLarge] {
      let first = WidgetSubHabitPage(subHabits: subHabits, family: family, requestedPage: 0)
      let second = WidgetSubHabitPage(subHabits: subHabits, family: family, requestedPage: 1)
      precondition(first.subHabits.map(\.id) == (family == .systemSmall ? [1] : [1, 3]))
      precondition(second.subHabits.map(\.id) == (family == .systemSmall ? [3] : [4, 5]))

      let remaining = subHabits.map {
        WidgetSubHabit(id: $0.id, name: $0.name, checked: $0.id != 1)
      }
      let shrunk = WidgetSubHabitPage(subHabits: remaining, family: family, requestedPage: 3)
      precondition(shrunk.page == 0 && shrunk.subHabits.map(\.id) == [1])
      let completed = subHabits.map {
        WidgetSubHabit(id: $0.id, name: $0.name, checked: true)
      }
      let empty = WidgetSubHabitPage(subHabits: completed, family: family, requestedPage: 3)
      precondition(empty.subHabits.isEmpty && empty.page == 0 && empty.totalPages == 1)
    }
    precondition(WidgetSubHabitPage.nextPage(current: 4, direction: -1, totalPages: 3) == 1)
    precondition(WidgetSubHabitPage.nextPage(current: 0, direction: -1, totalPages: 3) == 0)
    precondition(WidgetSubHabitPage.nextPage(current: 2, direction: 1, totalPages: 3) == 2)
    print("Widget Release regressions passed")
  }
}
