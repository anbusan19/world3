// "Ends in 3 d", "Starts 16 Oct", "Ended 31 Dec", "Always on": one short line for an event's clock.
export function eventLine(ev) {
  if (!ev) return '';
  const d = (iso) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  if (ev.status === 'ended') return `Ended ${d(ev.endsAt)}`;
  if (ev.status === 'upcoming') return `Starts ${d(ev.startsAt)}`;
  if (!ev.endsAt) return 'Always on';
  const ms = Date.parse(ev.endsAt) - Date.now();
  const days = Math.floor(ms / 86400000);
  return days >= 1 ? `Ends in ${days} d` : `Ends in ${Math.max(1, Math.floor(ms / 3600000))} h`;
}
