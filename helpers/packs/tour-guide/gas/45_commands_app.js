/**
 * Tour Guide Commands in the app (the Commands tab): every command the bot answers, grouped by purpose, each with what it
 * does and the forms it takes, added to TG_APP_OPS (32_app_api.js) from this file — the table is read at request time.
 *   commands.list → { groups: [{ id, title, about, commands: [{ cmd, does, forms: [{ text, means }], help }] }], tips, count }
 * The list itself is the core's registry (listCommands(), 02_registry.js): a command shows only when the bot answers it, so
 * the tab never offers one that is not there. TG_CMD_GUIDE adds the plain-words description and the example forms; a
 * command it does not describe still shows, under "More", with the help line it was registered with. The test
 * tests/pack_tour-guide_commands_app.test.js fails when a registered command has no entry here or an entry names a
 * command nobody registers, so a new command lands with its line in the tab. No Google content, no trip data, no writes.
 * Examples use invented places only (this file is public). Defaults: helpers/decisions/TG-COMMANDS.md.
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
/** One entry per command, in the order the tab shows them inside their group: [form as typed, what that form does]. */
var TG_CMD_GUIDE = [
  // Get started
  { cmd: '/start', group: 'start', does: 'Greets you and, when there is no travel profile yet, offers the interview.', forms: [['/start', 'say hello to the bot']] },
  { cmd: '/help', group: 'start', does: 'Lists every command with a one-line hint, right in the chat.', forms: [['/help', 'the short list']] },
  { cmd: '/interview', group: 'start', does: 'The preference interview: short questions, one at a time, any of them skippable. Your answers become your travel profile. The Interview tab in this app does the same with everything on one screen.',
    forms: [['/interview', 'start, or pick up where you stopped'], ['/interview food', 'redo one section'], ['/interview all', 'start over from the first question']] },
  { cmd: '/profile', group: 'start', does: 'Shows your travel profile as Tour Guide understands it, with buttons to redo a section.', forms: [['/profile', 'your profile']] },
  // Plan a trip
  { cmd: '/plan', group: 'plan', does: 'Plans a trip: Tour Guide confirms the facts (dates, where you stay), researches a shortlist you tick ✅ want · 🔖 later · ❌ skip, then builds the days, the notes and the brochure.',
    forms: [['/plan Lisbon', 'start planning a trip; send it again to see where it is']] },
  { cmd: '/seed', group: 'plan', does: 'Adds places you already know you want to the plan being built.', forms: [['/seed Harbour Museum, Reed Mill', 'these go into the plan']] },
  { cmd: '/repick', group: 'plan', does: 'Reopens the shortlist with every tick kept, so you can change your picks and build the plan again.',
    forms: [['/repick', 'reopen the shortlist'], ['/repick 2 6 later 7', 'reopen it and mark those numbers too'], ['/repick r1 5', 'mark number 5 of round 1']] },
  { cmd: '/journey', group: 'plan', does: 'Turns on or off the step that compares outlines of the whole trip and versions of each day before the plan is built.',
    forms: [['/journey', 'show whether it is on'], ['/journey on', 'compare outlines and day versions first'], ['/journey off', 'go straight to the plan']] },
  { cmd: '/outline', group: 'plan', does: 'Shows the outlines of the trip side by side and lets you choose one, or mix days from several. The Compare tab shows the same.',
    forms: [['/outline', 'the newest outlines'], ['/outline A', 'choose outline A'], ['/outline A 3B', 'outline A, but day 3 from B']] },
  { cmd: '/versions', group: 'plan', does: 'Shows the versions of one day. On a day that is already planned, choosing a version replaces it.',
    forms: [['/versions 2', 'the versions of day 2'], ['/versions tomorrow', 'by date word or date']] },
  { cmd: '/dates', group: 'plan', does: 'Sets the trip\'s dates, the hours of each day and one day\'s own start, end, bags or weather town. The next plan or re-plan uses them.',
    forms: [['/dates', 'show the dates and day hours'], ['/dates 2027-05-12 2027-05-14', 'set the trip dates'], ['/dates hours 09:30 19:00', 'when days start and end'],
      ['/dates 2027-05-12 start Central Station 12:10', 'one day starts at a place and time'], ['/dates 2027-05-12 bags locker', 'what happens to the bags that day']] },
  { cmd: '/lodging', group: 'plan', does: 'Records where you stay, by night. With a plan, Tour Guide offers to re-plan the days a change touches.',
    forms: [['/lodging Old Mill Hostel 2027-05-12 to 2027-05-14', 'a stay with its first night and check-out'], ['/lodging remove 2027-05-12', 'drop the stay that starts that night'],
      ['/lodging clear', 'drop every stay'], ['/lodging near the old harbour', 'one place, no dates']] },
  // Your trip and its days
  { cmd: '/trip', group: 'trip', does: 'Shows the current trip: its dates, its days and buttons for each. Naming another trip makes it the current one.',
    forms: [['/trip', 'the current trip'], ['/trip Lisbon', 'switch to another trip']] },
  { cmd: '/today', group: 'trip', does: 'Shows today\'s plan, or how many days are left before the trip starts.', forms: [['/today', 'today\'s day card']] },
  { cmd: '/day', group: 'trip', does: 'Shows one day of the plan: times, places, travel between them, bookings and warnings.',
    forms: [['/day 2', 'day 2'], ['/day 2027-05-13', 'the day with that date']] },
  { cmd: '/replan', group: 'trip', does: 'Rebuilds one day, with your reason. The brochure is rebuilt too when the trip has one.',
    forms: [['/replan day 2 more time at the market', 'rebuild day 2'], ['/replan tomorrow it will rain', 'by date word or date']] },
  { cmd: '/later', group: 'trip', does: 'The saved-for-later list: places researched but not planned. A button moves one onto a day.', forms: [['/later', 'the list']] },
  { cmd: '/brochure', group: 'trip', does: 'Sends the brochure PDF of the current trip, or has it built when there is none yet.', forms: [['/brochure', 'the brochure']] },
  { cmd: '/notes', group: 'trip', does: 'Has the personal notes written for the places of the current trip.',
    forms: [['/notes', 'every place of the plan'], ['/notes Harbour Museum, Reed Mill', 'only these']] },
  { cmd: '/bookings', group: 'trip', does: 'Lists the bookings still to make, nearest deadline first. Reminders come by themselves; ✅ Booked or Not needed stops them.',
    forms: [['/bookings', 'the open bookings'], ['/bookings now', 'today\'s reminder at once, with its buttons']] },
  { cmd: '/vegcard', group: 'trip', does: 'The party\'s "what we cannot eat" card in the local language and English, to show staff.',
    forms: [['/vegcard', 'the card (it is made the first time)'], ['/vegcard rebuild', 'make it again']] },
  // On the day
  { cmd: '/morning', group: 'day', does: 'The morning message: the whole day in one message that still reads offline, sent by itself each trip morning (07:00 unless you change it).',
    forms: [['/morning', 'today\'s message now'], ['/morning day 2', 'rehearse another day'], ['/morning at 07:30', 'change the time (05:00–11:59)'], ['/morning off', 'stop it (/morning on brings it back)']] },
  { cmd: '/late', group: 'day', does: 'Running late: moves the rest of today later at once. Bookings and fixed times stay; a stop that no longer fits is dropped with its reason. ↩️ Undo puts the day back.',
    forms: [['/late 30', 'the rest of today 30 minutes later (5–240)'], ['/late 30 2', 'rehearse it on day 2']] },
  { cmd: '/checkin', group: 'day', does: 'The evening check-in: rate today\'s stops 👍 👎 ⏭ and whether they needed more or less time. It also comes by itself each trip evening.',
    forms: [['/checkin', 'rate today now'], ['/checkin day 2', 'rehearse another day (taps not saved)']] },
  { cmd: '/route', group: 'day', does: 'Directions between two places with the travel time and a Google Maps link.',
    forms: [['/route Old Mill Hostel → Harbour Museum', 'by transit'], ['/route Old Mill Hostel to Harbour Museum walk', 'add walk, transit or drive']] },
  // Discover
  { cmd: '/scout', group: 'discover', does: 'Searches a whole place for one food or activity and answers with a ranked list. Every place lands in Places; ➕ saves one for later.',
    forms: [['/scout pastries in Lyon', 'one thing, one place'], ['/scout ramen', 'in the current trip\'s destination']] },
  { cmd: '/scouts', group: 'discover', does: 'Your last 10 scouts, each with a button that shows its list again.', forms: [['/scouts', 'the last 10']] },
  { cmd: '/compare', group: 'discover', does: 'Puts two to four places, or one of your saved lists, side by side.',
    forms: [['/compare Reed Mill, Pear Press', 'two to four places'], ['/compare Coffee to try in Lyon', 'one of your lists'], ['/compare Reed Mill, Pear Press in Lyon', 'say where they are']] },
  { cmd: '/daytrip', group: 'discover', does: 'Day trips worth the ride from a base, ranked, within the ride you name. Keep the ones you like; on a planned trip, put one on a day.',
    forms: [['/daytrip from Lyon under 90 min', 'from a place, one-way limit'], ['/daytrip from Lyon under 2 h on 5/14', 'for a date'], ['/daytrip', 'from where the current trip stays']] },
  { cmd: '/daytrips', group: 'discover', does: 'Your last 10 day-trip boards, the trips you kept first.', forms: [['/daytrips', 'the last 10']] },
  { cmd: '/whatson', group: 'discover', does: 'What is on in a place (events, markets, festivals) for up to 31 days, grouped by date. Choose things for days and the plan carries them. Trips are also checked weekly; you hear only about new things.',
    forms: [['/whatson', 'the current trip\'s place and dates'], ['/whatson Lyon this weekend', 'any place and dates'], ['/whatson last', 'the last boards'], ['/whatson auto off', 'stop the weekly check']] },
  { cmd: '/quiet', group: 'discover', does: 'For a crowded place you want to see anyway: up to 3 quieter places of the same kind nearby, and its quietest hours.',
    forms: [['/quiet Harbour Museum', 'quieter alternatives'], ['/quiet Harbour Museum on 5/13', 'for a day of the trip'], ['/quiet', 'buttons for the crowded stops ahead']] },
  { cmd: '/menu', group: 'discover', does: 'Reads a restaurant\'s own menu: the dishes your party can eat, what to ask about, and what does not fit.',
    forms: [['/menu Brindle Lantern', 'check a restaurant'], ['/menu Brindle Lantern on 5/13', 'for a dinner on that day'], ['/menu', 'buttons for the planned dinners']] },
  // Places and lists
  { cmd: '/places', group: 'places', does: 'Everything Tour Guide knows, counted by destination, or searched. Each match has 📝 full note · ➕ add to the trip · 🔁 fresh check.',
    forms: [['/places', 'counts by destination'], ['/places museum', 'search by name, tag or area']] },
  { cmd: '/place', group: 'places', does: 'One place: its note line, its map link, and the day it is planned on or that it is saved for later.', forms: [['/place Harbour Museum', 'one place']] },
  { cmd: '/lists', group: 'places', does: 'Your saved Google Maps lists with their counts, read from a Google Takeout export in Drive.',
    forms: [['/lists', 'your lists'], ['/lists sync', 'read the newest export now'], ['/lists auto off', 'stop reading new exports by itself']] },
  { cmd: '/list', group: 'places', does: 'One saved list\'s places, by destination.', forms: [['/list Coffee to try', 'one list']] },
  // After the trip
  { cmd: '/review', group: 'after', does: 'Rates the places of a trip, one at a time; your evening check-ins are already counted. Offered by itself the day after a trip ends.',
    forms: [['/review', 'the trip that just ended, else the current one'], ['/review Lisbon', 'another trip']] },
  // Ask and settings
  { cmd: '/ask', group: 'chat', does: 'Sends a question or task to Tour Guide; the answer comes in the chat a few minutes later. Plain text does the same, except that with /smart on plain questions about the plan are answered at once.',
    forms: [['/ask is the castle open on Mondays?', 'one question']] },
  { cmd: '/smart', group: 'chat', does: 'Quick answers: with it on, plain questions about your plan are answered at once by the Claude API (paid per use). Off, everything goes to research (free, a few minutes).',
    forms: [['/smart', 'show the mode and today\'s cost'], ['/smart on', 'quick answers'], ['/smart off', 'free answers']] },
  { cmd: '/cancel', group: 'chat', does: 'Stops the conversation in progress, such as an interview or a plan being set up.', forms: [['/cancel', 'stop it']] },
  { cmd: '/status', group: 'chat', does: 'How the helper is doing: waiting requests, pending questions, the last mailbox check and the answer mode.', forms: [['/status', 'the counts']] },
  { cmd: '/pending', group: 'chat', does: 'Sends again every proposal still waiting for your ✅ or ❌.', forms: [['/pending', 'the waiting proposals']] },
  // Housekeeping
  { cmd: '/wake', group: 'system', does: 'Checks the mailbox within a minute instead of waiting, for an answer that seems late.', forms: [['/wake', 'check now']] },
  { cmd: '/expire', group: 'system', does: 'Clears proposals that waited too long.', forms: [['/expire', 'clear them']] },
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

/** commands.list: the registry's commands, described and grouped (see the header). */
function tgAppOpCommands() {
  var live = listCommands(), help = {}, described = {}, byGroup = {};
  live.forEach(function (c) { help[c.cmd] = c.help; });
  var groups = TG_CMD_GROUPS.map(function (g) { var o = { id: g.id, title: g.title, about: g.about, commands: [] }; byGroup[g.id] = o; return o; });
  TG_CMD_GUIDE.forEach(function (e) {
    described[e.cmd] = true;
    if (!Object.prototype.hasOwnProperty.call(help, e.cmd) || !byGroup[e.group]) return;
    byGroup[e.group].commands.push({ cmd: e.cmd, does: e.does, help: help[e.cmd],
      forms: e.forms.map(function (f) { return { text: f[0], means: f[1] }; }) });
  });
  var more = live.filter(function (c) { return !described[c.cmd]; }).map(function (c) {
    return { cmd: c.cmd, does: c.help, help: c.help, forms: [{ text: c.cmd, means: '' }] };
  });
  if (more.length) groups.push({ id: 'more', title: 'More', about: 'Commands the bot answers that have no description here yet; /help has their hint.', commands: more });
  return tgAppOk({ groups: groups.filter(function (g) { return g.commands.length; }), tips: TG_CMD_TIPS, count: live.length });
}
TG_APP_OPS['commands.list'] = { args: [], fn: tgAppOpCommands };

// Developed by: LightAISolutions
