/**
 * Kitchen courses for docket layout (Entrée / Main / Dessert / Other).
 *
 * Distinct from item groups (food/drink/misc), which route lines to printers.
 * Courses only control sort order and section headers on a kitchen docket.
 *
 * Mirrored from easymenu/lib/constants/kitchenCourses.js — keep in sync.
 */

export const KITCHEN_COURSES = [
  { id: "entree", name: "Entrée", sortOrder: 1 },
  { id: "main", name: "Main", sortOrder: 2 },
  { id: "dessert", name: "Dessert", sortOrder: 3 },
  { id: "other", name: "Other", sortOrder: 4 },
];

export const KITCHEN_COURSE_IDS = KITCHEN_COURSES.map((c) => c.id);

const COURSE_BY_ID = new Map(KITCHEN_COURSES.map((c) => [c.id, c]));

/** @returns {string|null} */
export function normalizeKitchenCourse(value) {
  if (typeof value !== "string") return null;
  const id = value.trim().toLowerCase();
  return COURSE_BY_ID.has(id) ? id : null;
}

export function getKitchenCourseDisplayName(courseId) {
  const normalized = normalizeKitchenCourse(courseId) || "other";
  return COURSE_BY_ID.get(normalized)?.name || "Other";
}

export function getKitchenCourseSortOrder(courseId) {
  const normalized = normalizeKitchenCourse(courseId);
  if (!normalized) return 999;
  return COURSE_BY_ID.get(normalized)?.sortOrder ?? 999;
}

/**
 * Item override wins; otherwise use section/category default.
 * @returns {string|null}
 */
export function resolveKitchenCourse({ itemCourse, sectionCourse } = {}) {
  return (
    normalizeKitchenCourse(itemCourse) ||
    normalizeKitchenCourse(sectionCourse) ||
    null
  );
}

/**
 * Resolve course for a menu item id from live menuContent.
 * Prefers item.kitchenCourse; else first containing section's kitchenCourse.
 * @returns {string|null}
 */
export function resolveKitchenCourseFromMenu(menuContent, menuItemId) {
  if (!menuItemId) return null;
  let sectionCourse = null;
  for (const section of menuContent || []) {
    for (const item of section.items || []) {
      if (item?.id !== menuItemId || item?.isDraft === true) continue;
      const fromItem = normalizeKitchenCourse(item.kitchenCourse);
      if (fromItem) return fromItem;
      if (!sectionCourse) {
        sectionCourse = normalizeKitchenCourse(section.kitchenCourse);
      }
      break;
    }
  }
  return sectionCourse;
}

/**
 * Fill missing kitchenCourse on order lines from live menu (print-time fallback).
 */
export function enrichOrderItemsWithKitchenCourse(items, menuContent) {
  return (items || []).map((item) => {
    if (normalizeKitchenCourse(item?.kitchenCourse)) return item;
    const resolved = resolveKitchenCourseFromMenu(
      menuContent,
      item?.menuItemId,
    );
    if (!resolved) return item;
    return { ...item, kitchenCourse: resolved };
  });
}

/**
 * Stable sort: by course order, then original index. Null/unknown courses last.
 */
export function sortItemsByKitchenCourse(items) {
  const list = Array.isArray(items) ? items : [];
  return list
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const orderA = getKitchenCourseSortOrder(a.item?.kitchenCourse);
      const orderB = getKitchenCourseSortOrder(b.item?.kitchenCourse);
      if (orderA !== orderB) return orderA - orderB;
      return a.index - b.index;
    })
    .map(({ item }) => item);
}

/**
 * When enabled and at least one item has a course, sort for docket layout.
 * Otherwise return items unchanged.
 */
export function prepareItemsForKitchenCoursePrint(items, enabled) {
  const list = Array.isArray(items) ? items : [];
  if (!enabled) return list;
  const hasCourse = list.some((item) =>
    normalizeKitchenCourse(item?.kitchenCourse),
  );
  if (!hasCourse) return list;
  return sortItemsByKitchenCourse(list);
}

export function isKitchenCourseGroupingEnabled(menuConfig) {
  return menuConfig?.kitchenCourseGroupingEnabled === true;
}

/** True when docket should print course section headers. */
export function shouldPrintKitchenCourseHeaders(items, enabled) {
  if (!enabled) return false;
  return (items || []).some((item) =>
    normalizeKitchenCourse(item?.kitchenCourse),
  );
}
