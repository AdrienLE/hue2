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
  static let refreshIntervalMinutes = 5

  static func subHabitPageKey(_ habitId: Int) -> String {
    "subHabitPage.\(habitId)"
  }
}

struct Hue2WidgetProvider: TimelineProvider {
  func placeholder(in context: Context) -> Hue2WidgetEntry {
    Hue2WidgetEntry.placeholder(family: context.family)
  }

  func getSnapshot(in context: Context, completion: @escaping (Hue2WidgetEntry) -> Void) {
    if context.isPreview {
      completion(Hue2WidgetEntry.placeholder(family: context.family))
      return
    }

    Task {
      completion(await Hue2WidgetLoader.load(family: context.family))
    }
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> Void) {
    Task {
      let entry = await Hue2WidgetLoader.load(family: context.family)
      let nextRefresh =
        Calendar.current.date(
          byAdding: .minute,
          value: Hue2WidgetConstants.refreshIntervalMinutes,
          to: Date()
        ) ?? Date()
      completion(Timeline(entries: [entry], policy: .after(nextRefresh)))
    }
  }
}

struct Hue2WidgetEntry: TimelineEntry {
  enum Status {
    case ready
    case pendingDailyReview(WidgetDailyReview)
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
  let completedScheduledHabits: Int
  let totalScheduledHabits: Int

  static func placeholder(family: WidgetFamily) -> Hue2WidgetEntry {
    Hue2WidgetEntry(
      date: Date(),
      status: .ready,
      logicalDate: "Today",
      habits: WidgetHabit.previewHabits,
      page: 0,
      totalPages: 2,
      totalVisibleHabits: 5,
      completedScheduledHabits: 3,
      totalScheduledHabits: 8
    )
  }
}

struct WidgetDailyReview: Hashable {
  let reviewDate: String
  let penaltyTotal: Double

  var actionTitle: String {
    penaltyTotal > 0 ? "Apply \(formatNumber(penaltyTotal))" : "Done"
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
  let colorBrightness: Double?
  let colorSaturation: Double?
  let subHabits: [WidgetSubHabit]
  let checkedSubHabitCount: Int
  let totalSubHabitCount: Int
  let countTotal: Double
  let countTarget: Double?
  let countUnit: String?
  let countStep: Double
  let countIsGood: Bool
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
      colorBrightness: nil,
      colorSaturation: nil,
      subHabits: [
        WidgetSubHabit(id: 11, name: "Stretch", checked: false),
        WidgetSubHabit(id: 13, name: "Plan", checked: false),
      ],
      checkedSubHabitCount: 1,
      totalSubHabitCount: 3,
      countTotal: 0,
      countTarget: nil,
      countUnit: nil,
      countStep: 1,
      countIsGood: true,
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
      colorBrightness: nil,
      colorSaturation: nil,
      subHabits: [],
      checkedSubHabitCount: 0,
      totalSubHabitCount: 0,
      countTotal: 12,
      countTarget: 20,
      countUnit: "reps",
      countStep: 1,
      countIsGood: true,
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
      case .ready, .pendingDailyReview:
        readyContent
      case .signedOut:
        WidgetMessageView(
          title: "Sign in to Swoosh",
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
    GeometryReader { geometry in
      let isCompactWidget = geometry.size.width < 220
      let resolvedRowHeight = rowHeight(
        totalHeight: geometry.size.height,
        visibleHabitCount: entry.habits.count
      )

      VStack(alignment: .leading, spacing: 0) {
        header(compact: isCompactWidget)
          .frame(height: headerHeight)
          .padding(.horizontal, chromeHorizontalPadding)
          .frame(maxWidth: .infinity)

        if entry.habits.isEmpty {
          WidgetMessageView(
            title: emptyTitle,
            detail: emptyDetail,
            systemImage: emptySystemImage
          )
          .padding(.horizontal, chromeHorizontalPadding)
          .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)
        } else {
          VStack(alignment: .leading, spacing: rowSpacing) {
            ForEach(entry.habits) { habit in
              WidgetHabitRow(habit: habit, family: family)
                .frame(height: resolvedRowHeight, alignment: .top)
            }
          }
          .padding(.horizontal, rowHorizontalPadding)
          .padding(.top, habitAreaPadding.top)
          .padding(.bottom, habitAreaPadding.bottom)
          .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        }

        if showsFooter {
          footer(compact: isCompactWidget)
            .frame(height: footerHeight)
            .padding(.horizontal, footerHorizontalPadding)
            .frame(maxWidth: .infinity)
        }
      }
      .padding(.top, verticalPadding.top)
      .padding(.bottom, verticalPadding.bottom)
      .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
    }
  }

  private func header(compact: Bool) -> some View {
    VStack(spacing: 4) {
      HStack(alignment: .firstTextBaseline, spacing: 5) {
        Text(headerTitle(compact: compact))
          .font(headerTitleFont)
          .foregroundStyle(isReviewMode ? reviewAccentColor : .primary)

        Text(habitsLeftText(compact: compact))
          .font(.caption2.monospacedDigit().weight(.semibold))
          .foregroundStyle(isReviewMode ? reviewAccentColor : .secondary)

        Spacer(minLength: 4)

        Text("\(completionPercentage)%")
          .font(.caption2.monospacedDigit().weight(.bold))
          .foregroundStyle(isReviewMode ? reviewAccentColor : .primary)
      }

      WidgetOverallProgressBar(
        progress: completionProgress,
        accent: isReviewMode ? reviewAccentColor : completionAccentColor,
        track: progressTrackColor
      )
    }
    .lineLimit(1)
    .minimumScaleFactor(0.8)
    .frame(maxWidth: .infinity, alignment: .leading)
    .accessibilityElement(children: .ignore)
    .accessibilityLabel(progressAccessibilityLabel)
    .accessibilityValue("\(completionPercentage) percent")
  }

  @ViewBuilder
  private func footer(compact: Bool) -> some View {
    HStack(spacing: compact ? 4 : 8) {
      Text(footerDateText(compact: compact))
        .font(.caption2)
        .foregroundStyle(.secondary)
        .lineLimit(1)
        .minimumScaleFactor(0.75)

      Spacer(minLength: 4)

      if entry.totalPages > 1 {
        WidgetCompactPageControls(
          page: entry.page,
          totalPages: entry.totalPages,
          compact: compact
        )
      }

      if let review = dailyReview {
        Button(intent: ApplyDailyReviewPenaltiesIntent()) {
          Text(reviewActionTitle(review, compact: compact))
            .font(.caption2.monospacedDigit().weight(.bold))
            .foregroundStyle(reviewButtonTextColor)
            .lineLimit(1)
            .minimumScaleFactor(0.72)
            .padding(.horizontal, compact ? 4 : 7)
            .padding(.vertical, 2)
            .background(Capsule().fill(reviewAccentColor))
        }
        .buttonStyle(.plain)
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }

  private var showsFooter: Bool {
    true
  }

  private func habitsLeftText(compact: Bool) -> String {
    if isReviewMode {
      if compact || family == .systemSmall {
        return "\(entry.totalVisibleHabits)"
      }
      return "\(entry.totalVisibleHabits) missed"
    }
    if compact || family == .systemSmall {
      return "\(entry.totalVisibleHabits)"
    }
    return "\(entry.totalVisibleHabits) left"
  }

  private func headerTitle(compact: Bool) -> String {
    if isReviewMode {
      return compact || family == .systemSmall ? "Penalty" : "Apply Penalties"
    }
    return "Swoosh"
  }

  private var emptyTitle: String {
    isReviewMode ? "Review clear" : "All clear"
  }

  private var emptyDetail: String {
    isReviewMode
      ? "All missed habits are now tracked. Tap Done to finish."
      : "No unchecked habits are scheduled for this page."
  }

  private var emptySystemImage: String {
    isReviewMode ? "checkmark.seal" : "checkmark.circle"
  }

  private var verticalPadding: (top: CGFloat, bottom: CGFloat) {
    switch family {
    case .systemSmall:
      (top: 7, bottom: 5)
    case .systemMedium:
      (top: 5, bottom: 4)
    default:
      (top: 6, bottom: 5)
    }
  }

  private var headerHeight: CGFloat {
    switch family {
    case .systemSmall:
      24
    case .systemMedium:
      23
    default:
      25
    }
  }

  private var footerHeight: CGFloat {
    switch family {
    case .systemSmall:
      15
    case .systemMedium:
      16
    default:
      17
    }
  }

  private var habitAreaPadding: (top: CGFloat, bottom: CGFloat) {
    switch family {
    case .systemSmall:
      (top: 3, bottom: 6)
    case .systemMedium:
      (top: 3, bottom: 7)
    default:
      (top: 4, bottom: 8)
    }
  }

  private var chromeHorizontalPadding: CGFloat {
    switch family {
    case .systemSmall:
      10
    case .systemMedium:
      9
    default:
      10
    }
  }

  private var footerHorizontalPadding: CGFloat {
    switch family {
    case .systemSmall:
      13
    case .systemMedium:
      13
    default:
      15
    }
  }

  private var rowHorizontalPadding: CGFloat {
    switch family {
    case .systemSmall:
      7
    case .systemMedium:
      8
    default:
      9
    }
  }

  private var rowSpacing: CGFloat {
    switch family {
    case .systemSmall:
      4
    case .systemMedium:
      3
    default:
      5
    }
  }

  private var preferredRowHeight: CGFloat {
    switch family {
    case .systemSmall:
      49
    case .systemMedium:
      40
    default:
      44
    }
  }

  private var minimumRowHeight: CGFloat {
    switch family {
    case .systemSmall:
      43
    case .systemMedium:
      32
    default:
      38
    }
  }

  private var headerTitleFont: Font {
    switch family {
    case .systemSmall:
      .caption2.weight(.bold)
    case .systemMedium:
      .caption2.weight(.bold)
    default:
      .caption.weight(.bold)
    }
  }

  private func rowHeight(totalHeight: CGFloat, visibleHabitCount: Int) -> CGFloat {
    let rowCount = max(visibleHabitCount, 1)
    let rowGaps = CGFloat(max(rowCount - 1, 0)) * rowSpacing
    let footerChromeHeight = showsFooter ? footerHeight : 0
    let habitPadding = habitAreaPadding.top + habitAreaPadding.bottom
    let availableHeight = totalHeight
      - verticalPadding.top
      - verticalPadding.bottom
      - headerHeight
      - footerChromeHeight
      - habitPadding
      - rowGaps
    let fittedHeight = floor(availableHeight / CGFloat(rowCount))
    return max(minimumRowHeight, min(preferredRowHeight, fittedHeight))
  }

  private var widgetBackground: some View {
    if isReviewMode {
      return colorScheme == .dark
        ? Color(red: 0.16, green: 0.08, blue: 0.06)
        : Color(red: 1.0, green: 0.95, blue: 0.92)
    }
    return colorScheme == .dark
      ? Color(red: 0.051, green: 0.059, blue: 0.071)
      : Color(red: 0.961, green: 0.965, blue: 0.969)
  }

  private var completionProgress: Double {
    guard entry.totalScheduledHabits > 0 else {
      return 1
    }
    return min(
      max(Double(entry.completedScheduledHabits) / Double(entry.totalScheduledHabits), 0),
      1
    )
  }

  private var completionPercentage: Int {
    Int((completionProgress * 100).rounded())
  }

  private var completionAccentColor: Color {
    Color(red: 0.396, green: 0.780, blue: 0.757)
  }

  private var progressTrackColor: Color {
    colorScheme == .dark
      ? Color(red: 0.09, green: 0.102, blue: 0.122)
      : Color.white
  }

  private var progressAccessibilityLabel: String {
    if isReviewMode {
      return "Penalty review, \(entry.completedScheduledHabits) of \(entry.totalScheduledHabits) habits tracked"
    }
    return "Swoosh, \(entry.completedScheduledHabits) of \(entry.totalScheduledHabits) scheduled habits complete"
  }

  private var dailyReview: WidgetDailyReview? {
    if case let .pendingDailyReview(review) = entry.status {
      return review
    }
    return nil
  }

  private var isReviewMode: Bool {
    dailyReview != nil
  }

  private var reviewAccentColor: Color {
    colorScheme == .dark
      ? Color(red: 1.0, green: 0.48, blue: 0.32)
      : Color(red: 0.78, green: 0.17, blue: 0.1)
  }

  private var reviewButtonTextColor: Color {
    colorScheme == .dark ? Color.black : Color.white
  }

  private func reviewActionTitle(_ review: WidgetDailyReview, compact: Bool) -> String {
    if compact || family == .systemSmall {
      return review.penaltyTotal > 0 ? "Apply" : "Done"
    }
    return review.actionTitle
  }

  private func footerDateText(compact: Bool) -> String {
    guard compact && isReviewMode else {
      return entry.logicalDate
    }

    let parser = DateFormatter()
    parser.dateFormat = "EEE, MMM d"
    if let date = parser.date(from: entry.logicalDate) {
      let formatter = DateFormatter()
      formatter.dateFormat = "M/d"
      return formatter.string(from: date)
    }
    return entry.logicalDate
  }
}

private struct WidgetHabitRow: View {
  let habit: WidgetHabit
  let family: WidgetFamily

  @Environment(\.colorScheme) private var colorScheme

  var body: some View {
    HStack(alignment: .top, spacing: rowGap) {
      Button(intent: CheckHabitIntent(habitId: habit.id)) {
        Image(systemName: "checkmark")
          .font(.system(size: checkmarkSize, weight: .bold))
          .foregroundStyle(accentColor)
          .frame(width: checkSize, height: checkSize)
          .background(
            RoundedRectangle(cornerRadius: checkCornerRadius, style: .continuous)
              .fill(cardColor)
          )
          .overlay {
            RoundedRectangle(cornerRadius: checkCornerRadius, style: .continuous)
              .stroke(accentColor, lineWidth: 2)
          }
      }
      .buttonStyle(.plain)
      .accessibilityLabel("Complete \(habit.name)")

      VStack(alignment: .leading, spacing: contentSpacing) {
        HStack(alignment: .firstTextBaseline, spacing: 5) {
          Text(habit.name)
            .font(titleFont)
            .foregroundStyle(.primary)
            .lineLimit(1)
            .minimumScaleFactor(family == .systemSmall ? 0.55 : 0.72)

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
    .padding(.vertical, verticalPadding)
    .padding(.leading, horizontalPadding)
    .padding(.trailing, horizontalPadding)
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    .background(cardColor)
    .overlay(alignment: .bottom) {
      Rectangle()
        .fill(Color.primary.opacity(colorScheme == .dark ? 0.18 : 0.12))
        .frame(height: 0.5)
    }
  }

  @ViewBuilder
  private var metric: some View {
    switch habit.kind {
    case .normal:
      if habit.totalSubHabitCount > 0 {
        Text("\(habit.checkedSubHabitCount)/\(habit.totalSubHabitCount)")
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
      if family == .systemSmall {
        return "\(total)/\(formatNumber(target))"
      }
      return "\(total)/\(formatNumber(target)) \(habit.countUnit ?? "")"
    }
    if family == .systemSmall {
      return total
    }
    return "\(total) \(habit.countUnit ?? "")"
  }

  private var weightText: String {
    guard let current = habit.weightCurrent else {
      return "-- \(habit.weightUnit ?? "")"
    }
    if family == .systemSmall {
      return formatNumber(current)
    }
    return "\(formatNumber(current)) \(habit.weightUnit ?? "")"
  }

  private var controlSize: CGFloat {
    switch family {
    case .systemSmall:
      18
    case .systemMedium:
      19
    default:
      22
    }
  }

  private var checkSize: CGFloat {
    switch family {
    case .systemSmall:
      22
    case .systemMedium:
      21
    default:
      28
    }
  }

  private var checkCornerRadius: CGFloat {
    family == .systemMedium ? 6 : 7
  }

  private var checkmarkSize: CGFloat {
    switch family {
    case .systemSmall:
      12
    case .systemMedium:
      12
    default:
      15
    }
  }

  private var contentSpacing: CGFloat {
    switch family {
    case .systemSmall:
      2
    case .systemMedium:
      1
    default:
      3
    }
  }

  private var horizontalPadding: CGFloat {
    switch family {
    case .systemSmall:
      5
    case .systemMedium:
      6
    default:
      7
    }
  }

  private var rowGap: CGFloat {
    switch family {
    case .systemSmall:
      4
    case .systemMedium:
      5
    default:
      6
    }
  }

  private var titleFont: Font {
    family == .systemLarge ? .caption.weight(.semibold) : .caption2.weight(.semibold)
  }

  private var verticalPadding: CGFloat {
    switch family {
    case .systemSmall:
      5
    case .systemMedium:
      4
    default:
      5
    }
  }

  private var accentColor: Color {
    Color.hue2Habit(
      index: habit.colorIndex,
      darkMode: colorScheme == .dark,
      globalLightness: habit.colorBrightness,
      globalChroma: habit.colorSaturation
    )
  }

  private var cardColor: Color {
    colorScheme == .dark
      ? Color(red: 0.051, green: 0.059, blue: 0.071)
      : Color(red: 0.961, green: 0.965, blue: 0.969)
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

  @Environment(\.colorScheme) private var colorScheme

  var body: some View {
    if !habit.subHabits.isEmpty {
      HStack(alignment: .top, spacing: family == .systemMedium ? 3 : 4) {
        LazyVGrid(
          columns: columns,
          alignment: .leading,
          spacing: family == .systemMedium ? 0 : 3
        ) {
          ForEach(visibleSubHabits) { subHabit in
            Button(
              intent: ToggleSubHabitIntent(
                parentHabitId: habit.id,
                subHabitId: subHabit.id,
                currentlyChecked: subHabit.checked
              )
            ) {
              HStack(spacing: family == .systemMedium ? 3 : 5) {
                ZStack {
                  RoundedRectangle(cornerRadius: 3, style: .continuous)
                    .fill(Color.clear)
                    .overlay {
                      RoundedRectangle(cornerRadius: 3, style: .continuous)
                        .stroke(accentColor, lineWidth: 1.5)
                    }

                  if subHabit.checked {
                    Image(systemName: "checkmark")
                      .font(.system(size: 8, weight: .bold))
                      .foregroundStyle(accentColor)
                  }
                }
                .frame(width: subHabitCheckSize, height: subHabitCheckSize)

                Text(subHabit.name)
                  .lineLimit(1)
                  .minimumScaleFactor(0.7)
              }
              .font(.caption2)
              .foregroundStyle(subHabit.checked ? .secondary : .primary)
              .padding(.vertical, 0)
              .frame(maxWidth: .infinity, alignment: .leading)
            }
            .buttonStyle(.plain)
            .accessibilityLabel(
              "\(subHabit.checked ? "Uncheck" : "Check") \(subHabit.name)"
            )
          }
        }
        .frame(maxWidth: .infinity, alignment: .leading)

        if totalPages > 1 {
          HStack(spacing: 3) {
            Button(
              intent: PageSubHabitsIntent(habitId: habit.id, direction: -1, totalPages: totalPages)
            ) {
              Image(systemName: "chevron.left")
                .frame(width: family == .systemMedium ? 10 : 12, height: 12)
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
                .frame(width: family == .systemMedium ? 10 : 12, height: 12)
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
    [
      GridItem(.flexible(), spacing: family == .systemMedium ? 3 : 4),
      GridItem(.flexible(), spacing: family == .systemMedium ? 3 : 4),
    ]
  }

  private var subHabitCheckSize: CGFloat {
    family == .systemMedium ? 9 : 12
  }

  private var accentColor: Color {
    Color.hue2Habit(
      index: habit.colorIndex,
      darkMode: colorScheme == .dark,
      globalLightness: habit.colorBrightness,
      globalChroma: habit.colorSaturation
    )
  }

  private var capacity: Int {
    switch family {
    case .systemMedium, .systemLarge:
      2
    default:
      2
    }
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
    HStack(spacing: controlSpacing) {
      Button(
        intent: AdjustCountIntent(
          habitId: habit.id,
          delta: -habit.countStep,
          currentTotal: habit.countTotal
        )
      ) {
        Image(systemName: "minus")
          .frame(width: controlSize, height: controlSize)
          .background(controlBackground(decrementColor.opacity(canDecrement ? 1 : 0.35)))
      }
      .buttonStyle(.plain)
      .foregroundStyle(.white)
      .disabled(!canDecrement)
      .accessibilityLabel("Decrease \(habit.name)")

      Button(
        intent: AdjustCountIntent(
          habitId: habit.id,
          delta: habit.countStep,
          currentTotal: habit.countTotal
        )
      ) {
        Image(systemName: "plus")
          .frame(width: controlSize, height: controlSize)
          .background(controlBackground(incrementColor))
      }
      .buttonStyle(.plain)
      .foregroundStyle(.white)
      .accessibilityLabel("Increase \(habit.name)")
    }
    .font(.caption.weight(.bold))
  }

  private var controlSpacing: CGFloat {
    controlSize <= 18 ? 4 : 5
  }

  private var canDecrement: Bool {
    habit.countTotal > 0
  }

  private var incrementColor: Color {
    habit.countIsGood ? .hue2Success : .hue2Danger
  }

  private var decrementColor: Color {
    habit.countIsGood ? .hue2Danger : .hue2Success
  }

  private func controlBackground(_ color: Color) -> some View {
    RoundedRectangle(cornerRadius: 6, style: .continuous)
      .fill(color)
  }
}

private struct WidgetWeightControls: View {
  let habit: WidgetHabit
  let controlSize: CGFloat

  var body: some View {
    HStack(spacing: controlSpacing) {
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
          .background(controlBackground(decreaseColor.opacity(canAdjust ? 1 : 0.35)))
      }
      .buttonStyle(.plain)
      .foregroundStyle(.white)
      .disabled(!canAdjust)
      .accessibilityLabel("Decrease \(habit.name) weight")

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
          .background(controlBackground(increaseColor.opacity(canAdjust ? 1 : 0.35)))
      }
      .buttonStyle(.plain)
      .foregroundStyle(.white)
      .disabled(!canAdjust)
      .accessibilityLabel("Increase \(habit.name) weight")
    }
    .font(.caption.weight(.bold))
  }

  private var controlSpacing: CGFloat {
    controlSize <= 18 ? 4 : 5
  }

  private var canAdjust: Bool {
    guard let current = habit.weightCurrent else {
      return false
    }
    return current > 0
  }

  private var goalDirection: Int {
    guard let current = habit.weightCurrent, let target = habit.weightTarget else {
      return 0
    }
    let delta = current - target
    if abs(delta) <= 0.5 {
      return 0
    }
    return delta > 0 ? -1 : 1
  }

  private var decreaseColor: Color {
    goalDirection < 0 ? .hue2Success : .hue2Danger
  }

  private var increaseColor: Color {
    goalDirection > 0 ? .hue2Success : .hue2Danger
  }

  private func controlBackground(_ color: Color) -> some View {
    RoundedRectangle(cornerRadius: 6, style: .continuous)
      .fill(color)
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

private struct WidgetOverallProgressBar: View {
  let progress: Double
  let accent: Color
  let track: Color

  var body: some View {
    GeometryReader { proxy in
      ZStack(alignment: .leading) {
        Capsule().fill(track)
        Capsule()
          .fill(accent)
          .frame(width: proxy.size.width * min(max(progress, 0), 1))
      }
    }
    .frame(height: 4)
  }
}

private struct WidgetCompactPageControls: View {
  let page: Int
  let totalPages: Int
  let compact: Bool

  init(page: Int, totalPages: Int, compact: Bool = false) {
    self.page = page
    self.totalPages = totalPages
    self.compact = compact
  }

  var body: some View {
    HStack(spacing: compact ? 2 : 3) {
      Button(intent: PageHabitsIntent(direction: -1, totalPages: totalPages)) {
        Image(systemName: "chevron.left")
          .frame(width: compact ? 10 : 12, height: 12)
      }
      .buttonStyle(.plain)
      .disabled(page <= 0)
      .accessibilityLabel("Previous habits page")

      Text("\(page + 1)/\(totalPages)")
        .font(.caption2.monospacedDigit().weight(.semibold))

      Button(intent: PageHabitsIntent(direction: 1, totalPages: totalPages)) {
        Image(systemName: "chevron.right")
          .frame(width: compact ? 10 : 12, height: 12)
      }
      .buttonStyle(.plain)
      .disabled(page >= totalPages - 1)
      .accessibilityLabel("Next habits page")
    }
    .foregroundStyle(.secondary)
    .fixedSize(horizontal: true, vertical: false)
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
    .configurationDisplayName("Swoosh Habits")
    .description("Check off habits, subhabits, counts, and weights from your home screen.")
    .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    .contentMarginsDisabled()
  }
}

fileprivate enum Hue2WidgetLoader {
  static func load(family: WidgetFamily) async -> Hue2WidgetEntry {
    guard let token = Hue2WidgetStore.read(Hue2WidgetConstants.accessTokenKey) else {
      return Hue2WidgetEntry(
        date: Date(),
        status: .signedOut,
        logicalDate: "Today",
        habits: [],
        page: 0,
        totalPages: 1,
        totalVisibleHabits: 0,
        completedScheduledHabits: 0,
        totalScheduledHabits: 0
      )
    }

    let apiBaseURL = Hue2WidgetStore.read(Hue2WidgetConstants.apiBaseURLKey)
      ?? Hue2WidgetConstants.fallbackAPIBaseURL

    do {
      let client = try Hue2APIClient(baseURLString: apiBaseURL, token: token)
      let user = try await client.fetchUser()
      let rolloverHour = user.settings?.dayRolloverHour ?? 3

      if let pendingReview = user.settings?.pendingDailyReview {
        let reviewWindow = LogicalDayWindow.review(
          reviewDate: pendingReview.reviewDate,
          rolloverHour: rolloverHour
        )
        return try await loadReviewEntry(
          client: client,
          user: user,
          family: family,
          window: reviewWindow,
          reviewDate: displayReviewDate(pendingReview.reviewDate)
        )
      }

      let habits = try await client.fetchHabits()
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

      let scheduledHabits = sortedHabits.filter { habit in
        let weekdays = habit.scheduleSettings?.weekdays ?? [0, 1, 2, 3, 4, 5, 6]
        return weekdays.contains(window.dayOfWeek)
      }
      let visibleHabits = scheduledHabits.filter { !checkedHabitIds.contains($0.id) }
      let completedScheduledHabits = scheduledHabits.filter { checkedHabitIds.contains($0.id) }.count

      let pages = habitPages(for: visibleHabits, family: family)
      let totalPages = max(1, pages.count)
      let requestedPage = UserDefaults.standard.integer(forKey: Hue2WidgetConstants.habitPageKey)
      let page = min(max(requestedPage, 0), totalPages - 1)
      if page != requestedPage {
        UserDefaults.standard.set(page, forKey: Hue2WidgetConstants.habitPageKey)
      }

      let pageHabits = pages.indices.contains(page) ? pages[page] : []
      let subHabitsByParent = await fetchSubHabits(for: pageHabits, client: client)
      let checkedSubHabitIds = Set(
        checks.compactMap { check in
          check.checked ? check.subHabitId : nil
        }
      )
      let countsByHabit = Dictionary(grouping: counts, by: \.habitId)
      let latestWeightByHabit = latestWeightsByHabit(weights)

      let widgetHabits = pageHabits.map { habit in
        let allSubHabits = (subHabitsByParent[habit.id] ?? [])
          .sorted { $0.orderIndex < $1.orderIndex }
        let visibleSubHabits = allSubHabits
          .filter { !checkedSubHabitIds.contains($0.id) }
          .map {
            WidgetSubHabit(
              id: $0.id,
              name: $0.name,
              checked: false
            )
          }
        let checkedSubHabitCount = allSubHabits.filter { checkedSubHabitIds.contains($0.id) }.count

        let countTotal = countsByHabit[habit.id]?.reduce(0) { $0 + $1.value } ?? 0
        let latestWeight = latestWeightByHabit[habit.id]?.weight
          ?? habit.weightSettings?.startingWeight

        return WidgetHabit(
          id: habit.id,
          name: habit.name,
          kind: habit.kind,
          colorIndex: colorIndexByHabitId[habit.id] ?? 0,
          colorBrightness: user.settings?.colorBrightness,
          colorSaturation: user.settings?.colorSaturation,
          subHabits: visibleSubHabits,
          checkedSubHabitCount: checkedSubHabitCount,
          totalSubHabitCount: allSubHabits.count,
          countTotal: countTotal,
          countTarget: habit.countSettings?.target,
          countUnit: habit.countSettings?.unit,
          countStep: max(habit.countSettings?.stepSize ?? 1, 0.1),
          countIsGood: habit.countSettings?.countIsGood ?? true,
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
        totalVisibleHabits: visibleHabits.count,
        completedScheduledHabits: completedScheduledHabits,
        totalScheduledHabits: scheduledHabits.count
      )
    } catch {
      return Hue2WidgetEntry(
        date: Date(),
        status: .failed("Open the app if your session recently changed."),
        logicalDate: "Today",
        habits: [],
        page: 0,
        totalPages: 1,
        totalVisibleHabits: 0,
        completedScheduledHabits: 0,
        totalScheduledHabits: 0
      )
    }
  }

  private static func loadReviewEntry(
    client: Hue2APIClient,
    user: APIUser,
    family: WidgetFamily,
    window: LogicalDayWindow,
    reviewDate: String
  ) async throws -> Hue2WidgetEntry {
    async let habitsRequest = client.fetchHabits()
    async let checksRequest = client.fetchChecks(start: window.start, end: window.end)
    async let countsRequest = client.fetchCounts(start: window.start, end: window.end)
    async let weightsRequest = client.fetchWeightUpdates(limit: 500)

    let habits = try await habitsRequest
    let checks = try await checksRequest
    let counts = try await countsRequest
    let weights = try await weightsRequest

    let sortedHabits = habits
      .filter { $0.deletedAt == nil && ($0.displaySettings?.hidden != true) }
      .sorted(by: sortHabits)
    let colorIndexByHabitId = Dictionary(uniqueKeysWithValues: sortedHabits.enumerated().map { ($0.element.id, $0.offset) })
    let trackedHabitIds = trackedHabitIds(
      checks: checks,
      counts: counts,
      weights: weights,
      window: window
    )

    let scheduledHabits = sortedHabits.filter { habit in
      let weekdays = habit.scheduleSettings?.weekdays ?? [0, 1, 2, 3, 4, 5, 6]
      return weekdays.contains(window.dayOfWeek)
    }
    let visibleHabits = scheduledHabits.filter { !trackedHabitIds.contains($0.id) }
    let completedScheduledHabits = scheduledHabits.filter { trackedHabitIds.contains($0.id) }.count

    let pages = habitPages(for: visibleHabits, family: family)
    let totalPages = max(1, pages.count)
    let requestedPage = UserDefaults.standard.integer(forKey: Hue2WidgetConstants.habitPageKey)
    let page = min(max(requestedPage, 0), totalPages - 1)
    if page != requestedPage {
      UserDefaults.standard.set(page, forKey: Hue2WidgetConstants.habitPageKey)
    }

    let pageHabits = pages.indices.contains(page) ? pages[page] : []
    let subHabitsByParent = await fetchSubHabits(for: pageHabits, client: client)
    let checkedSubHabitIds = Set(
      checks.compactMap { check in
        check.checked ? check.subHabitId : nil
      }
    )
    let countsByHabit = Dictionary(grouping: counts, by: \.habitId)
    let latestWeightByHabit = latestWeightsByHabit(weights)

    let widgetHabits = pageHabits.map { habit in
      let allSubHabits = (subHabitsByParent[habit.id] ?? [])
        .sorted { $0.orderIndex < $1.orderIndex }
      let visibleSubHabits = allSubHabits
        .filter { !checkedSubHabitIds.contains($0.id) }
        .map {
          WidgetSubHabit(
            id: $0.id,
            name: $0.name,
            checked: false
          )
        }
      let checkedSubHabitCount = allSubHabits.filter { checkedSubHabitIds.contains($0.id) }.count
      let countTotal = countsByHabit[habit.id]?.reduce(0) { $0 + $1.value } ?? 0
      let latestWeight = latestWeightByHabit[habit.id]?.weight
        ?? habit.weightSettings?.startingWeight

      return WidgetHabit(
        id: habit.id,
        name: habit.name,
        kind: habit.kind,
        colorIndex: colorIndexByHabitId[habit.id] ?? 0,
        colorBrightness: user.settings?.colorBrightness,
        colorSaturation: user.settings?.colorSaturation,
        subHabits: visibleSubHabits,
        checkedSubHabitCount: checkedSubHabitCount,
        totalSubHabitCount: allSubHabits.count,
        countTotal: countTotal,
        countTarget: habit.countSettings?.target,
        countUnit: habit.countSettings?.unit,
        countStep: max(habit.countSettings?.stepSize ?? 1, 0.1),
        countIsGood: habit.countSettings?.countIsGood ?? true,
        weightCurrent: latestWeight,
        weightTarget: habit.weightSettings?.targetWeight,
        weightUnit: habit.weightSettings?.unit,
        weightStep: max(habit.weightSettings?.stepSize ?? 0.1, 0.1)
      )
    }

    let penaltyTotal = visibleHabits.reduce(0) { total, habit in
      total + max(habit.rewardSettings?.penaltyPoints ?? 0, 0)
    }

    return Hue2WidgetEntry(
      date: Date(),
      status: .pendingDailyReview(
        WidgetDailyReview(reviewDate: reviewDate, penaltyTotal: penaltyTotal)
      ),
      logicalDate: reviewDate,
      habits: widgetHabits,
      page: page,
      totalPages: totalPages,
      totalVisibleHabits: visibleHabits.count,
      completedScheduledHabits: completedScheduledHabits,
      totalScheduledHabits: scheduledHabits.count
    )
  }

  private static func habitPages(for habits: [APIHabit], family: WidgetFamily) -> [[APIHabit]] {
    let capacity = pageCapacity(for: family)
    var pages: [[APIHabit]] = []

    for start in stride(from: 0, to: habits.count, by: capacity) {
      let end = min(start + capacity, habits.count)
      pages.append(Array(habits[start..<end]))
    }

    return pages.isEmpty ? [[]] : pages
  }

  private static func pageCapacity(for family: WidgetFamily) -> Int {
    switch family {
    case .systemSmall:
      return 2
    case .systemMedium:
      return 3
    case .systemLarge:
      return 6
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

  fileprivate static func trackedHabitIds(
    checks: [APICheck],
    counts: [APICount],
    weights: [APIWeightUpdate],
    window: LogicalDayWindow
  ) -> Set<Int> {
    var tracked = Set<Int>()
    for check in checks where check.checked && check.subHabitId == nil {
      if let habitId = check.habitId {
        tracked.insert(habitId)
      }
    }
    for count in counts {
      tracked.insert(count.habitId)
    }
    for weight in weights where window.contains(weight.updateDate) {
      tracked.insert(weight.habitId)
    }
    return tracked
  }

  private static func displayReviewDate(_ value: String) -> String {
    let parsedDate = parseFlexibleDate(value)
    guard let parsedDate else {
      return value
    }

    let displayFormatter = DateFormatter()
    displayFormatter.dateFormat = "EEE, MMM d"
    return displayFormatter.string(from: parsedDate)
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

  func updateUserSettings(_ settings: [String: JSONValue]) async throws {
    try await send(
      "/api/users/me",
      method: "PUT",
      body: ["settings": settings.mapValues { $0.anyValue }]
    )
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

  func fetchWeightUpdates(habitId: Int? = nil, limit: Int) async throws -> [APIWeightUpdate] {
    var query = [URLQueryItem(name: "limit", value: String(limit))]
    if let habitId {
      query.append(URLQueryItem(name: "habit_id", value: String(habitId)))
    }
    return try await request(
      "/api/weight-updates",
      query: query
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

    var request = URLRequest(url: url, timeoutInterval: 15)
    request.httpMethod = method
    request.cachePolicy = .reloadIgnoringLocalCacheData
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
    if method == "GET" {
      request.setValue("no-cache", forHTTPHeaderField: "Cache-Control")
      request.setValue("no-cache", forHTTPHeaderField: "Pragma")
    }
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

  static func mutationWindow(client: Hue2APIClient) async throws -> LogicalDayWindow {
    let user = try await client.fetchUser()
    let rolloverHour = user.settings?.dayRolloverHour ?? 3
    if let pendingReview = user.settings?.pendingDailyReview {
      return LogicalDayWindow.review(
        reviewDate: pendingReview.reviewDate,
        rolloverHour: rolloverHour
      )
    }
    return LogicalDayWindow.current(rolloverHour: rolloverHour)
  }

  static func checkHabit(habitId: Int) async throws {
    let client = try client()
    let window = try await mutationWindow(client: client)
    try await client.createCheck(habitId: habitId, date: window.reference)
    WidgetCenter.shared.reloadTimelines(ofKind: Hue2WidgetConstants.kind)
  }

  static func toggleSubHabit(
    parentHabitId: Int,
    subHabitId: Int,
    currentlyChecked: Bool
  ) async throws {
    let client = try client()
    let window = try await mutationWindow(client: client)

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
      try await client.createCheck(
        habitId: parentHabitId,
        subHabitId: subHabitId,
        date: window.reference
      )
    }

    WidgetCenter.shared.reloadTimelines(ofKind: Hue2WidgetConstants.kind)
  }

  static func adjustCount(habitId: Int, delta: Double, currentTotal: Double) async throws {
    guard currentTotal + delta >= 0 else {
      return
    }

    let client = try client()
    let window = try await mutationWindow(client: client)
    try await client.createCount(habitId: habitId, value: delta, date: window.reference)
    WidgetCenter.shared.reloadTimelines(ofKind: Hue2WidgetConstants.kind)
  }

  static func adjustWeight(
    habitId: Int,
    direction: Int,
    currentWeight: Double,
    step: Double
  ) async throws {
    let client = try client()
    let latestWeight = try await client.fetchWeightUpdates(habitId: habitId, limit: 1).first?.weight
      ?? currentWeight
    guard latestWeight > 0 else {
      return
    }

    let signedStep = direction >= 0 ? step : -step
    let next = max(0.1, roundToTenths(latestWeight + signedStep))
    let window = try await mutationWindow(client: client)
    try await client.createWeight(habitId: habitId, weight: next, date: window.reference)
    WidgetCenter.shared.reloadTimelines(ofKind: Hue2WidgetConstants.kind)
  }

  static func applyDailyReviewPenalties() async throws {
    let client = try client()
    let user = try await client.fetchUser()
    guard let pendingReview = user.settings?.pendingDailyReview else {
      WidgetCenter.shared.reloadTimelines(ofKind: Hue2WidgetConstants.kind)
      return
    }

    let rolloverHour = user.settings?.dayRolloverHour ?? 3
    let reviewWindow = LogicalDayWindow.review(
      reviewDate: pendingReview.reviewDate,
      rolloverHour: rolloverHour
    )
    let remainingHabits = try await remainingReviewHabits(client: client, window: reviewWindow)
    let penaltyTotal = remainingHabits.reduce(0) { total, habit in
      total + max(habit.rewardSettings?.penaltyPoints ?? 0, 0)
    }

    var settings = user.rawSettings
    let currentRewards = user.settings?.totalRewards
      ?? settings["total_rewards"]?.doubleValue
      ?? 0
    settings["total_rewards"] = .number(currentRewards - penaltyTotal)
    settings["pending_daily_review"] = .null
    settings["last_session_date"] = .string(
      LogicalDayWindow.current(rolloverHour: rolloverHour).dateKey
    )

    try await client.updateUserSettings(settings)
    UserDefaults.standard.set(0, forKey: Hue2WidgetConstants.habitPageKey)
    WidgetCenter.shared.reloadTimelines(ofKind: Hue2WidgetConstants.kind)
  }

  private static func remainingReviewHabits(
    client: Hue2APIClient,
    window: LogicalDayWindow
  ) async throws -> [APIHabit] {
    async let habitsRequest = client.fetchHabits()
    async let checksRequest = client.fetchChecks(start: window.start, end: window.end)
    async let countsRequest = client.fetchCounts(start: window.start, end: window.end)
    async let weightsRequest = client.fetchWeightUpdates(limit: 500)

    let habits = try await habitsRequest
    let checks = try await checksRequest
    let counts = try await countsRequest
    let weights = try await weightsRequest

    let trackedHabitIds = Hue2WidgetLoader.trackedHabitIds(
      checks: checks,
      counts: counts,
      weights: weights,
      window: window
    )

    return habits
      .filter { $0.deletedAt == nil && ($0.displaySettings?.hidden != true) }
      .filter { habit in
        let weekdays = habit.scheduleSettings?.weekdays ?? [0, 1, 2, 3, 4, 5, 6]
        return weekdays.contains(window.dayOfWeek) && !trackedHabitIds.contains(habit.id)
      }
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

struct ApplyDailyReviewPenaltiesIntent: AppIntent {
  static let title: LocalizedStringResource = "Apply Daily Review Penalties"
  static var openAppWhenRun = false

  func perform() async throws -> some IntentResult {
    try await Hue2WidgetActions.applyDailyReviewPenalties()
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
  let rawSettings: [String: JSONValue]

  enum CodingKeys: String, CodingKey {
    case settings
  }

  init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    settings = try container.decodeIfPresent(APIUserSettings.self, forKey: .settings)
    rawSettings = try container.decodeIfPresent([String: JSONValue].self, forKey: .settings) ?? [:]
  }
}

private struct APIUserSettings: Decodable {
  let dayRolloverHour: Int?
  let colorBrightness: Double?
  let colorSaturation: Double?
  let totalRewards: Double?
  let lastSessionDate: String?
  let pendingDailyReview: APIPendingDailyReview?

  enum CodingKeys: String, CodingKey {
    case dayRolloverHour = "day_rollover_hour"
    case colorBrightness = "color_brightness"
    case colorSaturation = "color_saturation"
    case totalRewards = "total_rewards"
    case lastSessionDate = "last_session_date"
    case pendingDailyReview = "pending_daily_review"
  }
}

private struct APIPendingDailyReview: Decodable {
  let reviewDate: String
  let createdAt: String?

  enum CodingKeys: String, CodingKey {
    case reviewDate = "review_date"
    case createdAt = "created_at"
  }
}

private enum JSONValue: Codable {
  case string(String)
  case number(Double)
  case bool(Bool)
  case object([String: JSONValue])
  case array([JSONValue])
  case null

  init(from decoder: Decoder) throws {
    let container = try decoder.singleValueContainer()
    if container.decodeNil() {
      self = .null
    } else if let value = try? container.decode(Bool.self) {
      self = .bool(value)
    } else if let value = try? container.decode(Double.self) {
      self = .number(value)
    } else if let value = try? container.decode(String.self) {
      self = .string(value)
    } else if let value = try? container.decode([JSONValue].self) {
      self = .array(value)
    } else if let value = try? container.decode([String: JSONValue].self) {
      self = .object(value)
    } else {
      throw DecodingError.dataCorruptedError(
        in: container,
        debugDescription: "Unsupported JSON value"
      )
    }
  }

  func encode(to encoder: Encoder) throws {
    var container = encoder.singleValueContainer()
    switch self {
    case let .string(value):
      try container.encode(value)
    case let .number(value):
      try container.encode(value)
    case let .bool(value):
      try container.encode(value)
    case let .object(value):
      try container.encode(value)
    case let .array(value):
      try container.encode(value)
    case .null:
      try container.encodeNil()
    }
  }

  var doubleValue: Double? {
    if case let .number(value) = self {
      return value
    }
    return nil
  }

  var anyValue: Any {
    switch self {
    case let .string(value):
      return value
    case let .number(value):
      return value
    case let .bool(value):
      return value
    case let .object(value):
      return value.mapValues { $0.anyValue }
    case let .array(value):
      return value.map { $0.anyValue }
    case .null:
      return NSNull()
    }
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
  let rewardSettings: APIRewardSettings?
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
    case rewardSettings = "reward_settings"
    case displaySettings = "display_settings"
    case deletedAt = "deleted_at"
    case createdAt = "created_at"
  }
}

private struct APICountSettings: Decodable {
  let target: Double?
  let unit: String?
  let stepSize: Double?
  let countIsGood: Bool?

  enum CodingKeys: String, CodingKey {
    case target
    case unit
    case stepSize = "step_size"
    case countIsGood = "count_is_good"
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

private struct APIRewardSettings: Decodable {
  let penaltyPoints: Double?

  enum CodingKeys: String, CodingKey {
    case penaltyPoints = "penalty_points"
  }
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
  let dateKey: String

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

    return LogicalDayWindow(
      reference: reference,
      start: start,
      end: end,
      dayOfWeek: dayOfWeek,
      label: displayLabel(from: start),
      dateKey: dateKey(from: start)
    )
  }

  static func review(reviewDate: String, rolloverHour: Int) -> LogicalDayWindow {
    let referenceDate = parseFlexibleDate(reviewDate) ?? Date()
    let calendar = Calendar.current
    var components = calendar.dateComponents([.year, .month, .day], from: referenceDate)
    components.hour = rolloverHour
    components.minute = 0
    components.second = 0

    let start = calendar.date(from: components) ?? referenceDate
    let end = calendar.date(byAdding: .day, value: 1, to: start) ?? referenceDate
    let dayOfWeek = calendar.component(.weekday, from: start) - 1

    return LogicalDayWindow(
      reference: start,
      start: start,
      end: end,
      dayOfWeek: dayOfWeek,
      label: displayLabel(from: start),
      dateKey: dateKey(from: start)
    )
  }

  func contains(_ value: String) -> Bool {
    guard let date = parseFlexibleDate(value) else {
      return false
    }
    return date >= start && date < end
  }

  private static func displayLabel(from date: Date) -> String {
    let formatter = DateFormatter()
    formatter.dateFormat = "EEE, MMM d"
    return formatter.string(from: date)
  }

  private static func dateKey(from date: Date) -> String {
    let formatter = DateFormatter()
    formatter.dateFormat = "yyyy-MM-dd"
    formatter.locale = Locale(identifier: "en_US_POSIX")
    return formatter.string(from: date)
  }
}

private enum Hue2APIError: Error {
  case invalidBaseURL
  case invalidURL
  case missingToken
  case requestFailed
}

private func parseFlexibleDate(_ value: String) -> Date? {
  let isoWithFractionalSeconds = ISO8601DateFormatter()
  isoWithFractionalSeconds.formatOptions = [.withInternetDateTime, .withFractionalSeconds]

  let isoWithoutFractionalSeconds = ISO8601DateFormatter()
  isoWithoutFractionalSeconds.formatOptions = [.withInternetDateTime]

  let localDateTimeWithMicroseconds = DateFormatter()
  localDateTimeWithMicroseconds.dateFormat = "yyyy-MM-dd'T'HH:mm:ss.SSSSSS"
  localDateTimeWithMicroseconds.locale = Locale(identifier: "en_US_POSIX")

  let localDateTimeWithMilliseconds = DateFormatter()
  localDateTimeWithMilliseconds.dateFormat = "yyyy-MM-dd'T'HH:mm:ss.SSS"
  localDateTimeWithMilliseconds.locale = Locale(identifier: "en_US_POSIX")

  let localDateTimeWithoutFractionalSeconds = DateFormatter()
  localDateTimeWithoutFractionalSeconds.dateFormat = "yyyy-MM-dd'T'HH:mm:ss"
  localDateTimeWithoutFractionalSeconds.locale = Locale(identifier: "en_US_POSIX")

  let dateOnlyFormatter = DateFormatter()
  dateOnlyFormatter.dateFormat = "yyyy-MM-dd"
  dateOnlyFormatter.locale = Locale(identifier: "en_US_POSIX")

  return isoWithFractionalSeconds.date(from: value)
    ?? isoWithoutFractionalSeconds.date(from: value)
    ?? localDateTimeWithMicroseconds.date(from: value)
    ?? localDateTimeWithMilliseconds.date(from: value)
    ?? localDateTimeWithoutFractionalSeconds.date(from: value)
    ?? dateOnlyFormatter.date(from: value)
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
  static func hue2Habit(
    index: Int,
    darkMode: Bool,
    globalLightness: Double?,
    globalChroma: Double?
  ) -> Color {
    let goldenAngle = 137.508
    let hue = (200 + Double(index) * goldenAngle).truncatingRemainder(dividingBy: 360)
    let baseLightness = globalLightness ?? (darkMode ? 75 : 65)
    let lightnessOffset = (index.isMultiple(of: 2) ? 1.0 : -1.0) * 8
    let finalLightness = min(max(baseLightness + lightnessOffset, 10), 90) / 100

    let baseChroma = globalChroma ?? 15
    let chromaWobble = sin((Double(index) * Double.pi) / 3) * 2
    let finalChroma = baseChroma == 0
      ? 0
      : min(max(baseChroma + chromaWobble, 6), 30) / 100

    return oklch(lightness: finalLightness, chroma: finalChroma, hue: hue)
  }

  private static func oklch(lightness: Double, chroma: Double, hue: Double) -> Color {
    let radians = (hue * Double.pi) / 180
    let a = chroma * cos(radians)
    let b = chroma * sin(radians)

    let lValue = lightness + 0.3963377774 * a + 0.2158037573 * b
    let mValue = lightness - 0.1055613458 * a - 0.0638541728 * b
    let sValue = lightness - 0.0894841775 * a - 1.291485548 * b

    let l3 = lValue * lValue * lValue
    let m3 = mValue * mValue * mValue
    let s3 = sValue * sValue * sValue

    let redLinear = 4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3
    let greenLinear = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3
    let blueLinear = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3

    return Color(
      red: clamp(linearToSRGB(redLinear)),
      green: clamp(linearToSRGB(greenLinear)),
      blue: clamp(linearToSRGB(blueLinear))
    )
  }

  private static func linearToSRGB(_ value: Double) -> Double {
    if value >= 0.0031308 {
      return 1.055 * pow(abs(value), 1 / 2.4) - 0.055
    }
    return 12.92 * value
  }

  private static func clamp(_ value: Double) -> Double {
    min(max(value, 0), 1)
  }

  static var hue2Success: Color {
    Color(red: 0.30, green: 0.69, blue: 0.31)
  }

  static var hue2Danger: Color {
    Color(red: 1.00, green: 0.27, blue: 0.27)
  }
}
