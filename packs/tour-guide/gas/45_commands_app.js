/**
 * Tour Guide Commands in the app (the Commands tab): every command the bot answers, grouped by purpose, each with what it
 * does, the forms it takes and how the app runs each form, added to TG_APP_OPS (32_app_api.js) from this file:
 *   commands.list    → { groups: [{ id, title, about, commands: [{ cmd, does, help, keywords, runnable, fields, forms: [{ text, means,
 *                        run: 'now' | 'form' | 'type', tpl?, parts?, confirm? }] }] }], tips, count }
 *   commands.context → what the form pickers offer: trips, the current trip's days, place names, saved lists, sections
 *   commands.run     → { text, nonce? }: runs the command as if typed (core runOwnerCommand); the answer comes in the chat
 * The list itself is the core's registry (listCommands(), 02_registry.js): a command shows only when the bot answers it, so
 * the tab never offers one that is not there, and every command it shows can be run (a form, or the app's "type the rest"
 * box). TG_CMD_GUIDE adds the plain-words description, the example forms and the form templates (core/18_command_forms.js);
 * a command it does not describe still shows, under "More", with its registered help line. The same guide orders Telegram's
 * "/" menu (renderer 'command_menu'). The test tests/pack_tour-guide_commands_app.test.js fails when a registered command
 * has no entry here, an entry names a command nobody registers, a template does not parse, or an example does not fill its
 * template. Examples use invented places only (this file is public). Defaults: helpers/decisions/TG-COMMANDS.md and
 * helpers/decisions/TG-PHASE-17.md.
 */
var TG_CMD_GROUPS = [
  { id: 'start', title: 'Get started', about: 'Tell Tour Guide how you like to travel.' },
  { id: 'plan', title: 'Plan a trip', about: 'From a destination to a day-by-day plan.' },
  { id: 'trip', title: 'Your trip and its days', about: 'Read and change the plan of the current trip.' },
  { id: 'day', title: 'On the day', about: 'While you travel: the morning message, running late and the evening check-in.' },
  { id: 'discover', title: 'Discover', about: 'Research one question at a time; each answer arrives in the chat and in its tab here.' },
  { id: 'places', title: 'Places and lists', about: 'Everything Tour Guide has researched, and your saved Google Maps lists.' },
  { id: 'after', title: 'After the trip', about: 'Your ratings shape the next plan.' },
  { id: 'chat', title: 'Ask and settings', about: 'Questions, answer mode and the conversation in progress.' },
  { id: 'system', title: 'Housekeeping', about: 'Checks on the helper itself; rarely needed.' }
];
/*
 * One entry per command, in the order the tab shows them inside their group. A form is [as typed, what it does, how the app
 * runs it?]. The bare command runs as it is. Any other form says how: { fixed: true } runs the text as it is (e.g.
 * '/journey on'); { tpl } is a form template (core/18_command_forms.js) whose fields the entry's `fields` describe, and the
 * example is only an illustration. { confirm: true } asks before running (it changes or drops something). The test proves
 * every template parses, uses only described fields, and is filled by its own example.
 */
var TG_F = {
  day: { kind: 'day', label: 'Day', hint: 'a day of the current trip' },
  date: { kind: 'date', label: 'Date' },
  place: { kind: 'place', label: 'Place', hint: 'a name, as on Google Maps', max_len: 120 },
  places: { kind: 'text', label: 'Places', hint: 'names, separated by commas', max_len: 300 },
  trip: { kind: 'trip', label: 'Trip' },
  list: { kind: 'list', label: 'Saved list' },
  city: { kind: 'text', label: 'Where', hint: 'a city or area', max_len: 80 }
};
var TG_CMD_GUIDE = [
  // Get started
  { cmd: '/start', group: 'start', does: 'Greets you and, when there is no travel profile yet, offers the interview.', forms: [['/start', 'say hello to the bot']] },
  { cmd: '/help', group: 'start', does: 'Lists every command with a one-line hint, right in the chat.', forms: [['/help', 'the short list']] },
  { cmd: '/interview', group: 'start', does: 'The preference interview: short questions, one at a time, any of them skippable. Your answers become your travel profile. The Interview tab in this app does the same with everything on one screen.',
    fields: { section: { kind: 'choice', label: 'Section', from: 'sections' } },
    forms: [['/interview', 'start, or pick up where you stopped'], ['/interview food', 'redo one section', { tpl: '/interview {section}' }],
      ['/interview all', 'start over from the first question', { fixed: true, confirm: true }]] },
  { cmd: '/profile', group: 'start', does: 'Shows your travel profile as Tour Guide understands it, with buttons to redo a section.', forms: [['/profile', 'your profile']] },
  // Plan a trip
  { cmd: '/plan', group: 'plan', does: 'Plans a trip: Tour Guide confirms the facts (dates, where you stay), researches a shortlist you tick ✅ want · 🔖 later · ❌ skip, then builds the days, the notes and the brochure.',
    fields: { where: { kind: 'text', label: 'Destination', hint: 'a city or region', max_len: 80 } },
    forms: [['/plan Lisbon', 'start planning a trip; send it again to see where it is', { tpl: '/plan {where}' }], ['/plan', 'where the trip being planned is']] },
  { cmd: '/seed', group: 'plan', does: 'Adds places you already know you want to the plan being built.', fields: { places: TG_F.places },
    forms: [['/seed Harbour Museum, Reed Mill', 'these go into the plan', { tpl: '/seed {places}' }]] },
  { cmd: '/repick', group: 'plan', does: 'Reopens the shortlist with every tick kept, so you can change your picks and build the plan again.',
    fields: { marks: { kind: 'text', label: 'Numbers to mark', hint: 'e.g. 2 6 later 7, or r1 5 for round 1', max_len: 120 } },
    forms: [['/repick', 'reopen the shortlist', { confirm: true }], ['/repick 2 6 later 7', 'reopen it and mark those numbers too', { tpl: '/repick {marks}' }],
      ['/repick r1 5', 'mark number 5 of round 1', { tpl: '/repick {marks}' }]] },
  { cmd: '/journey', group: 'plan', does: 'Turns on or off the step that compares outlines of the whole trip and versions of each day before the plan is built.',
    forms: [['/journey', 'show whether it is on'], ['/journey on', 'compare outlines and day versions first', { fixed: true }], ['/journey off', 'go straight to the plan', { fixed: true }]] },
  { cmd: '/outline', group: 'plan', does: 'Shows the outlines of the trip side by side and lets you choose one, or mix days from several. The Compare tab shows the same.',
    fields: { pick: { kind: 'text', label: 'Your choice', hint: 'an outline letter, then any days from others: A 3B', max_len: 60 } },
    forms: [['/outline', 'the newest outlines'], ['/outline A', 'choose outline A', { tpl: '/outline {pick}' }], ['/outline A 3B', 'outline A, but day 3 from B', { tpl: '/outline {pick}' }]] },
  { cmd: '/versions', group: 'plan', does: 'Shows the versions of one day. On a day that is already planned, choosing a version replaces it.', fields: { day: TG_F.day },
    forms: [['/versions', 'the days that have versions'], ['/versions 2', 'the versions of day 2', { tpl: '/versions {day}' }], ['/versions tomorrow', 'by date word or date', { tpl: '/versions {day}' }]] },
  { cmd: '/dates', group: 'plan', does: 'Sets the trip\'s dates, the hours of each day and one day\'s own start, end, bags or weather town. The next plan or re-plan uses them.',
    fields: { start: { kind: 'date', label: 'First day' }, end: { kind: 'date', label: 'Last day', hint: 'leave empty for a one-day trip' },
      from: { kind: 'time', label: 'Days start' }, to: { kind: 'time', label: 'Days end' }, on: { kind: 'date', label: 'Which day' },
      place: { kind: 'place', label: 'Starts at', hint: 'a station, the hotel…', max_len: 120 }, time: { kind: 'time', label: 'At' },
      bags: { kind: 'choice', label: 'Bags', options: ['hotel', 'locker', 'forward', 'carry'] }, note: { kind: 'text', label: 'Note', max_len: 120 } },
    forms: [['/dates', 'show the dates and day hours'], ['/dates 2027-05-12 2027-05-14', 'set the trip dates', { tpl: '/dates {start}[ {end}]' }],
      ['/dates hours 09:30 19:00', 'when days start and end', { tpl: '/dates hours {from} {to}' }],
      ['/dates 2027-05-12 start Central Station 12:10', 'one day starts at a place and time', { tpl: '/dates {on} start {place} {time}' }],
      ['/dates 2027-05-12 bags locker', 'what happens to the bags that day', { tpl: '/dates {on} bags {bags}[ {note}]' }]] },
  { cmd: '/lodging', group: 'plan', does: 'Records where you stay, by night. With a plan, Tour Guide offers to re-plan the days a change touches.',
    fields: { name: { kind: 'text', label: 'Where you stay', max_len: 120 }, first: { kind: 'date', label: 'First night' }, out: { kind: 'date', label: 'Check-out' },
      night: { kind: 'date', label: 'First night of the stay' }, where: { kind: 'text', label: 'Where you stay', hint: 'one place for the whole trip', max_len: 120 } },
    forms: [['/lodging', 'the stays saved so far'], ['/lodging Old Mill Hostel 2027-05-12 to 2027-05-14', 'a stay with its first night and check-out', { tpl: '/lodging {name} {first} to {out}' }],
      ['/lodging remove 2027-05-12', 'drop the stay that starts that night', { tpl: '/lodging remove {night}', confirm: true }],
      ['/lodging clear', 'drop every stay', { fixed: true, confirm: true }], ['/lodging near the old harbour', 'one place, no dates', { tpl: '/lodging {where}' }]] },
  // Your trip and its days
  { cmd: '/trip', group: 'trip', does: 'Shows the current trip: its dates, its days and buttons for each. Naming another trip makes it the current one.',
    fields: { trip: TG_F.trip },
    forms: [['/trip', 'the current trip'], ['/trip Lisbon', 'switch to another trip', { tpl: '/trip {trip}' }]] },
  { cmd: '/today', group: 'trip', does: 'Shows today\'s plan, or how many days are left before the trip starts.', forms: [['/today', 'today\'s day card']] },
  { cmd: '/day', group: 'trip', does: 'Shows one day of the plan: times, places, travel between them, bookings and warnings.', fields: { day: TG_F.day },
    forms: [['/day 2', 'day 2', { tpl: '/day {day}' }], ['/day 2027-05-13', 'the day with that date', { tpl: '/day {day}' }]] },
  { cmd: '/replan', group: 'trip', does: 'Rebuilds one day, with your reason. The brochure is rebuilt too when the trip has one.',
    fields: { day: TG_F.day, why: { kind: 'text', label: 'What to change', hint: 'e.g. it will rain, more time at the market', max_len: 300 } },
    forms: [['/replan day 2 more time at the market', 'rebuild day 2', { tpl: '/replan {day}[ {why}]', confirm: true }],
      ['/replan tomorrow it will rain', 'by date word or date', { tpl: '/replan {day}[ {why}]', confirm: true }]] },
  { cmd: '/later', group: 'trip', does: 'The saved-for-later list: places researched but not planned. A button moves one onto a day.', forms: [['/later', 'the list']] },
  { cmd: '/brochure', group: 'trip', does: 'Sends the brochure PDF of the current trip, or has it built when there is none yet.', forms: [['/brochure', 'the brochure']] },
  { cmd: '/notes', group: 'trip', does: 'Has the personal notes written for the places of the current trip.', fields: { places: TG_F.places },
    forms: [['/notes', 'every place of the plan'], ['/notes Harbour Museum, Reed Mill', 'only these', { tpl: '/notes {places}' }]] },
  { cmd: '/bookings', group: 'trip', does: 'Lists the bookings still to make, nearest deadline first. Reminders come by themselves; ✅ Booked or Not needed stops them.',
    forms: [['/bookings', 'the open bookings'], ['/bookings now', 'today\'s reminder at once, with its buttons', { fixed: true }]] },
  { cmd: '/vegcard', group: 'trip', does: 'The party\'s "what we cannot eat" card in the local language and English, to show staff.',
    forms: [['/vegcard', 'the card (it is made the first time)'], ['/vegcard rebuild', 'make it again', { fixed: true }]] },
  // On the day
  { cmd: '/morning', group: 'day', does: 'The morning message: the whole day in one message that still reads offline, sent by itself each trip morning (07:00 unless you change it).',
    fields: { day: TG_F.day, time: { kind: 'time', label: 'Send it at', min: '05:00', max: '11:59' } },
    forms: [['/morning', 'today\'s message now'], ['/morning day 2', 'rehearse another day', { tpl: '/morning {day}' }],
      ['/morning at 07:30', 'change the time (05:00–11:59)', { tpl: '/morning at {time}' }], ['/morning off', 'stop it', { fixed: true }], ['/morning on', 'bring it back', { fixed: true }]] },
  { cmd: '/late', group: 'day', does: 'Running late: moves the rest of today later at once. Bookings and fixed times stay; a stop that no longer fits is dropped with its reason. ↩️ Undo puts the day back.',
    fields: { min: { kind: 'number', label: 'Minutes', min: 5, max: 240, chips: [15, 30, 45, 60] }, day: { kind: 'day', label: 'Rehearse on', hint: 'leave empty for today' } },
    forms: [['/late 30', 'the rest of today 30 minutes later (5–240)', { tpl: '/late {min}[ {day}]' }], ['/late 30 2', 'rehearse it on day 2', { tpl: '/late {min}[ {day}]' }]] },
  { cmd: '/checkin', group: 'day', does: 'The evening check-in: rate today\'s stops 👍 👎 ⏭ and whether they needed more or less time. It also comes by itself each trip evening.',
    fields: { day: TG_F.day },
    forms: [['/checkin', 'rate today now'], ['/checkin day 2', 'rehearse another day (taps not saved)', { tpl: '/checkin {day}' }]] },
  { cmd: '/route', group: 'day', does: 'Directions between two places with the travel time and a Google Maps link.',
    fields: { from: { kind: 'place', label: 'From', max_len: 120 }, to: { kind: 'place', label: 'To', max_len: 120 },
      mode: { kind: 'choice', label: 'By', options: ['transit', 'walk', 'drive'], hint: 'transit when empty' } },
    forms: [['/route Old Mill Hostel → Harbour Museum', 'by transit', { tpl: '/route {from} → {to}[ {mode}]' }],
      ['/route Old Mill Hostel → Harbour Museum walk', 'add walk, transit or drive ("A to B" works too)', { tpl: '/route {from} → {to}[ {mode}]' }]] },
  // Discover
  { cmd: '/scout', group: 'discover', does: 'Searches a whole place for one food or activity and answers with a ranked list. Every place lands in Places; ➕ saves one for later.',
    fields: { what: { kind: 'text', label: 'Looking for', hint: 'one food or activity', max_len: 80 }, where: TG_F.city },
    forms: [['/scout pastries in Lyon', 'one thing, one place', { tpl: '/scout {what}[ in {where}]' }], ['/scout ramen', 'in the current trip\'s destination', { tpl: '/scout {what}[ in {where}]' }]] },
  { cmd: '/scouts', group: 'discover', does: 'Your last 10 scouts, each with a button that shows its list again.', forms: [['/scouts', 'the last 10']] },
  { cmd: '/compare', group: 'discover', does: 'Puts two to four places, or one of your saved lists, side by side.',
    fields: { places: { kind: 'text', label: 'Places', hint: 'two to four names, separated by commas', max_len: 300 }, list: TG_F.list, where: TG_F.city },
    forms: [['/compare Reed Mill, Pear Press', 'two to four places', { tpl: '/compare {places}[ in {where}]' }], ['/compare Coffee to try in Lyon', 'one of your lists', { tpl: '/compare {list}[ in {where}]' }],
      ['/compare Reed Mill, Pear Press in Lyon', 'say where they are', { tpl: '/compare {places}[ in {where}]' }]] },
  { cmd: '/daytrip', group: 'discover', does: 'Day trips worth the ride from a base, ranked, within the ride you name. Keep the ones you like; on a planned trip, put one on a day.',
    fields: { from: { kind: 'text', label: 'From', hint: 'where the trip stays when empty', max_len: 80 }, under: { kind: 'number', label: 'One way, at most (minutes)', min: 30, max: 180, chips: [60, 90, 120, 180] }, date: TG_F.date },
    forms: [['/daytrip from Lyon under 90 min', 'from a place, one-way limit', { tpl: '/daytrip[ from {from}][ under {under} min][ on {date}]' }],
      ['/daytrip from Lyon under 120 min on 5/14', 'for a date ("under 2 h" works too)', { tpl: '/daytrip[ from {from}][ under {under} min][ on {date}]' }], ['/daytrip', 'from where the current trip stays']] },
  { cmd: '/daytrips', group: 'discover', does: 'Your last 10 day-trip boards, the trips you kept first.', forms: [['/daytrips', 'the last 10']] },
  { cmd: '/whatson', group: 'discover', does: 'What is on in a place (events, markets, festivals) for up to 31 days, grouped by date. Choose things for days and the plan carries them. Trips are also checked weekly; you hear only about new things.',
    fields: { where: { kind: 'text', label: 'Where', hint: 'the current trip\'s place when empty', max_len: 80 },
      when: { kind: 'text', label: 'When', hint: 'or dates like 12-14 may', chips: ['today', 'tomorrow', 'this weekend', 'this week', 'next week'], max_len: 40 } },
    forms: [['/whatson', 'the current trip\'s place and dates'], ['/whatson Lyon this weekend', 'any place and dates', { tpl: '/whatson[ {where}][ {when}]' }],
      ['/whatson last', 'the last boards', { fixed: true }], ['/whatson auto off', 'stop the weekly check', { fixed: true }], ['/whatson auto on', 'check trips weekly again', { fixed: true }]] },
  { cmd: '/quiet', group: 'discover', does: 'For a crowded place you want to see anyway: up to 3 quieter places of the same kind nearby, and its quietest hours.',
    fields: { place: TG_F.place, date: TG_F.date },
    forms: [['/quiet Harbour Museum', 'quieter alternatives', { tpl: '/quiet {place}[ on {date}]' }], ['/quiet Harbour Museum on 5/13', 'for a day of the trip', { tpl: '/quiet {place}[ on {date}]' }],
      ['/quiet', 'buttons for the crowded stops ahead']] },
  { cmd: '/menu', group: 'discover', does: 'Reads a restaurant\'s own menu: the dishes your party can eat, what to ask about, and what does not fit.',
    fields: { place: { kind: 'place', label: 'Restaurant', max_len: 120 }, date: { kind: 'date', label: 'Dinner on' } },
    forms: [['/menu Brindle Lantern', 'check a restaurant', { tpl: '/menu {place}[ on {date}]' }], ['/menu Brindle Lantern on 5/13', 'for a dinner on that day', { tpl: '/menu {place}[ on {date}]' }],
      ['/menu', 'buttons for the planned dinners']] },
  // Places and lists
  { cmd: '/places', group: 'places', does: 'Everything Tour Guide knows, counted by destination, or searched. Each match has 📝 full note · ➕ add to the trip · 🔁 fresh check.',
    fields: { q: { kind: 'text', label: 'Search', hint: 'a name, tag or area', max_len: 80 } },
    forms: [['/places', 'counts by destination'], ['/places museum', 'search by name, tag or area', { tpl: '/places {q}' }]] },
  { cmd: '/place', group: 'places', does: 'One place: its note line, its map link, and the day it is planned on or that it is saved for later.', fields: { place: TG_F.place },
    forms: [['/place Harbour Museum', 'one place', { tpl: '/place {place}' }]] },
  { cmd: '/lists', group: 'places', does: 'Your saved Google Maps lists with their counts, read from a Google Takeout export in Drive.',
    forms: [['/lists', 'your lists'], ['/lists sync', 'read the newest export now', { fixed: true }], ['/lists auto off', 'stop reading new exports by itself', { fixed: true }],
      ['/lists auto on', 'read new exports by itself again', { fixed: true }]] },
  { cmd: '/list', group: 'places', does: 'One saved list\'s places, by destination.', fields: { list: TG_F.list }, forms: [['/list Coffee to try', 'one list', { tpl: '/list {list}' }]] },
  // After the trip
  { cmd: '/review', group: 'after', does: 'Rates the places of a trip, one at a time; your evening check-ins are already counted. Offered by itself the day after a trip ends.',
    fields: { trip: TG_F.trip },
    forms: [['/review', 'the trip that just ended, else the current one'], ['/review Lisbon', 'another trip', { tpl: '/review {trip}' }]] },
  // Ask and settings
  { cmd: '/ask', group: 'chat', does: 'Sends a question or task to Tour Guide; the answer comes in the chat a few minutes later. Plain text does the same, except that with /smart on plain questions about the plan are answered at once.',
    fields: { q: { kind: 'text', label: 'Your question', max_len: 400 } },
    forms: [['/ask is the castle open on Mondays?', 'one question', { tpl: '/ask {q}' }]] },
  { cmd: '/smart', group: 'chat', does: 'Quick answers: with it on, plain questions about your plan are answered at once by the Claude API (paid per use). Off, everything goes to research (free, a few minutes).',
    forms: [['/smart', 'show the mode and today\'s cost'], ['/smart on', 'quick answers', { fixed: true }], ['/smart off', 'free answers', { fixed: true }]] },
  { cmd: '/cancel', group: 'chat', does: 'Stops the conversation in progress, such as an interview or a plan being set up.', forms: [['/cancel', 'stop it', { confirm: true }]] },
  { cmd: '/status', group: 'chat', does: 'How the helper is doing: waiting requests, pending questions, the last mailbox check and the answer mode.', forms: [['/status', 'the counts']] },
  { cmd: '/pending', group: 'chat', does: 'Sends again every proposal still waiting for your ✅ or ❌.', forms: [['/pending', 'the waiting proposals']] },
  // Housekeeping
  { cmd: '/wake', group: 'system', does: 'Checks the mailbox within a minute instead of waiting, for an answer that seems late.', forms: [['/wake', 'check now']] },
  { cmd: '/expire', group: 'system', does: 'Clears proposals that waited too long.', forms: [['/expire', 'clear them', { confirm: true }]] },
  { cmd: '/ping', group: 'system', does: 'Answers with the time and version, to show the bot is alive.', forms: [['/ping', 'pong']] },
  { cmd: '/id', group: 'system', does: 'Shows the chat and user ids, for setup.', forms: [['/id', 'the ids']] }
];
/** What works without a command: shown under the groups. */
var TG_CMD_TIPS = [
  { title: 'Just type', text: 'Anything that is not a command is a question or a request for Tour Guide. It answers in the chat.' },
  { title: 'Pick by numbers', text: 'While choosing from a shortlist, type the numbers in one message, e.g. 1 3 9 later 2 skip 4-8. A place name adds your own pick.' },
  { title: 'Buttons', text: 'Most answers carry buttons that do the same as a command: ⏰ running late, 📍 re-plan from here, 🕊 quieter, 🍽 menu, 🔁 re-plan a day.' },
  { title: 'Re-plan from here', text: '📍 on the morning message rebuilds the rest of today from the stop you are at, from a location you share once, or rain-first.' }
];

/*
 * What you might type when you want each command ("running late", "rain", "dinner"): the app's "What do you want to do?"
 * search matches these words as well as the description and the examples. Lower case, plain words; the test requires a
 * line for every guide entry.
 */
var TG_CMD_KEYWORDS = {
  '/start': 'begin pair connect setup', '/help': 'help commands list what can you do',
  '/interview': 'questions preferences profile about me taste diet companion who travels',
  '/profile': 'profile preferences what you know about me summary diet',
  '/plan': 'new trip start trip destination go to visit holiday vacation itinerary',
  '/seed': 'add places must see want to visit include ideas', '/repick': 'choose again shortlist change picks reopen redo choices',
  '/journey': 'outlines versions compare options before plan setting switch',
  '/outline': 'outlines trip shape compare options which route', '/versions': 'versions of a day options alternatives compare day',
  '/dates': 'dates when change dates start end hours bags luggage day start time arrival',
  '/lodging': 'hotel stay lodging accommodation airbnb where we sleep night check in out',
  '/trip': 'trip overview switch trip current trip summary', '/today': 'today now plan today what is today schedule',
  '/day': 'day schedule itinerary show day plan of a day',
  '/replan': 'replan change day rebuild rain weather tired swap redo day different',
  '/later': 'later saved for later backlog unused places someday', '/brochure': 'brochure pdf document print guide booklet',
  '/notes': 'notes personal notes write ups descriptions why go',
  '/bookings': 'bookings reservations tickets reserve book ahead deadlines reminders',
  '/vegcard': 'vegetarian card diet allergy food restrictions translation show waiter staff',
  '/morning': 'morning message daily brief wake up alarm forecast weather today summary time',
  '/late': 'late running late delay behind schedule slow push back',
  '/checkin': 'evening rate ratings review today feedback thumbs',
  '/route': 'directions route how to get there travel time transit walk train subway drive navigate',
  '/scout': 'find best search food activity coffee ramen tea dessert shopping ideas recommend',
  '/scouts': 'past scouts earlier searches results', '/compare': 'compare choose between which one better versus options',
  '/daytrip': 'day trip excursion out of town nearby towns side trip',
  '/daytrips': 'past day trips earlier boards', '/whatson': 'events festival concert exhibition whats on happening tonight things to do',
  '/quiet': 'quiet crowd crowded busy less busy alternative calm peaceful',
  '/menu': 'menu dinner restaurant food vegetarian eat lunch dishes fits diet',
  '/places': 'places search repository saved researched find place', '/place': 'place details one place info',
  '/lists': 'google maps lists saved lists takeout import', '/list': 'one saved list google maps list',
  '/review': 'review after trip rate trip ratings feedback memories',
  '/ask': 'ask question help me anything request', '/smart': 'smart quick answers api mode fast answers cost setting',
  '/cancel': 'cancel stop abort quit conversation', '/status': 'status health queue counts working',
  '/pending': 'pending proposals waiting approvals', '/wake': 'check now refresh sweep mailbox wake update',
  '/expire': 'clear old proposals expire cleanup', '/ping': 'ping alive test working version', '/id': 'id chat id user id'
};

/* ==================== ops ==================== */

var TG_CMD_CTX_DAYS_MAX = 31;     // commands.context: the current trip's dates offered as days
var TG_CMD_CTX_PLACES_MAX = 80;   // commands.context: place names offered while typing (stops, then Later)
var TG_CMD_NONCE_RE = /^[A-Za-z0-9_-]{8,40}$/;
var TG_CMD_FIELD_KEYS = ['kind', 'label', 'hint', 'min', 'max', 'chips', 'options', 'from', 'max_len'];

/** A guide form → { text, means, run: 'now' | 'form' | 'type', parts?, confirm? } (see the TG_CMD_GUIDE comment). */
function tgCmdFormOut(f, cmd) {
  var o = f[2] || {}, out = { text: f[0], means: f[1] || '' };
  if (o.tpl) {
    var p = cmdTemplateParse(o.tpl);
    if (p.ok) { out.run = 'form'; out.tpl = o.tpl; out.parts = p.parts; }
    else out.run = 'type';   // never in the shipped guide (the test parses every template); the app falls back to its box
  } else out.run = (f[0] === cmd || o.fixed) ? 'now' : 'type';
  if (o.confirm) out.confirm = true;
  return out;
}
function tgCmdFieldsOut(fields) {
  var out = {};
  Object.keys(fields || {}).forEach(function (n) {
    var f = fields[n], o = {};
    TG_CMD_FIELD_KEYS.forEach(function (k) { if (f[k] !== undefined) o[k] = f[k]; });
    out[n] = o;
  });
  return out;
}

/** commands.list: the registry's commands, described and grouped, each with its forms and fields (see the header). */
function tgAppOpCommands() {
  var live = listCommands(), help = {}, described = {}, byGroup = {};
  live.forEach(function (c) { help[c.cmd] = c.help; });
  var runnable = function (cmd) { return HB_CHAT_ONLY_COMMANDS.indexOf(cmd) < 0; };
  var groups = TG_CMD_GROUPS.map(function (g) { var o = { id: g.id, title: g.title, about: g.about, commands: [] }; byGroup[g.id] = o; return o; });
  TG_CMD_GUIDE.forEach(function (e) {
    described[e.cmd] = true;
    if (!Object.prototype.hasOwnProperty.call(help, e.cmd) || !byGroup[e.group]) return;
    byGroup[e.group].commands.push({ cmd: e.cmd, does: e.does, help: help[e.cmd], keywords: TG_CMD_KEYWORDS[e.cmd] || '', runnable: runnable(e.cmd), fields: tgCmdFieldsOut(e.fields),
      forms: e.forms.map(function (f) { return tgCmdFormOut(f, e.cmd); }) });
  });
  var more = live.filter(function (c) { return !described[c.cmd]; }).map(function (c) {
    return { cmd: c.cmd, does: c.help, help: c.help, keywords: '', runnable: runnable(c.cmd), fields: {}, forms: [{ text: c.cmd, means: '', run: 'now' }] };
  });
  if (more.length) groups.push({ id: 'more', title: 'More', about: 'Commands the bot answers that have no description here yet; /help has their hint.', commands: more });
  return tgAppOk({ groups: groups.filter(function (g) { return g.commands.length; }), tips: TG_CMD_TIPS, count: live.length });
}

/**
 * commands.context: what the form pickers offer, read once when a form opens — the trips (current first), the current
 * trip's days (its dates, with the plan's theme where there is one), place names to type ahead (its stops, then Later),
 * your saved lists and the interview's sections. The pack's own rows only.
 */
function tgAppOpCommandsContext() {
  var cur = tgTripCurrent(), list = tgTripList().filter(function (t) { return t.status !== 'done'; });
  var tripOut = function (t) { return { slug: t.slug, title: tgAppS(t.title || t.destination || t.slug), start: tgAppS(t.start), end: tgAppS(t.end) }; };
  var trips = (cur ? [cur] : []).concat(list.filter(function (t) { return !cur || t.slug !== cur.slug; })).map(tripOut);
  var days = [], places = [], seen = {};
  var addPlace = function (n) { n = tgAppS(n).trim(); var k = n.toLowerCase(); if (n && !seen[k] && places.length < TG_CMD_CTX_PLACES_MAX) { seen[k] = true; places.push(n); } };
  if (cur) {
    var planned = {};
    tgDigestDays(cur.slug).forEach(function (d) {
      planned[d.date] = d;
      (Array.isArray(d.stops) ? d.stops : []).forEach(function (s) { if (isPlainObject(s)) addPlace(s.name); });
    });
    var dates = [];
    if (cur.start && tgEnvRealDate(cur.start)) {
      var end = cur.end && tgEnvRealDate(cur.end) && cur.end >= cur.start ? cur.end : cur.start;
      for (var d = cur.start; d <= end && dates.length < TG_CMD_CTX_DAYS_MAX; d = isoDateAdd(d, 1)) dates.push(d);
    } else dates = Object.keys(planned).sort().slice(0, TG_CMD_CTX_DAYS_MAX);
    days = dates.map(function (date, i) { var p = planned[date]; return { date: date, n: i + 1, theme: p ? tgAppS(p.theme) : '', planned: !!p }; });
    tgLaterList(cur.slug).forEach(function (l) { addPlace(l.name); });
  }
  var lists = [];
  try { lists = tgListNames().map(function (x) { return { name: x.name, count: x.count }; }); } catch (e) { lists = []; }
  var sections = tgIvSections().map(function (s) { return { value: tgAppS(s.id), label: tgAppS(s.title || s.id) }; });
  return tgAppOk({ trip: cur ? tripOut(cur) : null, today: cur ? tgTripToday(cur) : isoDateIn(getTz()), trips: trips, days: days,
    places: places, lists: lists, sections: sections });
}

/**
 * commands.run { text, nonce? }: runs one command exactly as if typed in the chat (core runOwnerCommand): the bot posts
 * "▶️ /cmd … · from the app" and the answer threads under it. A nonce seen in the last few minutes is not run again (a
 * double tap or a retried call). Refusals: 400 bad_text | not_command · 404 unknown_command · 409 chat_only ·
 * 503 no_chat | send_failed.
 */
var TG_CMD_RUN_STATUS = { bad_text: 400, not_command: 400, unknown_command: 404, chat_only: 409, no_chat: 503, send_failed: 503 };
function tgAppOpCommandsRun(args) {
  var text = tgAppStr(args, 'text', { required: true, max: HB_RUN_TEXT_MAX });
  var nonce = tgAppStr(args, 'nonce', { max: 40, re: TG_CMD_NONCE_RE });
  if (nonce && seenOnce('apprun:' + nonce)) return tgAppOk({ duplicate: true });
  var r = runOwnerCommand(text, { via: 'app' });
  if (!r.ok) tgAppRefuse(TG_CMD_RUN_STATUS[r.reason] || 400, r.reason || 'bad_text');
  return tgAppOk({ cmd: r.cmd, message_id: r.message_id });
}
TG_APP_OPS['commands.list'] = { args: [], fn: tgAppOpCommands };
TG_APP_OPS['commands.context'] = { args: [], fn: tgAppOpCommandsContext };
TG_APP_OPS['commands.run'] = { args: ['text', 'nonce'], write: true, fn: tgAppOpCommandsRun };

/**
 * Telegram's "/" menu (core syncBotCommands): the commands in this guide's order, each with the hint it was registered
 * with (else the first sentence of its description), then any command the guide does not describe.
 */
registerRenderer('command_menu', function (live) {
  var help = {}, rows = [], seen = {};
  (live || []).forEach(function (c) { help[c.cmd] = c.help; });
  TG_CMD_GUIDE.forEach(function (e) {
    if (!Object.prototype.hasOwnProperty.call(help, e.cmd)) return;
    seen[e.cmd] = true;
    rows.push({ cmd: e.cmd, description: help[e.cmd] || String(e.does).split('. ')[0] });
  });
  (live || []).forEach(function (c) { if (!seen[c.cmd]) rows.push({ cmd: c.cmd, description: c.help }); });
  return rows;
});

// Developed by: LightAISolutions
