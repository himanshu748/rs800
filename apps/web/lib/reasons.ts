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
    EXTREME_DANGER_NO_TRAVEL: "no travel between jobs in extreme danger heat",
  },
  hi: {
    EXTREME_DANGER_NO_UNCOOLED_WORK: "बहुत ज़्यादा ख़तरे वाली गर्मी में ठंडे कमरे के बाहर कोई काम नहीं",
    DANGER_NO_HEAVY_WORK: "ख़तरे वाली गर्मी में भारी काम नहीं",
    DANGER_NO_DIRECT_SUN_UNACCLIMATIZED: "जो गर्मी के आदी नहीं, उनके लिए ख़तरे वाली गर्मी में सीधी धूप का काम नहीं",
    EXTREME_DANGER_NO_TRAVEL: "बहुत ज़्यादा ख़तरे वाली गर्मी में कामों के बीच आना-जाना नहीं",
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
    SOLVER_TIMEOUT: "Not planned: the solver ran out of time.",
    NO_TIME_FOR_REST: "No slot leaves time for the required rest before your working hours end.",
    NO_FEASIBLE_PLAN: "No valid time for this job within the heat rules and your hours.",
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
    SOLVER_TIMEOUT: "प्लान नहीं हुआ: सॉल्वर का समय ख़त्म हो गया।",
    NO_TIME_FOR_REST: "किसी भी समय पर काम के घंटे ख़त्म होने से पहले ज़रूरी आराम का समय नहीं बचता।",
    NO_FEASIBLE_PLAN: "गर्मी के नियमों और आपके घंटों में इस काम का कोई सही समय नहीं।",
  },
};

const REST_NOTE: Record<Lang, string> = {
  en: "The later slots that pass the heat rules leave no time to rest before your hours end.",
  hi: "जो बाद के समय गर्मी के नियमों में ठीक हैं, उनमें काम के घंटे ख़त्म होने से पहले आराम का समय नहीं बचता।",
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
  const text = fill(TEXT[lang][r.reason_code] ?? r.reason_code, vars);
  if (r.reason_code === "BLOCKED_BY_HEAT_POLICY" && Number(p.no_rest_slots) > 0) return `${text} ${REST_NOTE[lang]}`;
  return text;
}

const RULES: Record<Lang, Record<string, string>> = {
  en: {},
  hi: {
    EXTREME_DANGER: "बहुत ज़्यादा ख़तरे वाली गर्मी: ठंडे कमरे के बाहर कोई काम नहीं।",
    DANGER_HEAVY: "ख़तरे वाली गर्मी: ठंडे कमरे के बाहर भारी काम नहीं।",
    DANGER_DIRECT_SUN: "ख़तरे वाली गर्मी: सीधी धूप का काम नहीं, जब तक आप गर्मी में काम के आदी न हों।",
    TRAVEL: "बहुत ज़्यादा ख़तरे वाली गर्मी: कामों के बीच आना-जाना भी नहीं। उससे कम गर्मी में आना-जाना ठीक है, पर सीधी धूप में हल्के काम की तरह गिना जाता है।",
    RECOVERY: "बिना कूलिंग वाले काम के बाद आराम: ज़्यादा सावधानी वाली गर्मी में 15 मिनट, ख़तरे वाली में 30 मिनट। आराम काम के घंटों के अंदर ख़त्म होना चाहिए।",
    NO_WEATHER: "मौसम की जानकारी नहीं तो गर्मी वाला प्लान नहीं।",
    TARGET_NEVER_RELAXES: "कमाई का लक्ष्य ऊपर का कोई नियम कभी ढीला नहीं करता।",
    SCORE_NOT_RISK: "गर्मी स्कोर प्लान बनाने का पैमाना है, बीमारी के ख़तरे का अनुमान नहीं।",
    FORECAST_NOT_WBGT: "पूर्वानुमान मौक़े पर मापी गई गर्मी नहीं है। हीट इंडेक्स WBGT नहीं है।",
    COOLED_ASSUMPTION: "\"अंदर, ठंडी जगह\" मानता है कि कूलिंग चल रही है। गर्म, बंद कमरा ठंडा नहीं है।",
    REST_PROTOTYPE: "आराम के समय प्रोटोटाइप नियम हैं, किसी व्यक्ति के लिए काम-आराम का नुस्ख़ा नहीं।",
  },
};

export function ruleText(code: string | undefined, english: string, lang: Lang) {
  return (code && RULES[lang][code]) || english;
}
