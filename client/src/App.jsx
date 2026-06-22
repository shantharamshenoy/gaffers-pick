import { useState, useEffect } from "react";
import { GROUPS, MATCHES } from "./matchData";

const LOCK_MINUTES = 30;
const MATCH_DURATION_MS = 150 * 60 * 1000; // 150 min covers ET + pens buffer

// function calcPoints(pred, result) {
//   if (!pred || !result) return 0;
//   const ph = parseInt(pred.homeScore), pa = parseInt(pred.awayScore);
//   const rh = parseInt(result.homeScore), ra = parseInt(result.awayScore);
//   if (isNaN(ph) || isNaN(pa) || isNaN(rh) || isNaN(ra)) return 0;
//   let pts = 0;
//   const predResult = ph > pa ? "H" : ph < pa ? "A" : "D";
//   const realResult = rh > ra ? "H" : rh < ra ? "A" : "D";
//   if (predResult === realResult) pts += 3; // exact score
//   if (ph === rh) pts += 2; // correct home score
//   if (pa === ra) pts += 2; // correct away score
//   if ((ph - pa) === (rh - ra)) pts += 1; // correct goal difference
//   if (pred.yellows != null && result.yellows != null && parseInt(pred.yellows) === parseInt(result.yellows)) pts += 1; // correct yellow card count
//   if (pred.reds != null && result.reds != null && parseInt(pred.reds) === parseInt(result.reds)) pts += 1; // correct red card count
//   return pts;
// }

function calcPoints(pred, result, cardPlayed = false) {
  if (!pred || !result) return 0;
  const ph = parseInt(pred.homeScore), pa = parseInt(pred.awayScore);
  const rh = parseInt(result.homeScore), ra = parseInt(result.awayScore);
  if (isNaN(ph) || isNaN(pa) || isNaN(rh) || isNaN(ra)) return 0;
  const predResult = ph > pa ? "H" : ph < pa ? "A" : "D";
  const realResult = rh > ra ? "H" : rh < ra ? "A" : "D";
  const correctResult = predResult === realResult;
  if (cardPlayed && !correctResult) return 0;
  let pts = 0;
  if (correctResult) pts += 3;
  if (ph === rh) pts += 2;
  if (pa === ra) pts += 2;
  if ((ph - pa) === (rh - ra)) pts += 1;
  if (pred.yellows != null && result.yellows != null && parseInt(pred.yellows) === parseInt(result.yellows)) pts += 1;
  if (pred.reds != null && result.reds != null && parseInt(pred.reds) === parseInt(result.reds)) pts += 1;
  return cardPlayed ? pts * 2 : pts;
}

function isLocked(kickoff, now = Date.now()) {
  return now >= new Date(kickoff).getTime() - LOCK_MINUTES * 60 * 1000;
}

function isLive(kickoff, now = Date.now()) {
  const ko = new Date(kickoff).getTime();
  return now >= ko && now < ko + MATCH_DURATION_MS;
}

function isFinished(kickoff, now = Date.now()) {
  return now >= new Date(kickoff).getTime() + MATCH_DURATION_MS;
}

// Find the featured match for a leaderboard: live match, or most recently finished
function getFeaturedMatch(now = Date.now()) {
  const locked = MATCHES.filter(m => isLocked(m.kickoff, now));
  if (!locked.length) return null;
  const live = locked.find(m => isLive(m.kickoff, now));
  if (live) return { match: live, status: "live" };
  const finished = locked
    .filter(m => isFinished(m.kickoff, now))
    .sort((a, b) => new Date(b.kickoff) - new Date(a.kickoff));
  if (finished.length) return { match: finished[0], status: "finished" };
  const upcoming = locked
    .filter(m => !isLive(m.kickoff, now) && !isFinished(m.kickoff, now))
    .sort((a, b) => new Date(a.kickoff) - new Date(b.kickoff));
  if (upcoming.length) return { match: upcoming[0], status: "upcoming" };
  return null;
}

function formatKickoff(kickoff, tz) {
  try {
    return new Date(kickoff).toLocaleString("en-GB", {
      timeZone: tz || "UTC", weekday: "short", month: "short",
      day: "numeric", hour: "2-digit", minute: "2-digit",
    });
  } catch { return new Date(kickoff).toUTCString(); }
}

function formatDateHeader(kickoff, tz) {
  try {
    return new Date(kickoff).toLocaleDateString("en-GB", {
      timeZone: tz || "UTC", weekday: "long", day: "numeric", month: "long"
    });
  } catch { return kickoff; }
}

function genGroupCode() {
  return "GP-" + Math.random().toString(36).substring(2, 7).toUpperCase();
}

async function checkAdminPassword(input) {
  const res = await fetch("/api/admin/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: input }),
  });
  return res.ok;
}

const FLAGS = {
  "Mexico": "mx", "South Africa": "za", "South Korea": "kr", "Czechia": "cz",
  "Canada": "ca", "Bosnia and Herzegovina": "ba", "Qatar": "qa", "Switzerland": "ch",
  "Brazil": "br", "Morocco": "ma", "Haiti": "ht", "Scotland": "gb-sct",
  "USA": "us", "Paraguay": "py", "Australia": "au", "Türkiye": "tr",
  "Germany": "de", "Curaçao": "cw", "Ivory Coast": "ci", "Ecuador": "ec",
  "Netherlands": "nl", "Japan": "jp", "Sweden": "se", "Tunisia": "tn",
  "Belgium": "be", "Egypt": "eg", "Iran": "ir", "New Zealand": "nz",
  "Spain": "es", "Cape Verde": "cv", "Saudi Arabia": "sa", "Uruguay": "uy",
  "France": "fr", "Senegal": "sn", "Iraq": "iq", "Norway": "no",
  "Argentina": "ar", "Algeria": "dz", "Austria": "at", "Jordan": "jo",
  "Portugal": "pt", "DR Congo": "cd", "Uzbekistan": "uz", "Colombia": "co",
  "England": "gb-eng", "Croatia": "hr", "Ghana": "gh", "Panama": "pa",
};

const flag = (team) => {
  const code = FLAGS[team];
  if (!code) return null;
  return (
    <img
      src={`https://flagcdn.com/20x15/${code}.png`}
      width="20"
      height="15"
      alt={team}
      style={{ display: "inline-block", verticalAlign: "middle", marginRight: 4, borderRadius: 2 }}
    />
  );
};


const S = {
  app: { minHeight: "100vh", background: "#0a0c10", color: "#e8eaf0", fontFamily: "'Inter','Segoe UI',sans-serif", fontSize: 14 },
  header: { background: "linear-gradient(135deg,#0d1117 0%,#131822 100%)", borderBottom: "1px solid #1e2433", padding: "18px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 100, flexWrap: "wrap", gap: 8 },
  logo: { fontFamily: "'Georgia',serif", fontSize: 22, fontWeight: 700, color: "#e8eaf0", letterSpacing: "-0.5px", cursor: "pointer" },
  logoAccent: { color: "#f5c518" },
  pill: (active) => ({ padding: "5px 14px", borderRadius: 20, border: `1px solid ${active ? "#f5c518" : "#2a3040"}`, background: active ? "#f5c518" : "transparent", color: active ? "#0a0c10" : "#8892a4", cursor: "pointer", fontSize: 12, fontWeight: 600 }),
  card: { background: "#111520", border: "1px solid #1e2433", borderRadius: 10, padding: 16, marginBottom: 12 },
  input: { background: "#0d1117", border: "1px solid #2a3040", borderRadius: 6, color: "#e8eaf0", padding: "8px 12px", fontSize: 14, width: "100%", outline: "none", boxSizing: "border-box" },
  inputSm: { background: "#0d1117", border: "1px solid #2a3040", borderRadius: 6, color: "#e8eaf0", padding: "6px 8px", fontSize: 13, width: 52, textAlign: "center", outline: "none" },
  select: { background: "#0d1117", border: "1px solid #2a3040", borderRadius: 6, color: "#e8eaf0", padding: "7px 12px", fontSize: 13, outline: "none", cursor: "pointer" },
  btn: (v = "primary") => ({ padding: v === "sm" ? "5px 12px" : "9px 20px", borderRadius: 6, border: "none", background: v === "danger" ? "#c0392b" : v === "ghost" ? "transparent" : "#f5c518", color: v === "ghost" ? "#8892a4" : v === "danger" ? "#fff" : "#0a0c10", fontWeight: 700, fontSize: v === "sm" ? 12 : 13, cursor: "pointer" }),
  label: { fontSize: 11, color: "#8892a4", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4, display: "block" },
  badge: (c) => ({ display: "inline-block", padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 700, background: c === "green" ? "#0d2818" : c === "yellow" ? "#2a2200" : c === "red" ? "#2a0d0d" : "#1a1e2a", color: c === "green" ? "#2ecc71" : c === "yellow" ? "#f5c518" : c === "red" ? "#e74c3c" : "#8892a4", border: `1px solid ${c === "green" ? "#1a5c33" : c === "yellow" ? "#5a4400" : c === "red" ? "#5a1a1a" : "#2a3040"}` }),
  section: { maxWidth: 760, margin: "0 auto", padding: "24px 16px" },
  dateHeader: { fontSize: 12, fontWeight: 700, color: "#f5c518", textTransform: "uppercase", letterSpacing: "0.08em", padding: "14px 0 10px", borderBottom: "1px solid #1e2433", marginBottom: 12 },
  matchRow: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" },
  teamName: { fontSize: 13, fontWeight: 600, flex: 1, minWidth: 80 },
  vs: { color: "#8892a4", fontSize: 11, fontWeight: 700, width: 20, textAlign: "center" },
  ptsBadge: (pts) => ({ display: "inline-block", minWidth: 28, textAlign: "center", padding: "2px 6px", borderRadius: 4, fontWeight: 700, fontSize: 12, background: pts >= 8 ? "#0d2818" : pts >= 5 ? "#2a2200" : pts > 0 ? "#1a1e2a" : "#111520", color: pts >= 8 ? "#2ecc71" : pts >= 5 ? "#f5c518" : pts > 0 ? "#8892a4" : "#3a4050", border: `1px solid ${pts >= 8 ? "#1a5c33" : pts >= 5 ? "#5a4400" : "#2a3040"}` }),
};

function renderMatchesByDate({ matches, tz, groupFilter, renderRow }) {
  const filtered = matches
    .filter(m => groupFilter === "ALL" || m.group === groupFilter)
    .sort((a, b) => new Date(a.kickoff) - new Date(b.kickoff));
  const days = [];
  const seen = {};
  filtered.forEach(m => {
    const dateKey = formatDateHeader(m.kickoff, tz);
    if (!seen[dateKey]) { seen[dateKey] = true; days.push({ dateKey, matches: [] }); }
    days[days.length - 1].matches.push(m);
  });
  return days.map(({ dateKey, matches: dayMatches }) => (
    <div key={dateKey}>
      <div style={S.dateHeader}>{dateKey}</div>
      {dayMatches.map(m => renderRow(m))}
    </div>
  ));
}

// Splits matches into completed (result entered) vs upcoming, renders completed
// inside a collapsed-by-default section above the upcoming list.
function renderMatchesWithCompletedSection({ matches, results, tz, groupFilter, renderRow, collapsed, onToggle }) {
  const filtered = matches.filter(m => groupFilter === "ALL" || m.group === groupFilter);
  const completed = filtered.filter(m => results[m.id]);
  const upcoming = filtered.filter(m => !results[m.id]);

  return (
    <div>
      {completed.length > 0 && (
        <CollapsibleSection
          title={`Completed Matches (${completed.length})`}
          collapsed={collapsed}
          onToggle={onToggle}
        >
          {renderMatchesByDate({ matches: completed, tz, groupFilter: "ALL", renderRow })}
        </CollapsibleSection>
      )}
      {renderMatchesByDate({ matches: upcoming, tz, groupFilter: "ALL", renderRow })}
    </div>
  );
}

function CollapsibleSection({ title, collapsed, onToggle, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <button
        onClick={onToggle}
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          background: "#111520", border: "1px solid #1e2433", borderRadius: 10, padding: "12px 16px",
          cursor: "pointer", color: "#8892a4", fontSize: 13, fontWeight: 700,
          textTransform: "uppercase", letterSpacing: "0.06em"
        }}
      >
        <span>{title}</span>
        <span style={{ fontSize: 16, transform: collapsed ? "rotate(0deg)" : "rotate(180deg)", transition: "transform 0.15s" }}>▾</span>
      </button>
      {!collapsed && <div style={{ marginTop: 12 }}>{children}</div>}
    </div>
  );
}

function GroupFilter({ value, onChange }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
      <span style={{ fontSize: 12, color: "#8892a4", whiteSpace: "nowrap" }}>Filter:</span>
      <select style={S.select} value={value} onChange={e => onChange(e.target.value)}>
        <option value="ALL">All Groups</option>
        {Object.keys(GROUPS).map(g => <option key={g} value={g}>Group {g}</option>)}
      </select>
    </div>
  );
}

// ─── FEATURED MATCH CARD ──────────────────────────────────────────────────────
function FeaturedMatchCard({ groupCode, result, tz, serverNow = Date.now() }) {
  const [featured, setFeatured] = useState(null);
  const [playerPicks, setPlayerPicks] = useState([]);
  const [loadingPicks, setLoadingPicks] = useState(false);

  useEffect(() => {
    const f = getFeaturedMatch(serverNow);
    setFeatured(f);
    if (f && groupCode) {
      setLoadingPicks(true);
      fetch(`/api/leaderboard/${groupCode}/match/${f.match.id}`)
        .then(r => r.ok ? r.json() : [])
        .then(data => { setPlayerPicks(data); setLoadingPicks(false); })
        .catch(() => setLoadingPicks(false));
    }
  }, [groupCode]);

  if (!featured) return null;

  const { match, status } = featured;
  const matchResult = result;
  const isLiveNow = status === "live";
  const isFinishedNow = status === "finished";

  return (
    <div style={{ background: "linear-gradient(135deg,#0d1a2a 0%,#111520 100%)", border: `1px solid ${isLiveNow ? "#e74c3c" : "#2a3856"}`, borderRadius: 12, padding: 16, marginBottom: 20 }}>
      {/* Match header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {isLiveNow && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#2a0d0d", border: "1px solid #e74c3c", color: "#e74c3c", fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 4, textTransform: "uppercase", letterSpacing: "0.1em" }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#e74c3c", display: "inline-block", animation: "pulse 1s infinite" }} />
              Live
            </span>
          )}
          {isFinishedNow && !matchResult && (
            <span style={S.badge("")}>FT</span>
          )}
          {matchResult && (
            <span style={S.badge("green")}>Result In</span>
          )}
        </div>
        <span style={{ fontSize: 11, color: "#8892a4" }}>{formatKickoff(match.kickoff, tz)} · Grp {match.group}</span>
      </div>

      {/* Teams + result */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 14 }}>
        <span style={{ fontSize: 15, fontWeight: 700, textAlign: "right", flex: 1 }}>{flag(match.home)} {match.home}</span>
        <div style={{ textAlign: "center" }}>
          <span style={{ fontSize: 20, fontWeight: 800, color: matchResult ? "#f5c518" : "#8892a4", display: "block" }}>
            {matchResult ? `${matchResult.homeScore} - ${matchResult.awayScore}` : "- -"}
          </span>
          {matchResult && (
            <span style={{ fontSize: 12, color: "#8892a4" }}>
              {matchResult.yellows != null && `🟨 ${matchResult.yellows}`}
              {matchResult.yellows != null && matchResult.reds != null && "  "}
              {matchResult.reds != null && `🟥 ${matchResult.reds}`}
            </span>
          )}
        </div>
        <span style={{ fontSize: 15, fontWeight: 700, textAlign: "left", flex: 1 }}>{match.away} {flag(match.away)}</span>
      </div>

      {/* Player picks */}
      <div style={{ borderTop: "1px solid #1e2433", paddingTop: 12 }}>
        <div style={{ fontSize: 11, color: "#8892a4", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Everyone's Picks</div>
        {loadingPicks && <div style={{ color: "#8892a4", fontSize: 12 }}>Loading…</div>}
        {!loadingPicks && playerPicks.map(p => {
          const pts = p.pick && matchResult ? calcPoints(
            { homeScore: p.pick.homeScore, awayScore: p.pick.awayScore, yellows: p.pick.yellows, reds: p.pick.reds },
            matchResult,
            p.cardPlayed
          ) : null;
          return (
            <div key={p.name} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: "1px solid #0d1117" }}>
              <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>
                {p.name}
                {p.cardPlayed && <span style={{ marginLeft: 6, fontSize: 11 }}>🃏</span>}
              </span>
              {p.pick ? (
                <span style={{ fontSize: 13, color: "#e8eaf0", fontWeight: 700, background: "#0d1117", border: "1px solid #2a3040", borderRadius: 6, padding: "3px 10px" }}>
                  {flag(match.home)} {p.pick.homeScore} - {p.pick.awayScore} {flag(match.away)}
                  {p.pick.yellows != null && <span style={{ marginLeft: 6, fontWeight: 400, color: "#8892a4" }}>🟨{p.pick.yellows}</span>}
                  {p.pick.reds != null && <span style={{ marginLeft: 4, fontWeight: 400, color: "#8892a4" }}>🟥{p.pick.reds}</span>}
                </span>
              ) : (
                <span style={{ fontSize: 12, color: "#3a4050", fontStyle: "italic" }}>no pick</span>
              )}
              {pts !== null && <span style={S.ptsBadge(pts)}>{pts}pts</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── APP ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState("home");
  const [tz, setTz] = useState("UTC");
  const [results, setResults] = useState({});
  const [picks, setPicks] = useState({});
  const [groups, setGroups] = useState([]);
  const [leaderboards, setLeaderboards] = useState({});
  const [currentPlayer, setCurrentPlayer] = useState(null);
  const [adminMode, setAdminMode] = useState(false);
  const [adminPwd, setAdminPwd] = useState("");
  const [groupFilter, setGroupFilter] = useState("ALL");
  const [adminGroupFilter, setAdminGroupFilter] = useState("ALL");
  const [adminLbGroup, setAdminLbGroup] = useState("");
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(false);
  const [serverNow, setServerNow] = useState(Date.now());
  const [picksCompletedCollapsed, setPicksCompletedCollapsed] = useState(true);
  const [adminCompletedCollapsed, setAdminCompletedCollapsed] = useState(true);
  const [joinCode, setJoinCode] = useState("");
  const [joinName, setJoinName] = useState("");
  const [joinPin, setJoinPin] = useState("");
  const [joinError, setJoinError] = useState("");
  const [newGroupName, setNewGroupName] = useState("");
  const [returnName, setReturnName] = useState("");
  const [returnPin, setReturnPin] = useState("");
  const [returnError, setReturnError] = useState("");
  const [returnSuggestion, setReturnSuggestion] = useState(null);
  const [keepSignedIn, setKeepSignedIn] = useState(false);
  const [autoLoginChecked, setAutoLoginChecked] = useState(false);
  const [cards, setCards] = useState({ used: [], remaining: 3 });

  useEffect(() => {
    try { setTz(Intl.DateTimeFormat().resolvedOptions().timeZone); } catch { }
    fetchResults();
    const syncTime = async () => {
      try {
        const res = await fetch("/api/time");
        if (res.ok) { const { now } = await res.json(); setServerNow(now); }
      } catch { }
    };
    syncTime();
    const interval = setInterval(syncTime, 60000);

    // Auto-login if "keep me signed in" was previously checked
    (async () => {
      try {
        const saved = localStorage.getItem("gaffersPickSession");
        if (saved) {
          const { code, name, pin } = JSON.parse(saved);
          if (code && name && pin) {
            const res = await fetch(`/api/groups/${code}/join`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name, pin }),
            });
            const data = await res.json();
            if (res.ok) {
              const pRes = await fetch(`/api/picks/${code}/${encodeURIComponent(name)}?pin=${pin}`);
              if (pRes.ok) setPicks(await pRes.json());
              const cRes = await fetch(`/api/cards/${code}/${encodeURIComponent(name)}`);
              if (cRes.ok) setCards(await cRes.json());
              setCurrentPlayer({ name, pin, groupCode: code, groupName: data.group.name });
              setScreen("predict");
            } else {
              localStorage.removeItem("gaffersPickSession");
            }
          }
        }
      } catch { } finally {
        setAutoLoginChecked(true);
      }
    })();

    return () => clearInterval(interval);
  }, []);

  function showToast(msg, type = "info") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2800);
  }

  async function fetchResults() {
    try {
      const res = await fetch("/api/results");
      if (res.ok) setResults(await res.json());
    } catch { }
  }

  async function fetchAdminGroups() {
    try {
      const res = await fetch("/api/admin/groups", { headers: { "x-admin-password": adminPwd } });
      if (res.ok) setGroups(await res.json());
    } catch { }
  }

  async function fetchLeaderboard(code) {
    try {
      const res = await fetch(`/api/leaderboard/${code}`);
      if (res.ok) {
        const data = await res.json();
        setLeaderboards(prev => ({ ...prev, [code]: data }));
      }
    } catch { }
  }

  async function handleJoin() {
    setJoinError("");
    const code = joinCode.trim().toUpperCase();
    const name = joinName.trim();
    const pin = joinPin.trim();
    if (!code || !name || pin.length < 4) { setJoinError("Enter group code, name, and a 4-digit PIN."); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/groups/${code}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, pin }),
      });
      const data = await res.json();
      if (!res.ok) { setJoinError(data.error || "Something went wrong."); setLoading(false); return; }
      const pRes = await fetch(`/api/picks/${code}/${encodeURIComponent(name)}?pin=${pin}`);
      if (pRes.ok) setPicks(await pRes.json());
      const cRes = await fetch(`/api/cards/${code}/${encodeURIComponent(name)}`);
      if (cRes.ok) setCards(await cRes.json());
      setCurrentPlayer({ name, pin, groupCode: code, groupName: data.group.name });
      if (keepSignedIn) {
        localStorage.setItem("gaffersPickSession", JSON.stringify({ code, name, pin }));
      }
      setScreen("predict");
      showToast(`Welcome, ${name}!`, "success");
    } catch { setJoinError("Network error. Try again."); }
    setLoading(false);
  }

  async function handleReturn(nameOverride) {
    setReturnError("");
    setReturnSuggestion(null);
    const code = joinCode.trim().toUpperCase();
    const name = (nameOverride || returnName).trim();
    const pin = returnPin.trim();
    if (!code || !name || pin.length < 4) { setReturnError("Enter group code, name, and PIN."); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/groups/${code}/player/${encodeURIComponent(name)}`);
      const data = await res.json();
      if (!res.ok) {
        if (data.suggestion) setReturnSuggestion(data.suggestion);
        else setReturnError(data.error || "Player not found.");
        setLoading(false);
        return;
      }
      const joinRes = await fetch(`/api/groups/${code}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: data.exactName, pin }),
      });
      const joinData = await joinRes.json();
      if (!joinRes.ok) { setReturnError(joinData.error || "Wrong PIN."); setLoading(false); return; }

      const pRes = await fetch(`/api/picks/${code}/${encodeURIComponent(data.exactName)}?pin=${pin}`);
      if (pRes.ok) setPicks(await pRes.json());
      const cRes = await fetch(`/api/cards/${code}/${encodeURIComponent(data.exactName)}`);
      if (cRes.ok) setCards(await cRes.json());
      setCurrentPlayer({ name: data.exactName, pin, groupCode: code, groupName: joinData.group.name });
      if (keepSignedIn) {
        localStorage.setItem("gaffersPickSession", JSON.stringify({ code, name: data.exactName, pin }));
      }
      setScreen("predict");
      showToast(`Welcome back, ${data.exactName}!`, "success");
    } catch { setReturnError("Network error. Try again."); }
    setLoading(false);
  }

  async function savePick(matchId, pred) {
    if (!currentPlayer) return;
    if (isLocked(MATCHES.find(m => m.id === matchId)?.kickoff)) { showToast("Match locked.", "warn"); return; }
    try {
      const res = await fetch("/api/picks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupCode: currentPlayer.groupCode, playerName: currentPlayer.name, pin: currentPlayer.pin, matchId, ...pred }),
      });
      if (!res.ok) { showToast("Failed to save.", "warn"); return; }
      setPicks(prev => ({ ...prev, [matchId]: pred }));
    } catch { showToast("Network error.", "warn"); }
  }

  async function handleCreateGroup() {
    if (!newGroupName.trim()) return;
    const code = genGroupCode();
    try {
      const res = await fetch("/api/admin/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-password": adminPwd },
        body: JSON.stringify({ code, name: newGroupName.trim() }),
      });
      if (res.ok) {
        showToast(`Group created! Code: ${code}`, "success");
        setNewGroupName("");
        fetchAdminGroups();
      }
    } catch { showToast("Network error.", "warn"); }
  }

  async function playCard(matchId) {
    if (!currentPlayer) return;
    const match = MATCHES.find(m => m.id === matchId);
    if (!match) return;
    const now = serverNow;
    const ko = new Date(match.kickoff).getTime();
    const windowClose = ko + 50 * 60 * 1000;
    if (now < ko) { showToast("Match hasn't started yet.", "warn"); return; }
    if (now > windowClose) { showToast("Card window closed — first 50 mins only.", "warn"); return; }
    if (cards.remaining <= 0) { showToast("No cards remaining.", "warn"); return; }
    if (cards.used.includes(matchId)) { showToast("Card already played on this match.", "warn"); return; }
    try {
      const res = await fetch("/api/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupCode: currentPlayer.groupCode, playerName: currentPlayer.name, pin: currentPlayer.pin, matchId }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error || "Failed to play card.", "warn"); return; }
      setCards(prev => ({ used: [...prev.used, matchId], remaining: prev.remaining - 1 }));
      showToast("🃏 Double or Nothing card played!", "success");
    } catch { showToast("Network error.", "warn"); }
  }

  async function saveResult(matchId, result) {
    try {
      const res = await fetch(`/api/admin/results/${matchId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-password": adminPwd },
        body: JSON.stringify(result),
      });
      if (res.ok) { fetchResults(); showToast("Result saved!", "success"); }
      else showToast("Failed to save result.", "warn");
    } catch { showToast("Network error.", "warn"); }
  }

  return (
    <div style={S.app}>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }`}</style>

      {/* HEADER */}
      <div style={S.header}>
        <div style={S.logo} onClick={() => setScreen("home")}>
          The <span style={S.logoAccent}>Gaffer's</span> Pick
          <span style={{ fontSize: 10, color: "#8892a4", marginLeft: 8, fontFamily: "sans-serif", fontWeight: 400 }}>WC 2026</span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {currentPlayer && <span style={{ fontSize: 12, color: "#8892a4" }}>👤 {currentPlayer.name}</span>}
          {currentPlayer && (
            <button
              style={{ ...S.pill(false), fontSize: 11 }}
              onClick={() => {
                localStorage.removeItem("gaffersPickSession");
                setCurrentPlayer(null);
                setPicks({});
                setScreen("home");
                showToast("Signed out.", "info");
              }}
            >
              Sign out
            </button>
          )}
          {currentPlayer && <button style={S.pill(screen === "predict")} onClick={() => setScreen("predict")}>Picks</button>}
          <button style={S.pill(screen === "leaderboard")} onClick={() => { setScreen("leaderboard"); Object.keys(leaderboards).forEach(fetchLeaderboard); if (adminMode) fetchAdminGroups(); }}>Board</button>
          {adminMode
            ? <button style={S.pill(screen === "admin")} onClick={() => { setScreen("admin"); fetchAdminGroups(); }}>Admin</button>
            : <button style={S.pill(false)} onClick={() => setScreen("adminLogin")}>⚙</button>}
          {!currentPlayer && <button style={S.pill(screen === "join")} onClick={() => setScreen("join")}>Join</button>}
        </div>
      </div>

      {/* TOAST */}
      {toast && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: toast.type === "success" ? "#0d2818" : toast.type === "warn" ? "#2a2200" : "#131822", border: `1px solid ${toast.type === "success" ? "#1a5c33" : toast.type === "warn" ? "#5a4400" : "#2a3040"}`, color: toast.type === "success" ? "#2ecc71" : toast.type === "warn" ? "#f5c518" : "#e8eaf0", padding: "10px 20px", borderRadius: 8, fontSize: 13, fontWeight: 600, zIndex: 999, whiteSpace: "nowrap" }}>
          {toast.msg}
        </div>
      )}

      {/* HOME */}
      {screen === "home" && (
        <div style={S.section}>
          <div style={{ textAlign: "center", padding: "48px 0 32px" }}>
            <div style={{ fontSize: 56, marginBottom: 12 }}>⚽</div>
            <h1 style={{ fontFamily: "'Georgia',serif", fontSize: 36, fontWeight: 700, margin: "0 0 8px" }}>
              The <span style={{ color: "#f5c518" }}>Gaffer's</span> Pick
            </h1>
            <p style={{ color: "#8892a4", fontSize: 15, margin: "0 0 32px" }}>World Cup 2026 · Group Stage Predictor</p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              <button style={S.btn()} onClick={() => setScreen("join")}>Join a Group</button>
              <button style={{ ...S.btn("ghost"), border: "1px solid #2a3040" }} onClick={() => setScreen("leaderboard")}>View Leaderboard</button>
            </div>
            <div style={{ marginTop: 16 }}>
              <button style={{ ...S.btn("ghost"), border: "1px solid #2a3040", fontSize: 13 }} onClick={() => setScreen("return")}>
                Already joined? Return to your picks →
              </button>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12 }}>
            {[["72", "Group Stage Matches"], ["12", "Groups"], ["48", "Nations"], ["10", "Max Pts Per Match"]].map(([n, l]) => (
              <div key={l} style={{ ...S.card, textAlign: "center" }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: "#f5c518", fontFamily: "'Georgia',serif" }}>{n}</div>
                <div style={{ fontSize: 12, color: "#8892a4", marginTop: 4 }}>{l}</div>
              </div>
            ))}
          </div>
          <div style={{ ...S.card, marginTop: 20 }}>
            <div style={{ fontSize: 12, color: "#f5c518", fontWeight: 700, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.08em" }}>Scoring</div>
            {[["Correct result (W/D/L)", "3 pts"], ["Exact home score", "+2 pts"], ["Exact away score", "+2 pts"], ["Correct goal difference", "+1 pt"], ["Correct yellow cards", "+1 pt"], ["Correct red cards", "+1 pt"]].map(([l, v]) => (
              <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid #1a1e2a", fontSize: 13 }}>
                <span style={{ color: "#c8ccd8" }}>{l}</span>
                <span style={{ color: "#f5c518", fontWeight: 700 }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* JOIN */}
      {screen === "join" && (
        <div style={S.section}>
          <h2 style={{ fontFamily: "'Georgia',serif", fontSize: 22, marginBottom: 4 }}>Join a Group</h2>
          <p style={{ color: "#8892a4", fontSize: 13, marginBottom: 24 }}>Get your group code from the Gaffer.</p>
          <div style={S.card}>
            {[["Group Code", joinCode, v => setJoinCode(v.toUpperCase()), "GP-ABC12", "text"],
            ["Your Name", joinName, setJoinName, "Leaderboard name", "text"],
            ["4-digit PIN", joinPin, v => setJoinPin(v.replace(/\D/, "")), "Pick a PIN", "password"]
            ].map(([lbl, val, set, ph, type]) => (
              <div key={lbl} style={{ marginBottom: 14 }}>
                <label style={S.label}>{lbl}</label>
                <input style={S.input} type={type} placeholder={ph} value={val} onChange={e => set(e.target.value)} maxLength={lbl.includes("PIN") ? 6 : 50} />
              </div>
            ))}
            {joinError && <div style={{ color: "#e74c3c", fontSize: 13, marginBottom: 10 }}>{joinError}</div>}
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#8892a4", marginBottom: 14, cursor: "pointer" }}>
              <input type="checkbox" checked={keepSignedIn} onChange={e => setKeepSignedIn(e.target.checked)} style={{ width: 16, height: 16, accentColor: "#f5c518", cursor: "pointer" }} />
              Keep me signed in on this device
            </label>
            <button style={S.btn()} onClick={handleJoin} disabled={loading}>{loading ? "Joining…" : "Enter the Gaffer's Pick →"}</button>
          </div>
        </div>
      )}

      {/* RETURN */}
      {screen === "return" && (
        <div style={S.section}>
          <h2 style={{ fontFamily: "'Georgia',serif", fontSize: 22, marginBottom: 4 }}>Return to Your Picks</h2>
          <p style={{ color: "#8892a4", fontSize: 13, marginBottom: 24 }}>Enter the same group code, name, and PIN you joined with.</p>
          <div style={S.card}>
            <div style={{ marginBottom: 14 }}>
              <label style={S.label}>Group Code</label>
              <input style={S.input} placeholder="GP-ABC12" value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={S.label}>Your Name</label>
              <input style={S.input} placeholder="Exactly as you joined" value={returnName} onChange={e => setReturnName(e.target.value)} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={S.label}>PIN</label>
              <input style={S.input} type="password" placeholder="Your PIN" maxLength={6} value={returnPin} onChange={e => setReturnPin(e.target.value.replace(/\D/, ""))} />
            </div>
            {returnError && <div style={{ color: "#e74c3c", fontSize: 13, marginBottom: 10 }}>{returnError}</div>}
            {returnSuggestion && (
              <div style={{ background: "#1a1e2a", border: "1px solid #2a3040", borderRadius: 6, padding: 10, marginBottom: 10, fontSize: 13 }}>
                Couldn't find "{returnName}". Did you mean{" "}
                <button
                  style={{ background: "none", border: "none", color: "#f5c518", fontWeight: 700, cursor: "pointer", textDecoration: "underline", padding: 0, fontSize: 13 }}
                  onClick={() => { setReturnName(returnSuggestion); handleReturn(returnSuggestion); }}
                >
                  {returnSuggestion}
                </button>?
              </div>
            )}
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#8892a4", marginBottom: 14, cursor: "pointer" }}>
              <input type="checkbox" checked={keepSignedIn} onChange={e => setKeepSignedIn(e.target.checked)} style={{ width: 16, height: 16, accentColor: "#f5c518", cursor: "pointer" }} />
              Keep me signed in on this device
            </label>
            <button style={S.btn()} onClick={() => handleReturn()} disabled={loading}>{loading ? "Checking…" : "Return to Picks →"}</button>
            <div style={{ marginTop: 14, textAlign: "center" }}>
              <button style={{ ...S.btn("ghost"), fontSize: 12 }} onClick={() => setScreen("join")}>New here? Join a group instead</button>
            </div>
          </div>
        </div>
      )}

      {/* ADMIN LOGIN */}
      {screen === "adminLogin" && (
        <div style={S.section}>
          <h2 style={{ fontFamily: "'Georgia',serif", fontSize: 22, marginBottom: 20 }}>Admin Access</h2>
          <div style={S.card}>
            <label style={S.label}>Password</label>
            <input style={{ ...S.input, marginBottom: 12 }} type="password" value={adminPwd} onChange={e => setAdminPwd(e.target.value)} placeholder="Admin password" />
            <button style={S.btn()} onClick={async () => {
              const ok = await checkAdminPassword(adminPwd);
              if (ok) { setAdminMode(true); setScreen("admin"); fetchAdminGroups(); }
              else showToast("Wrong password.", "warn");
            }}>Unlock Admin</button>
          </div>
        </div>
      )}

      {/* ADMIN */}
      {screen === "admin" && adminMode && (
        <div style={S.section}>
          <h2 style={{ fontFamily: "'Georgia',serif", fontSize: 22, marginBottom: 20 }}>Admin Panel</h2>
          <div style={S.card}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#f5c518", marginBottom: 12 }}>CREATE GROUP</div>
            <div style={{ display: "flex", gap: 8 }}>
              <input style={{ ...S.input, flex: 1 }} placeholder="Group name (e.g. Office League)" value={newGroupName} onChange={e => setNewGroupName(e.target.value)} />
              <button style={S.btn()} onClick={handleCreateGroup}>Create</button>
            </div>
          </div>
          {groups.map(g => (
            <div key={g.code} style={S.card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontWeight: 700 }}>{g.name}</span>
                <span style={S.badge("yellow")}>{g.code}</span>
              </div>
              <div style={{ fontSize: 12, color: "#8892a4" }}>
                {g.players?.length || 0} players · Share code: <strong style={{ color: "#f5c518" }}>{g.code}</strong>
              </div>
            </div>
          ))}
          <div style={{ marginTop: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#f5c518", marginBottom: 12 }}>ENTER RESULTS</div>
            <GroupFilter value={adminGroupFilter} onChange={setAdminGroupFilter} />
            {renderMatchesWithCompletedSection({
              matches: MATCHES, results, tz, groupFilter: adminGroupFilter,
              renderRow: (m) => <AdminMatchRow key={m.id} match={m} result={results[m.id]} tz={tz} onSave={(r) => saveResult(m.id, r)} />,
              collapsed: adminCompletedCollapsed,
              onToggle: () => setAdminCompletedCollapsed(c => !c)
            })}
          </div>
        </div>
      )}

      {/* PREDICT */}
      {screen === "predict" && currentPlayer && (
        <div style={S.section}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
            <h2 style={{ fontFamily: "'Georgia',serif", fontSize: 20, margin: 0 }}>Your Picks — {currentPlayer.groupName}</h2>
            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, color: "#8892a4" }}>Locked 30 min before kickoff</span>
              <span style={{ background: "#2a2200", border: "1px solid #5a4400", borderRadius: 6, padding: "3px 10px", fontSize: 12, fontWeight: 700, color: "#f5c518" }}>
                🃏 {cards.remaining}/3 cards remaining
              </span>
            </div>
          </div>
          <GroupFilter value={groupFilter} onChange={setGroupFilter} />
          {renderMatchesWithCompletedSection({
            matches: MATCHES, results, tz, groupFilter,
            renderRow: (m) => <PredictRow key={m.id} match={m} pick={picks[m.id]} result={results[m.id]} tz={tz} serverNow={serverNow} onSave={(pred) => savePick(m.id, pred)} showToast={showToast} cardPlayed={cards.used.includes(m.id)} cardsRemaining={cards.remaining} onPlayCard={() => playCard(m.id)} />,
            collapsed: picksCompletedCollapsed,
            onToggle: () => setPicksCompletedCollapsed(c => !c)
          })}
        </div>
      )}

      {/* LEADERBOARD */}
      {screen === "leaderboard" && (
        <div style={S.section}>
          <h2 style={{ fontFamily: "'Georgia',serif", fontSize: 22, marginBottom: 20 }}>Leaderboard</h2>

          {adminMode && (
            <div style={{ ...S.card, marginBottom: 20 }}>
              <label style={S.label}>View Leaderboard For</label>
              <select
                style={S.select}
                value={adminLbGroup}
                onChange={e => {
                  const code = e.target.value;
                  setAdminLbGroup(code);
                  if (code) fetchLeaderboard(code);
                }}
              >
                <option value="">Select a group…</option>
                {groups.map(g => (
                  <option key={g.code} value={g.code}>{g.name} ({g.code})</option>
                ))}
              </select>
            </div>
          )}

          {!adminMode && Object.keys(leaderboards).length === 0 && (
            <div style={S.card}>
              <p style={{ color: "#8892a4", fontSize: 14, margin: 0 }}>Enter your group code to see your leaderboard.</p>
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <input style={{ ...S.input, flex: 1 }} placeholder="Group code (GP-XXXXX)" value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())} />
                <button style={S.btn()} onClick={() => fetchLeaderboard(joinCode.trim())}>Load</button>
              </div>
            </div>
          )}

          {adminMode && !adminLbGroup && (
            <div style={{ color: "#8892a4", fontSize: 13 }}>Select a group above to view its leaderboard.</div>
          )}

          {Object.entries(leaderboards)
            .filter(([code]) => !adminMode || code === adminLbGroup)
            .map(([code, data]) => {
              const board = data.board || [];
              const groupName = data.groupName || code;
              return (
                <div key={code}>
                  {/* Featured match card per group */}
                  <FeaturedMatchCard
                    groupCode={code}
                    result={(() => { const f = getFeaturedMatch(serverNow); return f ? results[f.match.id] : null; })()}
                    tz={tz}
                    serverNow={serverNow}
                  />
                  <div style={{ ...S.card, marginBottom: 20 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                      <span style={{ fontWeight: 700, fontSize: 16 }}>{groupName}</span>
                      <span style={S.badge("yellow")}>{code}</span>
                    </div>
                    {board.length === 0 && <div style={{ color: "#8892a4", fontSize: 13 }}>No picks yet.</div>}
                    {board.map((p, i) => {
                      const prevTotal = i > 0 ? board[i - 1].total : null;
                      const rank = i === 0 ? 1 : board[i].total === prevTotal ? null : i + 1;
                      const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : null;
                      const displayRank = medal || `${i + 1}`;
                      return (
                        <div key={p.name} style={{ display: "flex", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #1a1e2a", gap: 10 }}>
                          <span style={{ width: 24, fontSize: 13, fontWeight: 800, color: medal ? "#f5c518" : "#8892a4" }}>{displayRank}</span>
                          <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{p.name}</span>
                          <span style={{ fontSize: 12, color: "#8892a4" }}>{p.predicted} picked</span>
                          <span style={S.ptsBadge(p.total)}>{p.total} pts</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}

// ─── PREDICT ROW ──────────────────────────────────────────────────────────────
function PredictRow({ match, pick, result, tz, serverNow, onSave, showToast, cardPlayed, cardsRemaining, onPlayCard }) {
  const locked = isLocked(match.kickoff, serverNow);
  const [h, setH] = useState(pick?.homeScore ?? "");
  const [a, setA] = useState(pick?.awayScore ?? "");
  const [y, setY] = useState(pick?.yellows ?? "");
  const [r, setR] = useState(pick?.reds ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setH(pick?.homeScore ?? "");
    setA(pick?.awayScore ?? "");
    setY(pick?.yellows ?? "");
    setR(pick?.reds ?? "");
  }, [pick]);

  async function handleSave() {
    if (locked) { showToast("Match is locked!", "warn"); return; }
    if (h === "" || a === "") { showToast("Enter both scores first.", "warn"); return; }
    setSaving(true);
    await onSave({ homeScore: parseInt(h), awayScore: parseInt(a), yellows: y !== "" ? parseInt(y) : null, reds: r !== "" ? parseInt(r) : null });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  const pts = result && pick && pick.homeScore != null ? calcPoints(pick, result) : null;

  return (
    <div style={{ ...S.card, opacity: locked && !pick ? 0.65 : 1 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 4 }}>
        <span style={{ fontSize: 11, color: "#8892a4" }}>
          {formatKickoff(match.kickoff, tz)} · <span style={{ color: "#3a4a6a" }}>Grp {match.group}</span>
        </span>
        <div style={{ display: "flex", gap: 6 }}>
          {locked && <span style={S.badge("red")}>Locked</span>}
          {pts !== null && <span style={S.ptsBadge(pts)}>{pts} pts</span>}
        </div>
      </div>
      <div style={S.matchRow}>
        <span style={S.teamName}>{flag(match.home)} {match.home}</span>
        <input style={{ ...S.inputSm, background: locked ? "#0a0c10" : "#0d1117" }} disabled={locked} value={h} onChange={e => setH(e.target.value.replace(/\D/, ""))} placeholder="-" maxLength={2} />
        <span style={S.vs}>-</span>
        <input style={{ ...S.inputSm, background: locked ? "#0a0c10" : "#0d1117" }} disabled={locked} value={a} onChange={e => setA(e.target.value.replace(/\D/, ""))} placeholder="-" maxLength={2} />
        <span style={S.teamName}>{flag(match.away)} {match.away}</span>
      </div>
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 10, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 11, color: "#8892a4" }}>🟨</span>
          <input style={{ ...S.inputSm, width: 44, background: locked ? "#0a0c10" : "#0d1117" }} disabled={locked} value={y} onChange={e => setY(e.target.value.replace(/\D/, ""))} placeholder="-" maxLength={2} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 11, color: "#8892a4" }}>🟥</span>
          <input style={{ ...S.inputSm, width: 44, background: locked ? "#0a0c10" : "#0d1117" }} disabled={locked} value={r} onChange={e => setR(e.target.value.replace(/\D/, ""))} placeholder="-" maxLength={2} />
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          {!locked && (
            <button style={{ ...S.btn("sm"), background: saved ? "#0d2818" : "#f5c518", color: saved ? "#2ecc71" : "#0a0c10" }} onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : saved ? "✓ Saved" : "Save Pick"}
            </button>
          )}
          {(() => {
            const ko = new Date(match.kickoff).getTime();
            const windowClose = ko + 50 * 60 * 1000;
            const inWindow = serverNow >= ko && serverNow <= windowClose;
            if (cardPlayed) return (
              <span style={{ ...S.badge("yellow"), fontSize: 12, padding: "4px 10px" }}>🃏 Card Played</span>
            );
            if (inWindow && cardsRemaining > 0) return (
              <button style={{ ...S.btn("sm"), background: "#2a2200", border: "1px solid #5a4400", color: "#f5c518" }} onClick={onPlayCard}>
                🃏 Play Card
              </button>
            );
            return null;
          })()}
        </div>
      </div>
      {result && (
        <div style={{ marginTop: 8, fontSize: 12, color: "#8892a4", borderTop: "1px solid #1a1e2a", paddingTop: 8 }}>
          Result: <strong style={{ color: "#e8eaf0" }}>{match.home} {result.homeScore}-{result.awayScore} {match.away}</strong>
          {result.yellows != null && <> · 🟨 {result.yellows}</>}
          {result.reds != null && <> · 🟥 {result.reds}</>}
        </div>
      )}
    </div>
  );
}

// ─── ADMIN MATCH ROW ──────────────────────────────────────────────────────────
function AdminMatchRow({ match, result, tz, onSave }) {
  const [h, setH] = useState(result?.homeScore ?? "");
  const [a, setA] = useState(result?.awayScore ?? "");
  const [y, setY] = useState(result?.yellows ?? "");
  const [r, setR] = useState(result?.reds ?? "");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setH(result?.homeScore ?? "");
    setA(result?.awayScore ?? "");
    setY(result?.yellows ?? "");
    setR(result?.reds ?? "");
  }, [result]);

  async function handleSave() {
    if (h === "" || a === "") return;
    await onSave({ homeScore: parseInt(h), awayScore: parseInt(a), yellows: y !== "" ? parseInt(y) : null, reds: r !== "" ? parseInt(r) : null });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <div style={{ ...S.card, marginBottom: 8 }}>
      <div style={{ fontSize: 11, color: "#8892a4", marginBottom: 6 }}>{formatKickoff(match.kickoff, tz)} · {match.id}</div>
      <div style={S.matchRow}>
        <span style={{ ...S.teamName, fontSize: 12 }}>{flag(match.home)} {match.home}</span>
        <input style={S.inputSm} value={h} onChange={e => setH(e.target.value.replace(/\D/, ""))} placeholder="-" maxLength={2} />
        <span style={S.vs}>-</span>
        <input style={S.inputSm} value={a} onChange={e => setA(e.target.value.replace(/\D/, ""))} placeholder="-" maxLength={2} />
        <span style={{ ...S.teamName, fontSize: 12 }}>{flag(match.away)} {match.away}</span>
      </div>
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 8, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 11, color: "#8892a4" }}>🟨</span>
          <input style={{ ...S.inputSm, width: 44 }} value={y} onChange={e => setY(e.target.value.replace(/\D/, ""))} placeholder="-" maxLength={2} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 11, color: "#8892a4" }}>🟥</span>
          <input style={{ ...S.inputSm, width: 44 }} value={r} onChange={e => setR(e.target.value.replace(/\D/, ""))} placeholder="-" maxLength={2} />
        </div>
        <button style={{ ...S.btn("sm"), marginLeft: "auto", background: saved ? "#0d2818" : "#f5c518", color: saved ? "#2ecc71" : "#0a0c10" }} onClick={handleSave}>
          {saved ? "✓ Saved" : "Save Result"}
        </button>
      </div>
    </div>
  );
}
