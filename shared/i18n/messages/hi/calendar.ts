/** hi - calendar messages. Keys are prefixed 'calendar.'; see shared/i18n/index.ts for the syntax. */
const messages: Record<string, string> = {
  // Calendar page (src/pages/CalendarPage.tsx) -------------------------------------------
  'calendar.title': 'कैलेंडर',
  'calendar.nav.previousMonth': 'पिछला महीना',
  'calendar.nav.nextMonth': 'अगला महीना',
  'calendar.nav.label': 'कैलेंडर नेविगेशन',
  'calendar.select.month': 'महीना',
  'calendar.select.year': 'साल',
  // The calendar-system select ("Gregorian / Hebrew / Hijri"); it decides the day numbers and the holidays of the grid
  'calendar.select.system': 'कैलेंडर',
  'calendar.system.gregorian': 'ग्रेगोरियन',
  'calendar.system.hebrew': 'हिब्रू',
  'calendar.system.hijri': 'हिजरी (इस्लामी)',
  // {label} = one of the calendar.system.* names
  'calendar.system.unsupported': '{label} (इस ब्राउज़र में समर्थित नहीं)',
  'calendar.system.legend':
    'दिखाया गया कैलेंडर: {label}। दिनों की संख्याएँ और त्योहार इसी कैलेंडर के अनुसार हैं; बाकी कैलेंडरों में इस महीने की अवधि तालिका के ऊपर दिखाई गई है।',

  // The month's span in the two calendars that are NOT the selected one: one full sentence each, shown above the table.
  // {month} = the month title ("Tishri 5787", "September 2026"); the "Lead" forms open the line with it.
  // Gregorian span: {from} / {to} = civil dates in the language's numeric form ("12/09/2026"; "12.09.2026" in Hebrew)
  'calendar.span.gregorian': '{month}: {from} से {to} तक',
  // Hebrew span: {from} / {to} = full Hebrew dates ("19 Elul 5786")
  'calendar.span.hebrewLead': 'हिब्रू कैलेंडर में {month}: {from} से {to} तक',
  'calendar.span.hebrew': 'हिब्रू कैलेंडर में: {from} से {to} तक',
  // Hijri span: {from} / {to} = full Hijri dates ("1 Rabiʻ II 1448")
  'calendar.span.hijriLead': 'हिजरी कैलेंडर में {month}: {from} से {to} तक',
  'calendar.span.hijri': 'हिजरी कैलेंडर में: {from} से {to} तक',

  // Month grid cells ---------------------------------------------------------------------
  // Short metric texts printed in a cell ("Md 7 · En 6"); the legend below explains them
  'calendar.cell.mood': 'मूड {value}',
  'calendar.cell.energy': 'ऊर्जा {value}',
  'calendar.cell.habits': 'आदतें {done}/{total}',
  // Visible marker of a day with entries ("● entry" / "● 3 entries")
  'calendar.cell.entryMarker': '● {count, plural, one {# प्रविष्टि} other {# प्रविष्टियाँ}}',
  // Accessible name of a cell: "{weekday} {date}" then ": " then the details
  // {weekday} = "Monday", {date} = "7 September" or the full date in the selected calendar ("1 Tishri 5787")
  'calendar.cell.date': '{weekday}, {date}',
  // {details} = comma-separated list: the holidays of the selected calendar, mood, energy, habits, entries
  'calendar.cell.aria': '{date}: {details}',
  'calendar.cell.ariaToday': 'आज, {date}: {details}',
  'calendar.cell.hasEntry': '{count, plural, one {प्रविष्टि है} other {# प्रविष्टियाँ}}',
  'calendar.cell.habitsDone': '{total} में से {done} आदतें पूरी हुईं',
  'calendar.cell.noData': 'कोई डेटा नहीं',
  'calendar.legend': 'संकेत: मूड = औसत मूड, ऊर्जा = औसत ऊर्जा, आदतें = कुल आदतों में से पूरी हुई आदतें। ● प्रविष्टि वाले दिन को दर्शाता है।',
  'calendar.keyboardHint':
    'कीबोर्ड नेविगेशन: तीर कुंजियों से दिनों के बीच जाएँ, Home/End से सप्ताह की शुरुआत और अंत पर, PageUp/PageDown से महीनों के बीच, और Enter से दिन का सारांश खोलें।',

  // Holidays and the selected calendar's date (src/pages/entries/CalendarExtras.tsx, DayPage.tsx, EntryPage.tsx)
  // Day page subtitle: {value} = the full date in that calendar
  'calendar.extras.hebrewDateValue': 'हिब्रू तारीख: {value}',
  'calendar.extras.hijriDateValue': 'हिजरी (इस्लामी) तारीख: {value}',
  'calendar.extras.holidaysHeading': 'त्योहार और विशेष दिन',
  // "+N" badge when a cell has more holidays than it can show, and its tooltip
  'calendar.extras.more': '+{count}',
  // {names} = comma-separated holiday names
  'calendar.extras.moreTitle': 'और {count} अन्य: {names}',
  'calendar.extras.legendTitle': 'त्योहारों का संकेत',
  'calendar.extras.hijriNote': 'इस्लामी तारीखें और त्योहार उम्म अल-क़ुरा कैलेंडर के अनुसार हैं और एक दिन आगे-पीछे हो सकते हैं।',
  // Shown when the remembered calendar is unavailable in this browser (the Gregorian calendar is shown instead)
  'calendar.extras.hebrewUnsupported':
    'यह ब्राउज़र हिब्रू कैलेंडर का समर्थन नहीं करता, इसलिए हिब्रू तारीख और यहूदी त्योहार नहीं दिखाए जा रहे हैं।',
  'calendar.extras.hijriUnsupported':
    'यह ब्राउज़र हिजरी कैलेंडर का समर्थन नहीं करता, इसलिए हिजरी तारीख और इस्लामी त्योहार नहीं दिखाए जा रहे हैं।',
  // Multi-day holidays: "Day 2 of 8"
  'calendar.extras.dayOf': 'दिन {index} ({count} में से)',
};
export default messages;
