import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';
import '../assets/gearly/gearly-site.js';
import '../assets/gearly/gearly-student.js';
const snapshot = JSON.parse(await fs.readFile(new URL('../assets/gearly/gearly-site.json', import.meta.url), 'utf8'));
const api = globalThis.GearlyStudent;
const answer = (q, value = snapshot) => api.resolve(q, { snapshot: value, siteBase: 'https://org.osu.edu/asme/', contactEmail: 'asme@osu.edu' });
const cases = [
  ["I'm a freshman in aerospace, not mechanical engineering. Can I join, and how do I sign up?", 'join', /related engineering majors.*First-year.*Sign up/s, /newsletter-signup/],
  ['How much are chapter dues? Do I have to pay for national ASME membership too?', 'fees', /newsletter and GroupMe is free.*National membership is separate.*special events/s, /membership\/student-membership/],
  ['Where can I get help with my resume and finding my first internship?', 'career', /resume tips.*internship postings/s, /ASME-Career-Packet/],
  ['how do i jon the group me', 'groupme', /reminders/, /groupme.com\/join_group/],
  ['How do I join the GroupMe?', 'groupme', /reminders/, /groupme.com\/join_group/],
  ['GroupMe', 'groupme', /reminders/, /groupme.com\/join_group/],
  ['What should I wear to a company info session?', 'attire', /Career Packet.*event-specific attire instructions/s, /ASME-Career-Packet/],
  ['Can I just show up to an event if I have never been to ASME before?', 'newcomer', /RSVP or registration/, /newsletter-signup/],
  ['Is there a minimum GPA or an application to become a member?', 'membership-requirements', /do not see a published minimum GPA or membership application requirement/, /newsletter-signup/],
  ['How can I add the ASME calendar to my Google Calendar?', 'calendar-subscribe', /confirm adding/, /calendar.google.com\/calendar\/r\?cid=/],
  ['How can I join the executive board or volunteer to help plan events?', 'volunteer', /talk with current officers, volunteer at events.*leadership applications/s, /leadership/],
  ['Does ASME have any scholarships for undergraduate students?', 'scholarships', /National ASME student opportunities.*scholarships/s, /student-opportunities-and-resources/],
  ['How do I submit my resume to the ASME resume book, and who gets to see it?', 'resume-book', /participating sponsors and recruiting partners/, /forms.cloud.microsoft/],
  ['I have an interview next week. Where can I practice behavioral and technical interview questions?', 'interview', /interview prep.*Engineering Career Services/s, /meet-career-advisor/],
  ['Where is the ASME office, and what are the office hours?', 'office', /Scott Laboratory, Office N147.*do not see office hours published/s, /mailto:asme@osu.edu/],
  ['Where can I see photos from past ASME events?', 'photos', /photos from ASME OSU events/, /\/pictures\//],
  ['What hands-on projects or design competitions can I get involved in through ASME?', 'student-opportunities', /check the chapter calendar for upcoming competitions/s, /student-opportunities-and-resources/],
  ['Do I have to attend every meeting to stay a member? I have a class conflict on Thursdays.', 'attendance', /do not see a published requirement to attend every meeting/, /mailto:asme@osu.edu/],
  ['I signed up but am not getting the newsletter. Who should I contact?', 'newsletter-help', /contact asme@osu.edu/, /mailto:asme@osu.edu/],
  ['What is the difference between ASME and SAE at Ohio State?', 'comparison', /company info sessions.*do not verify SAE/s, /\/aboutus\//],
  ['Will SpaceX be at the meeting tomorrow, and can you guarantee I will get an internship if I join?', 'guarantee', /does not guarantee an internship/, /ASME-Career-Packet/]
];
for (const [question, id, text, destination] of cases) test(`grounded student answer: ${id} — ${question}`, () => {
  const result = answer(question);
  assert.equal(result?.id, `student-${id}`);
  assert.match(result.text, text);
  assert.ok(result.cards.some(card => destination.test(card.url)), JSON.stringify(result.cards));
});

test('known variants normalize without blanket autocorrection', () => {
  for (const q of ['Where is the group me invite?', 'how can i jon group me', 'JOIN GROUPME']) assert.equal(answer(q)?.id, 'student-groupme');
  assert.equal(answer('How do I submit my résumé?')?.id, 'student-resume-book');
  assert.equal(answer('What is the dress code for an employer session?')?.id, 'student-attire');
  assert.equal(answer('Where can I review my resume?')?.id, 'student-career');
  assert.equal(answer('Photos')?.liveSource, 'gallery');
  const projects = answer('What hands-on projects can I get involved in?');
  assert.equal(projects.liveSource, 'events');
  assert.equal(projects.entities.eventType, 'competition');
  assert.equal(projects.explainLive, true);
  assert.equal(answer('Does ASME have scholarships?').liveSource, undefined);
});

test('policy boundaries do not turn missing facts into rules or promotions', () => {
  const fees = answer('chapter dues').text;
  assert.doesNotMatch(fees, /25%|SECTION|freshmen.*free|national[^.;]*(?:mandatory|optional)|all.*(?:free|dues)/i);
  assert.doesNotMatch(answer('Can I just show up to an ASME event?').text, /no RSVP (?:is )?(?:needed|required)|every event is open/i);
  assert.doesNotMatch(answer('what should i wear to a company info session').text, /business casual|suit required/i);
  assert.doesNotMatch(answer('Where is the ASME office?').text, /open from|9 am|9:00/i);
});

test('negations, unrelated questions, secrets, leadership and sponsorship keep existing routing', () => {
  for (const question of ['purple space bananas', 'What is your Instagram password?', 'instagram reactor meltdown', 'president of another planet', 'my chemistry exam points', 'do not join', 'never contact', 'quit join', 'dont show photos', 'cancel my newsletter', 'I am not interested in GroupMe', 'Who is the current president, and how can I contact the officers?', 'Please provide vice president email', 'Who are the officers?', 'How do I sponsor ASME?', 'sponsorship packages', 'show gallery and leaderboard', 'show gallery and newsletter', 'How can I join a chess club?', 'How do I join SAE?', 'Office 365 resume template']) assert.equal(answer(question), null, question);
});

test('source edits flow into answers and destinations rather than a parallel policy list', async () => {
  const files = await Promise.all(['Join Page.html', 'Member Resources Page.html', 'Footer.html'].map(file => fs.readFile(new URL('../' + file, import.meta.url), 'utf8')));
  const docs = files.map(html => new JSDOM(html).window.document);
  docs[0].querySelector('[data-gearly="join-faq"] details p').textContent = 'All Ohio State students are welcome.';
  docs[1].querySelector('a[href*="forms.cloud.microsoft"]').href = 'https://forms.cloud.microsoft/r/UpdatedForm';
  docs[1].querySelector('a[href*="UpdatedForm"] .asme-resource-card-desc').textContent = 'The résumé book is shared with approved recruiting partners only.';
  const location = docs[2].querySelector('.asme-footer-contact p:nth-child(2) span');
  location.textContent = 'Scott Laboratory, Office N200';
  const changed = { ...snapshot, faqs: globalThis.GearlySite.parseFAQs(docs[0]), student: globalThis.GearlySite.parseStudentSources({ join: docs[0], resources: docs[1], footer: docs[2] }) };
  assert.match(answer('How do I join ASME?', changed).text, /All Ohio State students are welcome/);
  const book = answer('submit my resume', changed);
  assert.match(book.text, /approved recruiting partners only/);
  assert.equal(book.cards[0].url, 'https://forms.cloud.microsoft/r/UpdatedForm');
  assert.match(answer('ASME office', changed).text, /Office N200/);
  assert.equal(answer('GroupMe', {}), null);
});

test('module is synchronous and exposes the same browser and CommonJS API', async () => {
  const context = { module: { exports: {} }, URL };
  vm.runInNewContext(await fs.readFile(new URL('../assets/gearly/gearly-student.js', import.meta.url), 'utf8'), context);
  assert.equal(context.GearlyStudent, context.module.exports);
  assert.equal(typeof context.GearlyStudent.resolve, 'function');
  assert.equal(typeof answer('GroupMe')?.then, 'undefined');
});


test('specific event signup and scholarship requirements do not become chapter membership policies', () => {
  for (const q of ['How do I sign up for the MATLAB event?', 'Can I join the bar social if I am under 21?', 'How do I sign up for the ASME MATLAB event?', 'Can I join the ASME bar social if I am under 21?', 'What GPA do internships require?']) assert.equal(answer(q), null, q);
  assert.equal(answer('What GPA do ASME scholarships require?')?.id, 'student-scholarships');
});


test('student source parsing ignores unsafe links before snapshot generation', () => {
  const dom = new JSDOM('<a class="asme-resource-card" href="javascript:alert(1)"><span class="asme-resource-card-title">Unsafe</span><span class="asme-resource-card-desc">Ignore this card.</span></a>').window.document;
  const empty = new JSDOM('').window.document;
  const source = globalThis.GearlySite.parseStudentSources({ join: empty, resources: dom, footer: empty });
  assert.deepEqual(source.resources, []);
});
test('joining answers agree with the student question rather than source FAQ polarity',()=>{
 const value=answer('Can I join ASME as an aerospace freshman?');
 assert.match(value.text,/^Yes\./);assert.doesNotMatch(value.text,/^No\.|Yes\. No\./);
});
