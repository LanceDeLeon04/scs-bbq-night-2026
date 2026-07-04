export const DEPARTMENTS = [
  'School of Computer Studies',
  'School of Accountancy, Business, and Management',
  'School of Engineering and Architecture',
  'School of Arts and Sciences',
  'Senior High School',
  'SCS Student Council',
  'Council of Leaders',
  'Faculty',
  'ASP',
]

// For these, the person doesn't belong to a class section — they have a
// role/position instead (officer title, faculty role, etc.), so the form
// swaps the "Section" field to "Position".
const POSITION_DEPARTMENTS = new Set([
  'SCS Student Council',
  'Council of Leaders',
  'Faculty',
  'ASP',
])

export function isPositionDepartment(department) {
  return POSITION_DEPARTMENTS.has(department)
}
