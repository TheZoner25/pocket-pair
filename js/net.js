/* Pocket Pair network layer.
   LIVE: Supabase (auth, tables pair_status / pair_events, storage bucket pair-notes, realtime).
   DEMO: no server; the partner is simulated so the page can be tried anywhere.
   The engine and app only call NET.status / love / voice / art / heard / download. */
(function () {
  'use strict';
  const other = w => (w === 'rocky' ? 'her' : 'rocky');
  const hhmm = t => { const d = t ? new Date(t) : new Date(); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };

  const NET = {
    mode: 'demo', me: null, partner: null, sb: null, user: null, names: {},
    hooks: {},                       // set by app.js: onPartner, onPresence, onLove, onNote, onMine, onError, onNet
    emit(name, ...a) { const f = this.hooks[name]; if (f) try { f(...a); } catch (e) { console.error(e); } }
  };

  /* ---------------------------------------------------------------- demo */
  const DEMO = {
    acts: { rocky: ['idle', 'projects', 'studying', 'cooking', 'eating', 'school', 'transport', 'groceries'],
            her: ['idle', 'lab', 'studying', 'studyuni', 'cooking', 'eating', 'uni', 'transport'] },
    seq: 1, timers: [],
    later(ms, fn) { this.timers.push(setTimeout(fn, ms)); },
    start() {
      const p = NET.partner;
      NET.emit('onPartner', { act: p === 'her' ? 'lab' : 'projects', online: true });
      this.later(9000, () => NET.emit('onLove', 1));
      this.later(22000, () => this.note('voice', 4));
      const wander = () => { const a = this.acts[p][(Math.random() * this.acts[p].length) | 0]; NET.emit('onPartner', { act: a, online: true }); this.later(45000 + Math.random() * 45000, wander); };
      this.later(35000, wander);
    },
    note(kind, secs, art) { NET.emit('onNote', { id: 'demo' + (this.seq++), from: NET.partner, kind, secs: secs || 0, art: art || null, at: hhmm(), path: null }); }
  };

  /* ---------------------------------------------------------------- live */
  async function q(promise) { const { data, error } = await promise; if (error) throw error; return data; }

  NET.initLive = async function (cfg) {
    NET.mode = 'live';
    NET.sb = window.supabase.createClient(cfg.url, cfg.key, { auth: { persistSession: true, autoRefreshToken: true } });
    const { data } = await NET.sb.auth.getSession();
    NET.user = data.session ? data.session.user : null;
    return NET.user;
  };
  NET.signIn = async (email, password) => { const r = await q(NET.sb.auth.signInWithPassword({ email, password })); NET.user = r.user; return r.user; };
  NET.signUp = async (email, password) => {
    const r = await q(NET.sb.auth.signUp({ email, password, options: { emailRedirectTo: location.origin + location.pathname } }));
    NET.user = r.session ? r.user : null; return !!r.session;
  };
  NET.signOut = async () => { try { await NET.sb.auth.signOut(); } catch (e) {} location.reload(); };

  NET.membership = async function () {
    const rows = await q(NET.sb.from('pair_members').select('user_id,who,name'));
    rows.forEach(r => { NET.names[r.who] = r.name; });
    const mine = rows.find(r => r.user_id === NET.user.id);
    return mine ? mine.who : null;
  };
  NET.join = async (code, who, name) => q(NET.sb.rpc('pair_join', { p_code: code, p_who: who, p_name: name }));

  /* Start talking: load state, inbox, unseen hearts, then subscribe. */
  NET.start = async function (me) {
    NET.me = me; NET.partner = other(me);
    if (NET.mode === 'demo') { DEMO.start(); return; }
    await NET.resync(true);
    subscribe();
    heartbeat(); setInterval(heartbeat, 60000);
    // "app is open" flag: while it is set, the server skips push notifications for me
    NET.visible(document.visibilityState === 'visible');
    setInterval(() => { if (document.visibilityState === 'visible') NET.visible(true); }, 30000);
    document.addEventListener('visibilitychange', () => {
      const on = document.visibilityState === 'visible'; NET.visible(on);
      if (on) { heartbeat(); NET.resync(false).catch(e => NET.emit('onError', e)); } else heartbeat();
    });
    window.addEventListener('pagehide', () => NET.visible(false));
    window.addEventListener('online', () => NET.emit('onNet', true));
    window.addEventListener('offline', () => NET.emit('onNet', false));
  };

  NET.resync = async function (first) {
    const sb = NET.sb, me = NET.me;
    const st = await q(sb.from('pair_status').select('*'));
    st.forEach(r => {
      if (r.who === me) NET.emit('onMine', { act: r.act, sent: r.love_sent, first });
      else NET.emit('onPartner', { act: r.act, lastSeen: r.last_seen });
    });
    const inbox = await q(sb.from('pair_events').select('id,from_who,kind,secs,path,art,seen,created_at')
      .eq('to_who', me).in('kind', ['voice', 'art']).order('created_at', { ascending: false }).limit(5));
    NET.emit('onInbox', inbox.map(rowToNote));
    inbox.forEach(r => { if (r.kind === 'voice') prefetch(r.id, r.path); });
    const loves = await q(sb.from('pair_events').select('id').eq('to_who', me).eq('kind', 'love').eq('seen', false));
    if (loves.length) {
      NET.emit('onLove', loves.length, true);
      await q(sb.from('pair_events').update({ seen: true }).in('id', loves.map(l => l.id)));
    }
    trim();
  };

  function rowToNote(r) { return { id: r.id, from: r.from_who, kind: r.kind, secs: r.secs || 0, path: r.path, art: r.art, heard: r.seen, at: hhmm(r.created_at) }; }

  let presence = null;
  function subscribe() {
    const sb = NET.sb, me = NET.me;
    sb.channel('pair-db')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pair_status' }, ({ new: r }) => {
        if (r.who === me) NET.emit('onMine', { act: r.act, sent: r.love_sent });
        else NET.emit('onPartner', { act: r.act, lastSeen: r.last_seen });
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pair_events', filter: 'to_who=eq.' + me }, async ({ new: r }) => {
        if (r.kind === 'love') { NET.emit('onLove', 1); sb.from('pair_events').update({ seen: true }).eq('id', r.id).then(() => {}); return; }
        if (r.kind === 'voice') await prefetch(r.id, r.path);
        NET.emit('onNote', rowToNote(r));
        setTimeout(trim, 1500);
      })
      .subscribe(s => NET.emit('onNet', s === 'SUBSCRIBED' ? true : s === 'CHANNEL_ERROR' || s === 'TIMED_OUT' ? false : undefined));
    presence = sb.channel('pair-room', { config: { presence: { key: me } } });
    presence.on('presence', { event: 'sync' }, () => { const s = presence.presenceState(); NET.emit('onPresence', !!s[NET.partner]); })
      .subscribe(async s => { if (s === 'SUBSCRIBED') await presence.track({ at: Date.now() }); });
  }

  function heartbeat() { if (NET.mode !== 'live' || !NET.me) return; NET.sb.from('pair_status').update({ last_seen: new Date().toISOString() }).eq('who', NET.me).then(() => {}); }

  /* Keep at most 5 notes in my inbox (oldest go, with their audio files). */
  async function trim() {
    try {
      const rows = await q(NET.sb.from('pair_events').select('id,path').eq('to_who', NET.me).in('kind', ['voice', 'art']).order('created_at', { ascending: false }));
      const old = rows.slice(5);
      if (!old.length) return;
      const paths = old.map(r => r.path).filter(Boolean);
      if (paths.length) await NET.sb.storage.from('pair-notes').remove(paths);
      await q(NET.sb.from('pair_events').delete().in('id', old.map(r => r.id)));
    } catch (e) { console.warn('trim', e); }
  }

  /* Voice audio is fetched as soon as it arrives, so PLAY can start inside the tap (iPhone rule). */
  const blobs = {};
  async function prefetch(id, path) {
    if (!path || blobs[id]) return;
    try { const { data, error } = await NET.sb.storage.from('pair-notes').download(path); if (!error) blobs[id] = URL.createObjectURL(data); } catch (e) {}
  }
  NET.audioUrl = id => blobs[id] || null;

  /* ---------------------------------------------------------------- actions */
  const fail = what => e => { console.warn(what, e); NET.emit('onError', e, what); };

  NET.status = function (act) {
    if (NET.mode === 'demo') return;
    const now = new Date().toISOString();
    NET.sb.from('pair_status').update({ act, updated_at: now, last_seen: now }).eq('who', NET.me).then(({ error }) => { if (error) fail('status')(error); });
  };

  NET.love = function () {
    if (NET.mode === 'demo') { if (Math.random() < 0.6) DEMO.later(2500 + Math.random() * 3000, () => NET.emit('onLove', 1)); return; }
    NET.sb.rpc('pair_send_love').then(({ data, error }) => { if (error) fail('love')(error); else NET.emit('onMine', { sent: data }); });
  };

  NET.voice = async function (blob, secs) {
    if (NET.mode === 'demo') { DEMO.later(4000, () => NET.emit('onLove', 1)); return true; }
    try {
      const type = (blob.type || 'audio/webm').split(';')[0];
      const ext = type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : type.includes('mpeg') ? 'mp3' : 'webm';
      const path = NET.me + '/' + Date.now() + '.' + ext;
      await q(NET.sb.storage.from('pair-notes').upload(path, blob, { contentType: type, upsert: false }));
      await q(NET.sb.from('pair_events').insert({ from_who: NET.me, to_who: NET.partner, kind: 'voice', secs, path }));
      return true;
    } catch (e) { fail('voice')(e); return false; }
  };

  NET.art = async function (art) {
    if (NET.mode === 'demo') { DEMO.later(5000, () => NET.emit('onLove', 1)); return true; }
    try { await q(NET.sb.from('pair_events').insert({ from_who: NET.me, to_who: NET.partner, kind: 'art', art })); return true; }
    catch (e) { fail('art')(e); return false; }
  };

  NET.heard = function (note) {
    if (NET.mode === 'demo' || !note || !note.id) return;
    NET.sb.from('pair_events').update({ seen: true }).eq('id', note.id).then(() => {});
  };

  NET.visible = function (on) {
    if (NET.mode !== 'live' || !NET.me) return;
    const until = on ? new Date(Date.now() + 45000).toISOString() : new Date(0).toISOString();
    NET.sb.from('pair_status').update({ visible_until: until }).eq('who', NET.me).then(() => {});
  };

  /* Push notifications: one row per phone/computer, with what that device wants to hear about. */
  NET.pushSave = async function (sub, prefs) {
    const j = sub.toJSON();
    await q(NET.sb.from('pair_push_subs').upsert({
      endpoint: j.endpoint, who: NET.me, p256dh: j.keys.p256dh, auth: j.keys.auth,
      want_status: !!prefs.status, want_love: !!prefs.love, want_notes: !!prefs.notes
    }, { onConflict: 'endpoint' }));
  };
  NET.pushRemove = async endpoint => q(NET.sb.from('pair_push_subs').delete().eq('endpoint', endpoint));

  NET.setName = async function (name) {
    NET.names[NET.me] = name;
    if (NET.mode === 'demo') return;
    await q(NET.sb.from('pair_members').update({ name }).eq('user_id', NET.user.id));
  };

  window.NET = NET;
})();
