import { fill, type Lang } from "./i18n";
import type { Reason } from "./api";

const CAT = {
  en: ["below caution", "caution", "extreme caution", "danger", "extreme danger"],
  hi: ["सामान्य", "सावधानी", "ज़्यादा सावधानी", "ख़तरा", "बहुत ज़्यादा ख़तरा"],
};

const RULE = {
  en: {
    EXTREME_DANGER_NO_UNCOOLED_WORK: "no work outside a cooled room in extreme danger heat",
    DANGER_NO_HEAVY_WORK: "no heavy work in danger heat",
    DANGER_NO_DIRECT_SUN_UNACCLIMATIZED: "no direct-sun work in danger heat for workers not used to heat",
  },
  hi: {
    EXTREME_DANGER_NO_UNCOOLED_WORK: "बहुत ज़्यादा ख़तरे वाली गर्मी में ठंडे कमरे के बाहर कोई काम नहीं",
    DANGER_NO_HEAVY_WORK: "ख़तरे वाली गर्मी में भारी काम नहीं",
    DANGER_NO_DIRECT_SUN_UNACCLIMATIZED: "जो गर्मी के आदी नहीं, उनके लिए ख़तरे वाली गर्मी में सीधी धूप का काम नहीं",
  },
};

const TEXT: Record<Lang, Record<string, string>> = {
  en: {
    BOOKED_TIME_BLOCKED: "Booked for {booked}, but that hour breaks a heat rule ({rule}). Moved to {moved_to}.",
    MOVED_TO_LOWER_EXPOSURE: "Moved from {booked} to {moved_to}: cooler hours cut its exposure score from {booked_score} to {new_score}.",
    INDOOR_DURING_HEAT: "Cooled indoor work, placed in the hot part of the day so outdoor jobs get the cooler hours.",
    INDOOR_COOLED: "Cooled indoor work. Heat rules don't restrict it.",
    KEPT_BOOKED_TIME: "Kept at the booked time. It already sits in a lower-exposure window.",
    FIXED_APPOINTMENT: "Fixed appointment. Its time was not moved.",
    BLOCKED_BY_HEAT_POLICY: "Every possible time for this job breaks a heat rule ({rule}). Hottest hour in its window: {peak}.",
    OUTSIDE_WORKDAY: "Its time window doesn't fit inside your working hours.",
    CONFLICTS_WITH_FIXED_APPOINTMENT: "Clashes with another fixed appointment that was kept.",
    TARGET_ALREADY_MET: "Not needed: your target is met with less heat exposure without it.",
    NO_ROOM_IN_DAY: "No time left for it once travel, rest and the other jobs are placed.",
  },
  hi: {
    BOOKED_TIME_BLOCKED: "{booked} बजे तय था, पर उस समय गर्मी का नियम टूटता है ({rule})। {moved_to} बजे पर रखा।",
    MOVED_TO_LOWER_EXPOSURE: "{booked} से {moved_to} पर किया: ठंडे घंटों में गर्मी स्कोर {booked_score} से घटकर {new_score}।",
    INDOOR_DURING_HEAT: "ठंडी जगह का अंदर का काम, दिन के गर्म हिस्से में रखा ताकि बाहर के काम ठंडे घंटों में हों।",
    INDOOR_COOLED: "ठंडी जगह का अंदर का काम। गर्मी के नियम इस पर लागू नहीं।",
    KEPT_BOOKED_TIME: "तय समय पर ही रखा। वह पहले से कम गर्मी वाला समय है।",
    FIXED_APPOINTMENT: "पक्का अपॉइंटमेंट। समय नहीं बदला।",
    BLOCKED_BY_HEAT_POLICY: "इस काम का हर संभव समय गर्मी का नियम तोड़ता है ({rule})। इसके समय में सबसे गर्म घंटा: {peak}।",
    OUTSIDE_WORKDAY: "इसका समय आपके काम के घंटों में नहीं आता।",
    CONFLICTS_WITH_FIXED_APPOINTMENT: "दूसरे पक्के अपॉइंटमेंट से टकराता है, जो रखा गया।",
    TARGET_ALREADY_MET: "ज़रूरत नहीं: इसके बिना कम गर्मी में लक्ष्य पूरा हो रहा है।",
    NO_ROOM_IN_DAY: "रास्ते, आराम और बाक़ी कामों के बाद इसके लिए समय नहीं बचा।",
  },
};

export function catName(i: number, lang: Lang) {
  return CAT[lang][i] ?? "";
}

export function reasonText(r: Reason, lang: Lang) {
  const p = r.params || {};
  const rules = RULE[lang] as Record<string, string>;
  const vars = {
    ...p,
    rule: rules[String(p.rule)] ?? String(p.rule ?? ""),
    peak: catName(Number(p.peak_category_index ?? 0), lang),
  };
  return fill(TEXT[lang][r.reason_code] ?? r.reason_code, vars);
}
