// Unknown condition remains unknown; marketplace membership is not condition evidence.
export function productCondition(value = "") {
  const text = String(value).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[_-]/g, " ");
  if (/\b(?:ca nou|like new|used|second hand|folosit|utilizat|reconditionat|refurbished|resigilat|open box|bun|excelent|acceptabil)\b|UsedCondition|RefurbishedCondition/i.test(text)) return "used";
  if (/\b(?:nou|noua|noi|new|sigilat|sigilata)\b|NewCondition/i.test(text)) return "new";
  return "unknown";
}
