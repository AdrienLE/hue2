import AppIntents
import Foundation
import SwiftUI
import WidgetKit

private enum Hue2WidgetConstants {
  static let kind = "Hue2Widget"
  static let appGroup = "group.com.adrienle.hue2"
  static let accessTokenKey = "auth_access_token"
  static let apiBaseURLKey = "api_base_url"
  static let fallbackAPIBaseURL = "https://hue2-production.up.railway.app"
  static let habitPageKey = "habitPage"

  static func subHabitPageKey(_ habitId: Int) -> String {
    "subHabitPage.\(habitId)"
  }
}

struct Hue2WidgetProvider: TimelineProvider {
  func placeholder(in context: Context) -> Hue2WidgetEntry {
    Hue2WidgetEntry.placeholder(family: context.family)
  }

  func getSnapshot(in context: Context, completion: @escaping (Hue2WidgetEntry) -> Void) {
    Task {
      completion(await Hue2WidgetLoader.load(family: context.family))
    }
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> Void) {
    Task {
      let entry = await Hue2WidgetLoader.load(family: context.family)
      let nextRefresh = Calendar.current.date(byAdding: .minute, value: 5, to: Date()) ?? Date()
      completion(Timeline(entries: [entry], policy: .after(nextRefresh)))
    }
  }
}

struct Hue2WidgetEntry: TimelineEntry {
  enum Status {
    case ready
    case signedOut
    case failed(String)
  }

  let date: Date
  let status: Status
  let logicalDate: String
  let habits: [WidgetHabit]
  let page: Int
  let totalPages: Int
  let totalVisibleHabits: Int

  static func placeholder(family: WidgetFamily) -> Hue2WidgetEntry {
    Hue2WidgetEntry(
      date: Date(),
      status: .ready,
      logicalDate: "Today",
      habits: WidgetHabit.previewHabits,
      page: 0,
      totalPages: 2,
      totalVisibleHabits: 5
    )
  }
}

struct WidgetHabit: Identifiable, Hashable {
  enum HabitKind: Hashable {
    case normal
    case count
    case weight
  }

  let id: Int
  let name: String
  let kind: HabitKind
  let colorIndex: Int
  let subHabits: [WidgetSubHabit]
  let countTotal: Double
  let countTarget: Double?
  let countUnit: String?
  let countStep: Double
  let weightCurrent: Double?
  let weightTarget: Double?
  let weightUnit: String?
  let weightStep: Double

  static let previewHabits = [
    WidgetHabit(
      id: 1,
      name: "Morning routine",
      kind: .normal,
      colorIndex: 0,
      subHabits: [
        WidgetSubHabit(id: 11, name: "Stretch", checked: false),
        WidgetSubHabit(id: 12, name: "Water", checked: true),
        WidgetSubHabit(id: 13, name: "Plan", checked: false),
      ],
      countTotal: 0,
      countTarget: nil,
      countUnit: nil,
      countStep: 1,
      weightCurrent: nil,
      weightTarget: nil,
      weightUnit: nil,
      weightStep: 0.1
    ),
    WidgetHabit(
      id: 2,
      name: "Pushups",
      kind: .count,
      colorIndex: 1,
      subHabits: [],
      countTotal: 12,
      countTarget: 20,
      countUnit: "reps",
      countStep: 1,
      weightCurrent: nil,
      weightTarget: nil,
      weightUnit: nil,
      weightStep: 0.1
    ),
  ]
}

struct WidgetSubHabit: Identifiable, Hashable {
  let id: Int
  let name: String
  let checked: Bool
}

struct Hue2WidgetEntryView: View {
  let entry: Hue2WidgetEntry

  @Environment(\.widgetFamily) private var family
  @Environment(\.colorScheme) private var colorScheme

  var body: some View {
    ZStack {
      widgetBackground

      switch entry.status {
      case .ready:
        readyContent
      case .signedOut:
        WidgetMessageView(
          title: "Sign in to Hue 2",
          detail: "Open the app once so the widget can sync your habits.",
          systemImage: "lock"
        )
      case let .failed(message):
        WidgetMessageView(
          title: "Could not load habits",
          detail: message,
          systemImage: "exclamationmark.triangle"
        )
      }
    }
  }

  private var readyContent: some View {
    VStack(alignment: .leading, spacing: family == .systemSmall ? 5 : 7) {
      header

      if entry.habits.isEmpty {
        Spacer(minLength: 0)
        WidgetMessageView(
          title: "All clear",
          detail: "No unchecked habits are scheduled for this page.",
          systemImage: "checkmark.circle"
        )
        Spacer(minLength: 0)
      } else {
        ForEach(entry.habits) { habit in
          WidgetHabitRow(habit: habit, family: family)
        }
      }

      if entry.totalPages > 1 {
        WidgetPageControls(page: entry.page, totalPages: entry.totalPages)
      }
    }
    .padding(widgetPadding)
  }

  private var header: some View {
    HStack(spacing: 6) {
      Text("Hue 2")
        .font(family == .systemSmall ? .caption.weight(.bold) : .headline.weight(.bold))
        .foregroundStyle(.primary)

      if family != .systemSmall {
        Text(entry.logicalDate)
          .font(.caption2.weight(.medium))
          .foregroundStyle(.secondary)
      }

      Spacer(minLength: 4)

      Text("\(entry.totalVisibleHabits)")
        .font(.caption2.weight(.semibold))
        .foregroundStyle(.secondary)
        .padding(.horizontal, 6)
        .padding(.vertical, 3)
        .background(Capsule().fill(Color.primary.opacity(0.07)))
    }
  }

  private var widgetPadding: EdgeInsets {
    switch family {
    case .systemSmall:
      EdgeInsets(top: 10, leading: 10, bottom: 10, trailing: 10)
    default:
      EdgeInsets(top: 12, leading: 12, bottom: 10, trailing: 12)
    }
  }

  private var widgetBackground: some View {
    LinearGradient(
      colors: colorScheme == .dark
        ? [Color(red: 0.08, green: 0.09, blue: 0.10), Color(red: 0.11, green: 0.12, blue: 0.13)]
        : [Color(red: 0.97, green: 0.98, blue: 0.98), Color(red: 0.93, green: 0.96, blue: 0.97)],
      startPoint: .topLeading,
      endPoint: .bottomTrailing
    )
  }
}

private struct WidgetHabitRow: View {
  let habit: WidgetHabit
  let family: WidgetFamily

  @Environment(\.colorScheme) private var colorScheme

  var body: some View {
    HStack(alignment: .top, spacing: 7) {
      Button(intent: CheckHabitIntent(habitId: habit.id)) {
        Image(systemName: "checkmark")
          .font(.system(size: family == .systemSmall ? 10 : 11, weight: .bold))
          .foregroundStyle(.white)
          .frame(width: controlSize, height: controlSize)
          .background(Circle().fill(accentColor))
      }
      .buttonStyle(.plain)

      VStack(alignment: .leading, spacing: 4) {
        HStack(alignment: .firstTextBaseline, spacing: 5) {
          Text(habit.name)
            .font(family == .systemSmall ? .caption2.weight(.semibold) : .caption.weight(.semibold))
            .foregroundStyle(.primary)
            .lineLimit(1)
            .minimumScaleFactor(0.72)

          Spacer(minLength: 4)

          metric
        }

        if family != .systemSmall {
          switch habit.kind {
          case .normal:
            WidgetSubHabitGrid(habit: habit, family: family)
          case .count:
            WidgetProgressBar(total: habit.countTotal, target: habit.countTarget, accent: accentColor)
          case .weight:
            if let target = habit.weightTarget, let current = habit.weightCurrent {
              Text(weightDeltaText(current: current, target: target))
                .font(.caption2)
                .foregroundStyle(.secondary)
                .lineLimit(1)
            }
          }
        }
      }

      if habit.kind == .count {
        WidgetCountControls(habit: habit, controlSize: controlSize)
      } else if habit.kind == .weight {
        WidgetWeightControls(habit: habit, controlSize: controlSize)
      }
    }
    .padding(.vertical, family == .systemSmall ? 6 : 7)
    .padding(.leading, 7)
    .padding(.trailing, 7)
    .background(
      RoundedRectangle(cornerRadius: 8, style: .continuous)
        .fill(cardColor)
    )
    .overlay(alignment: .leading) {
      RoundedRectangle(cornerRadius: 3, style: .continuous)
        .fill(accentColor)
        .frame(width: 3)
        .padding(.vertical, 7)
    }
  }

  @ViewBuilder
  private var metric: some View {
    switch habit.kind {
    case .normal:
      if !habit.subHabits.isEmpty {
        let checked = habit.subHabits.filter(\.checked).count
        Text("\(checked)/\(habit.subHabits.count)")
          .font(.caption2.weight(.semibold))
          .foregroundStyle(.secondary)
      }
    case .count:
      Text(countText)
        .font(.caption2.weight(.semibold))
        .foregroundStyle(.secondary)
        .lineLimit(1)
        .minimumScaleFactor(0.7)
    case .weight:
      Text(weightText)
        .font(.caption2.weight(.semibold))
        .foregroundStyle(.secondary)
        .lineLimit(1)
        .minimumScaleFactor(0.7)
    }
  }

  private var countText: String {
    let total = formatNumber(habit.countTotal)
    if let target = habit.countTarget, target > 0 {
      return "\(total)/\(formatNumber(target)) \(habit.countUnit ?? "")"
    }
    return "\(total) \(habit.countUnit ?? "")"
  }

  private var weightText: String {
    guard let current = habit.weightCurrent else {
      return "-- \(habit.weightUnit ?? "")"
    }
    return "\(formatNumber(current)) \(habit.weightUnit ?? "")"
  }

  private var controlSize: CGFloat {
    family == .systemSmall ? 22 : 24
  }

  private var accentColor: Color {
    Color.hue2Habit(index: habit.colorIndex, darkMode: colorScheme == .dark)
  }

  private var cardColor: Color {
    colorScheme == .dark
      ? Color(red: 0.14, green: 0.15, blue: 0.16).opacity(0.96)
      : Color.white.opacity(0.92)
  }

  private func weightDeltaText(current: Double, target: Double) -> String {
    let delta = current - target
    if abs(delta) <= 0.5 {
      return "On target"
    }

    return "\(formatNumber(abs(delta))) \(habit.weightUnit ?? "") \(delta > 0 ? "above" : "below")"
  }
}

private struct WidgetSubHabitGrid: View {
  let habit: WidgetHabit
  let family: WidgetFamily

  var body: some View {
    if !habit.subHabits.isEmpty {
      VStack(alignment: .leading, spacing: 3) {
        LazyVGrid(columns: columns, alignment: .leading, spacing: 3) {
          ForEach(visibleSubHabits) { subHabit in
            Button(
              intent: ToggleSubHabitIntent(
                parentHabitId: habit.id,
                subHabitId: subHabit.id,
                currentlyChecked: subHabit.checked
              )
            ) {
              HStack(spacing: 3) {
                Image(systemName: subHabit.checked ? "checkmark.circle.fill" : "circle")
                  .font(.system(size: 9, weight: .semibold))
                Text(subHabit.name)
                  .strikethrough(subHabit.checked, color: .secondary)
                  .lineLimit(1)
                  .minimumScaleFactor(0.7)
              }
              .font(.caption2)
              .foregroundStyle(subHabit.checked ? .secondary : .primary)
              .padding(.horizontal, 5)
              .padding(.vertical, 3)
              .frame(maxWidth: .infinity, alignment: .leading)
              .background(Capsule().fill(Color.primary.opacity(subHabit.checked ? 0.05 : 0.08)))
            }
            .buttonStyle(.plain)
          }
        }

        if totalPages > 1 {
          HStack(spacing: 6) {
            Button(
              intent: PageSubHabitsIntent(habitId: habit.id, direction: -1, totalPages: totalPages)
            ) {
              Image(systemName: "chevron.left")
            }
            .buttonStyle(.plain)
            .disabled(page <= 0)

            Text("\(page + 1)/\(totalPages)")
              .font(.caption2.monospacedDigit())
              .foregroundStyle(.secondary)

            Button(
              intent: PageSubHabitsIntent(habitId: habit.id, direction: 1, totalPages: totalPages)
            ) {
              Image(systemName: "chevron.right")
            }
            .buttonStyle(.plain)
            .disabled(page >= totalPages - 1)
          }
          .font(.caption2.weight(.semibold))
          .foregroundStyle(.secondary)
        }
      }
    }
  }

  private var columns: [GridItem] {
    [GridItem(.flexible(), spacing: 3), GridItem(.flexible(), spacing: 3)]
  }

  private var capacity: Int {
    family == .systemMedium ? 4 : 6
  }

  private var totalPages: Int {
    max(1, Int(ceil(Double(habit.subHabits.count) / Double(capacity))))
  }

  private var page: Int {
    min(max(UserDefaults.standard.integer(forKey: Hue2WidgetConstants.subHabitPageKey(habit.id)), 0), totalPages - 1)
  }

  private var visibleSubHabits: [WidgetSubHabit] {
    let start = min(page * capacity, habit.subHabits.count)
    let end = min(start + capacity, habit.subHabits.count)
    return Array(habit.subHabits[start..<end])
  }
}

private struct WidgetCountControls: View {
  let habit: WidgetHabit
  let controlSize: CGFloat

  var body: some View {
    VStack(spacing: 4) {
      Button(
        intent: AdjustCountIntent(
          habitId: habit.id,
          delta: habit.countStep,
          currentTotal: habit.countTotal
        )
      ) {
        Image(systemName: "plus")
          .frame(width: controlSize, height: controlSize)
      }
      .buttonStyle(.plain)

      Button(
        intent: AdjustCountIntent(
          habitId: habit.id,
          delta: -habit.countStep,
          currentTotal: habit.countTotal
        )
      ) {
        Image(systemName: "minus")
          .frame(width: controlSize, height: controlSize)
      }
      .buttonStyle(.plain)
    }
    .font(.caption.weight(.bold))
    .foregroundStyle(.secondary)
  }
}

private struct WidgetWeightControls: View {
  let habit: WidgetHabit
  let controlSize: CGFloat

  var body: some View {
    VStack(spacing: 4) {
      Button(
        intent: AdjustWeightIntent(
          habitId: habit.id,
          direction: 1,
          currentWeight: habit.weightCurrent ?? 0,
          step: habit.weightStep
        )
      ) {
        Image(systemName: "plus")
          .frame(width: controlSize, height: controlSize)
      }
      .buttonStyle(.plain)

      Button(
        intent: AdjustWeightIntent(
          habitId: habit.id,
          direction: -1,
          currentWeight: habit.weightCurrent ?? 0,
          step: habit.weightStep
        )
      ) {
        Image(systemName: "minus")
          .frame(width: controlSize, height: controlSize)
      }
      .buttonStyle(.plain)
    }
    .font(.caption.weight(.bold))
    .foregroundStyle(.secondary)
  }
}

private struct WidgetProgressBar: View {
  let total: Double
  let target: Double?
  let accent: Color

  var body: some View {
    GeometryReader { proxy in
      let progress = target.map { $0 > 0 ? min(max(total / $0, 0), 1) : 0 } ?? 0
      ZStack(alignment: .leading) {
        Capsule().fill(Color.primary.opacity(0.08))
        Capsule()
          .fill(accent.opacity(0.85))
          .frame(width: proxy.size.width * progress)
      }
    }
    .frame(height: 4)
  }
}

private struct WidgetPageControls: View {
  let page: Int
  let totalPages: Int

  var body: some View {
    HStack(spacing: 8) {
      Button(intent: PageHabitsIntent(direction: -1, totalPages: totalPages)) {
        Image(systemName: "chevron.left")
          .frame(width: 22, height: 20)
      }
      .buttonStyle(.plain)
      .disabled(page <= 0)

      Spacer(minLength: 0)

      Text("\(page + 1)/\(totalPages)")
        .font(.caption2.monospacedDigit().weight(.semibold))
        .foregroundStyle(.secondary)

      Spacer(minLength: 0)

      Button(intent: PageHabitsIntent(direction: 1, totalPages: totalPages)) {
        Image(systemName: "chevron.right")
          .frame(width: 22, height: 20)
      }
      .buttonStyle(.plain)
      .disabled(page >= totalPages - 1)
    }
    .foregroundStyle(.secondary)
    .padding(.top, 1)
  }
}

private struct WidgetMessageView: View {
  let title: String
  let detail: String
  let systemImage: String

  var body: some View {
    VStack(spacing: 7) {
      Image(systemName: systemImage)
        .font(.title3.weight(.semibold))
        .foregroundStyle(.secondary)
      Text(title)
        .font(.caption.weight(.semibold))
        .foregroundStyle(.primary)
        .multilineTextAlignment(.center)
      Text(detail)
        .font(.caption2)
        .foregroundStyle(.secondary)
        .multilineTextAlignment(.center)
        .lineLimit(3)

      if let url = URL(string: "hue2://") {
        Link(destination: url) {
          Text("Open app")
            .font(.caption2.weight(.semibold))
        }
      }
    }
    .padding(10)
  }
}

struct Hue2Widget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: Hue2WidgetConstants.kind, provider: Hue2WidgetProvider()) { entry in
      Hue2WidgetEntryView(entry: entry)
        .containerBackground(.clear, for: .widget)
    }
    .configurationDisplayName("Hue 2 Habits")
    .description("Check off habits, subhabits, counts, and weights from your home screen.")
    .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
  }
}

private enum Hue2WidgetLoader {
  static func load(family: WidgetFamily) async -> Hue2WidgetEntry {
    guard let token = Hue2WidgetStore.read(Hue2WidgetConstants.accessTokenKey) else {
      return Hue2WidgetEntry(
        date: Date(),
        status: .signedOut,
        logicalDate: "Today",
        habits: [],
        page: 0,
        totalPages: 1,
        totalVisibleHabits: 0
      )
    }

    let apiBaseURL = Hue2WidgetStore.read(Hue2WidgetConstants.apiBaseURLKey)
      ?? Hue2WidgetConstants.fallbackAPIBaseURL

    do {
      let client = try Hue2APIClient(baseURLString: apiBaseURL, token: token)
      async let userRequest = client.fetchUser()
      async let habitsRequest = client.fetchHabits()

      let user = try await userRequest
      let habits = try await habitsRequest
      let rolloverHour = user.settings?.dayRolloverHour ?? 3
      let window = LogicalDayWindow.current(rolloverHour: rolloverHour)

      async let checksRequest = client.fetchChecks(start: window.start, end: window.end)
      async let countsRequest = client.fetchCounts(start: window.start, end: window.end)
      async let weightsRequest = client.fetchWeightUpdates(limit: 500)

      let checks = try await checksRequest
      let counts = try await countsRequest
      let weights = try await weightsRequest
      let checkedHabitIds = Set(
        checks.compactMap { check in
          check.checked && check.subHabitId == nil ? check.habitId : nil
        }
      )

      let sortedHabits = habits
        .filter { $0.deletedAt == nil && ($0.displaySettings?.hidden != true) }
        .sorted(by: sortHabits)
      let colorIndexByHabitId = Dictionary(uniqueKeysWithValues: sortedHabits.enumerated().map { ($0.element.id, $0.offset) })

      let visibleHabits = sortedHabits.filter { habit in
        let weekdays = habit.scheduleSettings?.weekdays ?? [0, 1, 2, 3, 4, 5, 6]
        return weekdays.contains(window.dayOfWeek) && !checkedHabitIds.contains(habit.id)
      }

      let capacity = habitCapacity(for: family)
      let totalPages = max(1, Int(ceil(Double(visibleHabits.count) / Double(capacity))))
      let requestedPage = UserDefaults.standard.integer(forKey: Hue2WidgetConstants.habitPageKey)
      let page = min(max(requestedPage, 0), totalPages - 1)
      if page != requestedPage {
        UserDefaults.standard.set(page, forKey: Hue2WidgetConstants.habitPageKey)
      }

      let start = min(page * capacity, visibleHabits.count)
      let end = min(start + capacity, visibleHabits.count)
      let pageHabits = Array(visibleHabits[start..<end])
      let subHabitsByParent = await fetchSubHabits(for: pageHabits, client: client)
      let checkedSubHabitIds = Set(
        checks.compactMap { check in
          check.checked ? check.subHabitId : nil
        }
      )
      let countsByHabit = Dictionary(grouping: counts, by: \.habitId)
      let latestWeightByHabit = latestWeightsByHabit(weights)

      let widgetHabits = pageHabits.map { habit in
        let subHabits = (subHabitsByParent[habit.id] ?? [])
          .sorted { $0.orderIndex < $1.orderIndex }
          .map {
            WidgetSubHabit(
              id: $0.id,
              name: $0.name,
              checked: checkedSubHabitIds.contains($0.id)
            )
          }

        let countTotal = countsByHabit[habit.id]?.reduce(0) { $0 + $1.value } ?? 0
        let latestWeight = latestWeightByHabit[habit.id]?.weight
          ?? habit.weightSettings?.startingWeight

        return WidgetHabit(
          id: habit.id,
          name: habit.name,
          kind: habit.kind,
          colorIndex: colorIndexByHabitId[habit.id] ?? 0,
          subHabits: subHabits,
          countTotal: countTotal,
          countTarget: habit.countSettings?.target,
          countUnit: habit.countSettings?.unit,
          countStep: max(habit.countSettings?.stepSize ?? 1, 0.1),
          weightCurrent: latestWeight,
          weightTarget: habit.weightSettings?.targetWeight,
          weightUnit: habit.weightSettings?.unit,
          weightStep: max(habit.weightSettings?.stepSize ?? 0.1, 0.1)
        )
      }

      return Hue2WidgetEntry(
        date: Date(),
        status: .ready,
        logicalDate: window.label,
        habits: widgetHabits,
        page: page,
        totalPages: totalPages,
        totalVisibleHabits: visibleHabits.count
      )
    } catch {
      return Hue2WidgetEntry(
        date: Date(),
        status: .failed("Open the app if your session recently changed."),
        logicalDate: "Today",
        habits: [],
        page: 0,
        totalPages: 1,
        totalVisibleHabits: 0
      )
    }
  }

  private static func habitCapacity(for family: WidgetFamily) -> Int {
    switch family {
    case .systemSmall:
      return 2
    case .systemMedium:
      return 3
    case .systemLarge:
      return 4
    default:
      return 3
    }
  }

  private static func sortHabits(_ lhs: APIHabit, _ rhs: APIHabit) -> Bool {
    let lhsOrder = lhs.displaySettings?.order ?? 999
    let rhsOrder = rhs.displaySettings?.order ?? 999
    if lhsOrder != rhsOrder {
      return lhsOrder < rhsOrder
    }
    return lhs.createdAt < rhs.createdAt
  }

  private static func fetchSubHabits(
    for habits: [APIHabit],
    client: Hue2APIClient
  ) async -> [Int: [APISubHabit]] {
    await withTaskGroup(of: (Int, [APISubHabit]).self) { group in
      for habit in habits {
        group.addTask {
          do {
            return (habit.id, try await client.fetchSubHabits(habitId: habit.id))
          } catch {
            return (habit.id, [])
          }
        }
      }

      var result: [Int: [APISubHabit]] = [:]
      for await (habitId, subHabits) in group {
        result[habitId] = subHabits
      }
      return result
    }
  }

  private static func latestWeightsByHabit(_ weights: [APIWeightUpdate]) -> [Int: APIWeightUpdate] {
    let sorted = weights.sorted { $0.updateDate > $1.updateDate }
    var latest: [Int: APIWeightUpdate] = [:]
    for weight in sorted where latest[weight.habitId] == nil {
      latest[weight.habitId] = weight
    }
    return latest
  }
}

private enum Hue2WidgetStore {
  static func read(_ key: String) -> String? {
    UserDefaults(suiteName: Hue2WidgetConstants.appGroup)?.string(forKey: key)
  }
}

private struct Hue2APIClient {
  let baseURLString: String
  let token: String

  init(baseURLString: String, token: String) throws {
    let trimmed = baseURLString.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
    guard URL(string: trimmed) != nil else {
      throw Hue2APIError.invalidBaseURL
    }
    self.baseURLString = trimmed
    self.token = token
  }

  func fetchUser() async throws -> APIUser {
    try await request("/api/users/me")
  }

  func fetchHabits() async throws -> [APIHabit] {
    try await request("/api/habits", query: [URLQueryItem(name: "include_deleted", value: "false")])
  }

  func fetchSubHabits(habitId: Int) async throws -> [APISubHabit] {
    try await request("/api/habits/\(habitId)/sub-habits")
  }

  func fetchChecks(start: Date, end: Date) async throws -> [APICheck] {
    try await request(
      "/api/checks",
      query: [
        URLQueryItem(name: "start_date", value: isoString(start)),
        URLQueryItem(name: "end_date", value: isoString(end)),
        URLQueryItem(name: "limit", value: "500"),
      ]
    )
  }

  func fetchChecks(habitId: Int, subHabitId: Int, start: Date, end: Date) async throws -> [APICheck] {
    try await request(
      "/api/checks",
      query: [
        URLQueryItem(name: "habit_id", value: String(habitId)),
        URLQueryItem(name: "sub_habit_id", value: String(subHabitId)),
        URLQueryItem(name: "start_date", value: isoString(start)),
        URLQueryItem(name: "end_date", value: isoString(end)),
        URLQueryItem(name: "limit", value: "100"),
      ]
    )
  }

  func fetchCounts(start: Date, end: Date) async throws -> [APICount] {
    try await request(
      "/api/counts",
      query: [
        URLQueryItem(name: "start_date", value: isoString(start)),
        URLQueryItem(name: "end_date", value: isoString(end)),
        URLQueryItem(name: "limit", value: "500"),
      ]
    )
  }

  func fetchWeightUpdates(limit: Int) async throws -> [APIWeightUpdate] {
    try await request(
      "/api/weight-updates",
      query: [URLQueryItem(name: "limit", value: String(limit))]
    )
  }

  func createCheck(habitId: Int, subHabitId: Int? = nil, date: Date) async throws {
    var body: [String: Any] = [
      "habit_id": habitId,
      "checked": true,
      "check_date": isoString(date),
    ]
    if let subHabitId {
      body["sub_habit_id"] = subHabitId
    }
    try await send("/api/checks", method: "POST", body: body)
  }

  func deleteCheck(checkId: Int) async throws {
    try await send("/api/checks/\(checkId)", method: "DELETE")
  }

  func createCount(habitId: Int, value: Double, date: Date) async throws {
    try await send(
      "/api/counts",
      method: "POST",
      body: [
        "habit_id": habitId,
        "value": value,
        "count_date": isoString(date),
      ]
    )
  }

  func createWeight(habitId: Int, weight: Double, date: Date) async throws {
    try await send(
      "/api/weight-updates",
      method: "POST",
      body: [
        "habit_id": habitId,
        "weight": weight,
        "update_date": isoString(date),
      ]
    )
  }

  private func request<T: Decodable>(
    _ path: String,
    query: [URLQueryItem] = []
  ) async throws -> T {
    let data = try await send(path, method: "GET", query: query)
    return try JSONDecoder().decode(T.self, from: data)
  }

  @discardableResult
  private func send(
    _ path: String,
    method: String,
    query: [URLQueryItem] = [],
    body: [String: Any]? = nil
  ) async throws -> Data {
    guard var components = URLComponents(string: "\(baseURLString)\(path)") else {
      throw Hue2APIError.invalidURL
    }
    components.queryItems = query.isEmpty ? nil : query

    guard let url = components.url else {
      throw Hue2APIError.invalidURL
    }

    var request = URLRequest(url: url)
    request.httpMethod = method
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
    if let body {
      request.httpBody = try JSONSerialization.data(withJSONObject: body)
    }

    let (data, response) = try await URLSession.shared.data(for: request)
    guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
      throw Hue2APIError.requestFailed
    }
    return data
  }
}

private enum Hue2WidgetActions {
  static func client() throws -> Hue2APIClient {
    guard let token = Hue2WidgetStore.read(Hue2WidgetConstants.accessTokenKey) else {
      throw Hue2APIError.missingToken
    }

    let baseURL = Hue2WidgetStore.read(Hue2WidgetConstants.apiBaseURLKey)
      ?? Hue2WidgetConstants.fallbackAPIBaseURL
    return try Hue2APIClient(baseURLString: baseURL, token: token)
  }

  static func logicalWindow(client: Hue2APIClient) async -> LogicalDayWindow {
    do {
      let user = try await client.fetchUser()
      return LogicalDayWindow.current(rolloverHour: user.settings?.dayRolloverHour ?? 3)
    } catch {
      return LogicalDayWindow.current(rolloverHour: 3)
    }
  }

  static func checkHabit(habitId: Int) async throws {
    let client = try client()
    let window = await logicalWindow(client: client)
    try await client.createCheck(habitId: habitId, date: window.reference)
    WidgetCenter.shared.reloadTimelines(ofKind: Hue2WidgetConstants.kind)
  }

  static func toggleSubHabit(parentHabitId: Int, subHabitId: Int, currentlyChecked: Bool) async throws {
    let client = try client()
    let window = await logicalWindow(client: client)

    if currentlyChecked {
      let checks = try await client.fetchChecks(
        habitId: parentHabitId,
        subHabitId: subHabitId,
        start: window.start,
        end: window.end
      )
      for check in checks {
        try await client.deleteCheck(checkId: check.id)
      }
    } else {
      try await client.createCheck(habitId: parentHabitId, subHabitId: subHabitId, date: window.reference)
    }

    WidgetCenter.shared.reloadTimelines(ofKind: Hue2WidgetConstants.kind)
  }

  static func adjustCount(habitId: Int, delta: Double, currentTotal: Double) async throws {
    guard currentTotal + delta >= 0 else {
      return
    }

    let client = try client()
    let window = await logicalWindow(client: client)
    try await client.createCount(habitId: habitId, value: delta, date: window.reference)
    WidgetCenter.shared.reloadTimelines(ofKind: Hue2WidgetConstants.kind)
  }

  static func adjustWeight(habitId: Int, direction: Int, currentWeight: Double, step: Double) async throws {
    if direction < 0 && currentWeight <= 0 {
      return
    }

    let signedStep = direction >= 0 ? step : -step
    let next = max(0.1, roundToTenths(currentWeight + signedStep))
    let client = try client()
    let window = await logicalWindow(client: client)
    try await client.createWeight(habitId: habitId, weight: next, date: window.reference)
    WidgetCenter.shared.reloadTimelines(ofKind: Hue2WidgetConstants.kind)
  }
}

struct CheckHabitIntent: AppIntent {
  static let title: LocalizedStringResource = "Check Habit"
  static var openAppWhenRun = false

  @Parameter(title: "Habit ID")
  var habitId: Int

  init() {}

  init(habitId: Int) {
    self.habitId = habitId
  }

  func perform() async throws -> some IntentResult {
    try await Hue2WidgetActions.checkHabit(habitId: habitId)
    return .result()
  }
}

struct ToggleSubHabitIntent: AppIntent {
  static let title: LocalizedStringResource = "Toggle Subhabit"
  static var openAppWhenRun = false

  @Parameter(title: "Parent Habit ID")
  var parentHabitId: Int

  @Parameter(title: "Subhabit ID")
  var subHabitId: Int

  @Parameter(title: "Currently Checked")
  var currentlyChecked: Bool

  init() {}

  init(parentHabitId: Int, subHabitId: Int, currentlyChecked: Bool) {
    self.parentHabitId = parentHabitId
    self.subHabitId = subHabitId
    self.currentlyChecked = currentlyChecked
  }

  func perform() async throws -> some IntentResult {
    try await Hue2WidgetActions.toggleSubHabit(
      parentHabitId: parentHabitId,
      subHabitId: subHabitId,
      currentlyChecked: currentlyChecked
    )
    return .result()
  }
}

struct AdjustCountIntent: AppIntent {
  static let title: LocalizedStringResource = "Adjust Count"
  static var openAppWhenRun = false

  @Parameter(title: "Habit ID")
  var habitId: Int

  @Parameter(title: "Delta")
  var delta: Double

  @Parameter(title: "Current Total")
  var currentTotal: Double

  init() {}

  init(habitId: Int, delta: Double, currentTotal: Double) {
    self.habitId = habitId
    self.delta = delta
    self.currentTotal = currentTotal
  }

  func perform() async throws -> some IntentResult {
    try await Hue2WidgetActions.adjustCount(
      habitId: habitId,
      delta: delta,
      currentTotal: currentTotal
    )
    return .result()
  }
}

struct AdjustWeightIntent: AppIntent {
  static let title: LocalizedStringResource = "Adjust Weight"
  static var openAppWhenRun = false

  @Parameter(title: "Habit ID")
  var habitId: Int

  @Parameter(title: "Direction")
  var direction: Int

  @Parameter(title: "Current Weight")
  var currentWeight: Double

  @Parameter(title: "Step")
  var step: Double

  init() {}

  init(habitId: Int, direction: Int, currentWeight: Double, step: Double) {
    self.habitId = habitId
    self.direction = direction
    self.currentWeight = currentWeight
    self.step = step
  }

  func perform() async throws -> some IntentResult {
    try await Hue2WidgetActions.adjustWeight(
      habitId: habitId,
      direction: direction,
      currentWeight: currentWeight,
      step: step
    )
    return .result()
  }
}

struct PageHabitsIntent: AppIntent {
  static let title: LocalizedStringResource = "Page Habits"
  static var openAppWhenRun = false

  @Parameter(title: "Direction")
  var direction: Int

  @Parameter(title: "Total Pages")
  var totalPages: Int

  init() {}

  init(direction: Int, totalPages: Int) {
    self.direction = direction
    self.totalPages = totalPages
  }

  func perform() async throws -> some IntentResult {
    let current = UserDefaults.standard.integer(forKey: Hue2WidgetConstants.habitPageKey)
    let next = min(max(current + direction, 0), max(totalPages - 1, 0))
    UserDefaults.standard.set(next, forKey: Hue2WidgetConstants.habitPageKey)
    WidgetCenter.shared.reloadTimelines(ofKind: Hue2WidgetConstants.kind)
    return .result()
  }
}

struct PageSubHabitsIntent: AppIntent {
  static let title: LocalizedStringResource = "Page Subhabits"
  static var openAppWhenRun = false

  @Parameter(title: "Habit ID")
  var habitId: Int

  @Parameter(title: "Direction")
  var direction: Int

  @Parameter(title: "Total Pages")
  var totalPages: Int

  init() {}

  init(habitId: Int, direction: Int, totalPages: Int) {
    self.habitId = habitId
    self.direction = direction
    self.totalPages = totalPages
  }

  func perform() async throws -> some IntentResult {
    let key = Hue2WidgetConstants.subHabitPageKey(habitId)
    let current = UserDefaults.standard.integer(forKey: key)
    let next = min(max(current + direction, 0), max(totalPages - 1, 0))
    UserDefaults.standard.set(next, forKey: key)
    WidgetCenter.shared.reloadTimelines(ofKind: Hue2WidgetConstants.kind)
    return .result()
  }
}

private struct APIUser: Decodable {
  let settings: APIUserSettings?
}

private struct APIUserSettings: Decodable {
  let dayRolloverHour: Int?

  enum CodingKeys: String, CodingKey {
    case dayRolloverHour = "day_rollover_hour"
  }
}

private struct APIHabit: Decodable {
  let id: Int
  let name: String
  let hasCounts: Bool
  let isWeight: Bool
  let countSettings: APICountSettings?
  let weightSettings: APIWeightSettings?
  let scheduleSettings: APIScheduleSettings?
  let displaySettings: APIDisplaySettings?
  let deletedAt: String?
  let createdAt: String

  var kind: WidgetHabit.HabitKind {
    if hasCounts {
      return .count
    }
    if isWeight {
      return .weight
    }
    return .normal
  }

  enum CodingKeys: String, CodingKey {
    case id
    case name
    case hasCounts = "has_counts"
    case isWeight = "is_weight"
    case countSettings = "count_settings"
    case weightSettings = "weight_settings"
    case scheduleSettings = "schedule_settings"
    case displaySettings = "display_settings"
    case deletedAt = "deleted_at"
    case createdAt = "created_at"
  }
}

private struct APICountSettings: Decodable {
  let target: Double?
  let unit: String?
  let stepSize: Double?

  enum CodingKeys: String, CodingKey {
    case target
    case unit
    case stepSize = "step_size"
  }
}

private struct APIWeightSettings: Decodable {
  let targetWeight: Double?
  let startingWeight: Double?
  let unit: String?
  let stepSize: Double?

  enum CodingKeys: String, CodingKey {
    case targetWeight = "target_weight"
    case startingWeight = "starting_weight"
    case unit
    case stepSize = "step_size"
  }
}

private struct APIScheduleSettings: Decodable {
  let weekdays: [Int]?
}

private struct APIDisplaySettings: Decodable {
  let order: Int?
  let hidden: Bool?
}

private struct APISubHabit: Decodable {
  let id: Int
  let name: String
  let orderIndex: Int

  enum CodingKeys: String, CodingKey {
    case id
    case name
    case orderIndex = "order_index"
  }
}

private struct APICheck: Decodable {
  let id: Int
  let habitId: Int?
  let subHabitId: Int?
  let checked: Bool

  enum CodingKeys: String, CodingKey {
    case id
    case habitId = "habit_id"
    case subHabitId = "sub_habit_id"
    case checked
  }
}

private struct APICount: Decodable {
  let habitId: Int
  let value: Double

  enum CodingKeys: String, CodingKey {
    case habitId = "habit_id"
    case value
  }
}

private struct APIWeightUpdate: Decodable {
  let habitId: Int
  let weight: Double
  let updateDate: String

  enum CodingKeys: String, CodingKey {
    case habitId = "habit_id"
    case weight
    case updateDate = "update_date"
  }
}

private struct LogicalDayWindow {
  let reference: Date
  let start: Date
  let end: Date
  let dayOfWeek: Int
  let label: String

  static func current(rolloverHour: Int) -> LogicalDayWindow {
    let reference = Date()
    let calendar = Calendar.current
    let hour = calendar.component(.hour, from: reference)
    let logicalDate = hour < rolloverHour
      ? calendar.date(byAdding: .day, value: -1, to: reference) ?? reference
      : reference
    var components = calendar.dateComponents([.year, .month, .day], from: logicalDate)
    components.hour = rolloverHour
    components.minute = 0
    components.second = 0

    let start = calendar.date(from: components) ?? reference
    let end = calendar.date(byAdding: .day, value: 1, to: start) ?? reference
    let dayOfWeek = calendar.component(.weekday, from: start) - 1

    let formatter = DateFormatter()
    formatter.dateFormat = "EEE, MMM d"

    return LogicalDayWindow(
      reference: reference,
      start: start,
      end: end,
      dayOfWeek: dayOfWeek,
      label: formatter.string(from: start)
    )
  }
}

private enum Hue2APIError: Error {
  case invalidBaseURL
  case invalidURL
  case missingToken
  case requestFailed
}

private func isoString(_ date: Date) -> String {
  let formatter = ISO8601DateFormatter()
  formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
  return formatter.string(from: date)
}

private func roundToTenths(_ value: Double) -> Double {
  (value * 10).rounded() / 10
}

private func formatNumber(_ value: Double) -> String {
  if value.rounded() == value {
    return String(Int(value))
  }
  return String(format: "%.1f", value)
}

private extension Color {
  static func hue2Habit(index: Int, darkMode: Bool) -> Color {
    let goldenAngle = 137.508
    let hue = ((200 + Double(index) * goldenAngle).truncatingRemainder(dividingBy: 360)) / 360
    let saturation = darkMode ? 0.42 : 0.48
    let brightness = darkMode ? 0.82 : 0.72
    return Color(hue: hue, saturation: saturation, brightness: brightness)
  }
}
