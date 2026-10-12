// Sample notes, written the way people actually jot ideas down.
export const EXAMPLES: { label: string; notes: string }[] = [
  {
    label: "Trainer client app",
    notes: `personal trainers + small gyms keep losing clients and nobody notices until they're gone. everyone runs on whatsapp + a google sheet. trainer sells packs like 10 sessions for $400, client books a slot, then ghosts.

want: trainer sets up packages, clients book slots from trainer's calendar, reminders the day before. when a pack gets low (2 left) nudge client to renew + pay - stripe. trainer dashboard shows who is slipping (missed 2 in a row / no booking in 10 days).

clients won't download an app?? maybe web link for clients, app for trainer.
later: group classes, nutrition notes, multiple trainers per gym.
me + 1 dev, want trainers using it in ~2 months. charge trainers monthly, free for first 10 clients?`,
  },
  {
    label: "Freelancer invoice chaser",
    notes: `freelancers hate chasing late invoices. i have like 6 clients, 2 always pay late and i feel awkward emailing them.
tool: connect my invoices (stripe invoices? or just upload pdf + amount + due date), it sends polite reminders on a schedule I choose - 3 days before, on due date, 7 days after, firmer tone each time. stops when paid. shows me who owes what.
must sound like me not a robot. maybe ai writes the reminder in my voice from a sample email.
solo dev (me). want to sell it for like $9/mo. start with freelance designers - I know a slack community of 4k`,
  },
  {
    label: "Neighborhood tool library",
    notes: `our street has 40 houses and everyone owns a ladder, drill, pressure washer they use twice a year. idea: tool sharing for a neighbourhood. list your tools, others request to borrow, you approve, agree pickup time. track who has what. deposit? reviews so people return stuff.
start with my street + the 2 next to it, maybe 150 households. mostly older folks so must be dead simple, maybe works by text message too.
no money at first. later maybe a small fee per borrow or city council grant`,
  },
];

export const PROJECT_TYPES = [
  "Not sure yet",
  "Web app",
  "Mobile app",
  "Web and mobile",
  "API or backend service",
  "Internal tool",
  "AI agent or automation",
];
