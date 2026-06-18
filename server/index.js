require("dotenv").config();

const MATCHES = require("./matches");
const express = require("express");
const cors = require("cors");
const path = require("path");
const { Pool } = require("pg");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3001;

// ─── DB ───────────────────────────────────────────────────────────────────────
const pool = new Pool({
	connectionString: process.env.DATABASE_URL,
	ssl: { rejectUnauthorized: false },
});

// ─── INIT TABLES ──────────────────────────────────────────────────────────────
async function initDb() {
	await pool.query(`
    CREATE TABLE IF NOT EXISTS groups (
      code TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS players (
      id SERIAL PRIMARY KEY,
      group_code TEXT NOT NULL REFERENCES groups(code) ON DELETE CASCADE,
      name TEXT NOT NULL,
      pin TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(group_code, name)
    );

    CREATE TABLE IF NOT EXISTS picks (
      id SERIAL PRIMARY KEY,
      group_code TEXT NOT NULL,
      player_name TEXT NOT NULL,
      match_id TEXT NOT NULL,
      home_score INT,
      away_score INT,
      yellows INT,
      reds INT,
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(group_code, player_name, match_id)
    );

    CREATE TABLE IF NOT EXISTS results (
      match_id TEXT PRIMARY KEY,
      home_score INT NOT NULL,
      away_score INT NOT NULL,
      yellows INT,
      reds INT,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
	console.log("DB tables ready");
}

// ─── MIDDLEWARE ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// Serve built React app in production
app.use(express.static(path.join(__dirname, "../client/dist")));

// ─── AUTH HELPER ──────────────────────────────────────────────────────────────
function checkAdminHash(input) {
	const hash = crypto.createHash("sha256").update(input).digest("hex");
	return hash === process.env.ADMIN_PASSWORD_HASH;
}

function adminAuth(req, res, next) {
	const pwd = req.headers["x-admin-password"];
	if (!pwd || !checkAdminHash(pwd))
		return res.status(401).json({ error: "Unauthorized" });
	next();
}

// ─── ROUTES ───────────────────────────────────────────────────────────────────

// Health
app.get("/api/health", (_, res) => res.json({ ok: true }));

// Server Time
app.get("/api/time", (_, res) => res.json({ now: Date.now() }));

// Admin: verify password
app.post("/api/admin/verify", (req, res) => {
	const { password } = req.body;
	if (!password || !checkAdminHash(password))
		return res.status(401).json({ ok: false });
	res.json({ ok: true });
});

// Admin: create group
app.post("/api/admin/groups", adminAuth, async (req, res) => {
	const { code, name } = req.body;
	if (!code || !name)
		return res.status(400).json({ error: "code and name required" });
	try {
		await pool.query("INSERT INTO groups (code, name) VALUES ($1, $2)", [
			code,
			name,
		]);
		res.json({ code, name });
	} catch (e) {
		res.status(500).json({ error: e.message });
	}
});

// Get all groups (admin)
app.get("/api/admin/groups", adminAuth, async (req, res) => {
	try {
		const { rows: groups } = await pool.query(
			"SELECT * FROM groups ORDER BY created_at",
		);
		const { rows: players } = await pool.query(
			"SELECT group_code, name FROM players",
		);
		const result = groups.map((g) => ({
			...g,
			players: players
				.filter((p) => p.group_code === g.code)
				.map((p) => ({ name: p.name })),
		}));
		res.json(result);
	} catch (e) {
		res.status(500).json({ error: e.message });
	}
});

// Admin: save result
app.post("/api/admin/results/:matchId", adminAuth, async (req, res) => {
	const { matchId } = req.params;
	const { homeScore, awayScore, yellows, reds } = req.body;
	try {
		await pool.query(
			`
      INSERT INTO results (match_id, home_score, away_score, yellows, reds, updated_at)
      VALUES ($1,$2,$3,$4,$5,NOW())
      ON CONFLICT (match_id) DO UPDATE
        SET home_score=$2, away_score=$3, yellows=$4, reds=$5, updated_at=NOW()
    `,
			[matchId, homeScore, awayScore, yellows ?? null, reds ?? null],
		);
		res.json({ ok: true });
	} catch (e) {
		res.status(500).json({ error: e.message });
	}
});

// Get all results (public)
app.get("/api/results", async (req, res) => {
	try {
		const { rows } = await pool.query("SELECT * FROM results");
		const map = {};
		rows.forEach((r) => {
			map[r.match_id] = {
				homeScore: r.home_score,
				awayScore: r.away_score,
				yellows: r.yellows,
				reds: r.reds,
			};
		});
		res.json(map);
	} catch (e) {
		res.status(500).json({ error: e.message });
	}
});

// Player: join / verify group
app.post("/api/groups/:code/join", async (req, res) => {
	const { code } = req.params;
	const { name, pin } = req.body;
	if (!name || !pin)
		return res.status(400).json({ error: "name and pin required" });
	try {
		const { rows: groups } = await pool.query(
			"SELECT * FROM groups WHERE code=$1",
			[code],
		);
		if (!groups.length)
			return res.status(404).json({ error: "Group not found" });

		const { rows: existing } = await pool.query(
			"SELECT * FROM players WHERE group_code=$1 AND LOWER(name)=LOWER($2)",
			[code, name],
		);

		if (existing.length) {
			if (existing[0].pin !== pin)
				return res.status(401).json({ error: "Wrong PIN for that name" });
			return res.json({ ok: true, group: groups[0] });
		}

		await pool.query(
			"INSERT INTO players (group_code, name, pin) VALUES ($1,$2,$3)",
			[code, name, pin],
		);
		res.json({ ok: true, group: groups[0] });
	} catch (e) {
		res.status(500).json({ error: e.message });
	}
});

// Get public group info (for leaderboard join)
app.get("/api/groups/:code", async (req, res) => {
	try {
		const { rows } = await pool.query(
			"SELECT code, name FROM groups WHERE code=$1",
			[req.params.code],
		);
		if (!rows.length) return res.status(404).json({ error: "Not found" });
		res.json(rows[0]);
	} catch (e) {
		res.status(500).json({ error: e.message });
	}
});

// Save pick
app.post("/api/picks", async (req, res) => {
	const {
		groupCode,
		playerName,
		pin,
		matchId,
		homeScore,
		awayScore,
		yellows,
		reds,
	} = req.body;
	try {
		// Verify PIN
		const { rows } = await pool.query(
			"SELECT pin FROM players WHERE group_code=$1 AND LOWER(name)=LOWER($2)",
			[groupCode, playerName],
		);
		if (!rows.length || rows[0].pin !== pin)
			return res.status(401).json({ error: "Invalid PIN" });

		const match = MATCHES.find((m) => m.id === matchId);
		if (match) {
			const lockTime = new Date(match.kickoff).getTime() - 30 * 60 * 1000;
			if (Date.now() >= lockTime) {
				return res.status(403).json({ error: "Match is locked." });
			}
		}
		await pool.query(
			`
      INSERT INTO picks (group_code, player_name, match_id, home_score, away_score, yellows, reds, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())
      ON CONFLICT (group_code, player_name, match_id) DO UPDATE
        SET home_score=$4, away_score=$5, yellows=$6, reds=$7, updated_at=NOW()
    `,
			[
				groupCode,
				playerName,
				matchId,
				homeScore,
				awayScore,
				yellows ?? null,
				reds ?? null,
			],
		);
		res.json({ ok: true });
	} catch (e) {
		res.status(500).json({ error: e.message });
	}
});

// Get picks for a player
app.get("/api/picks/:groupCode/:playerName", async (req, res) => {
	const { groupCode, playerName } = req.params;
	const { pin } = req.query;
	try {
		const { rows: players } = await pool.query(
			"SELECT pin FROM players WHERE group_code=$1 AND LOWER(name)=LOWER($2)",
			[groupCode, playerName],
		);
		if (!players.length || players[0].pin !== pin)
			return res.status(401).json({ error: "Invalid PIN" });

		const { rows } = await pool.query(
			"SELECT * FROM picks WHERE group_code=$1 AND LOWER(player_name)=LOWER($2)",
			[groupCode, playerName],
		);
		const map = {};
		rows.forEach((r) => {
			map[r.match_id] = {
				homeScore: r.home_score,
				awayScore: r.away_score,
				yellows: r.yellows,
				reds: r.reds,
			};
		});
		res.json(map);
	} catch (e) {
		res.status(500).json({ error: e.message });
	}
});

// Leaderboard for a group
app.get("/api/leaderboard/:groupCode", async (req, res) => {
	try {
		const { rows: groupRows } = await pool.query(
			"SELECT name FROM groups WHERE code=$1",
			[req.params.groupCode],
		);
		const groupName = groupRows[0]?.name || req.params.groupCode;

		const { rows: players } = await pool.query(
			"SELECT name FROM players WHERE group_code=$1",
			[req.params.groupCode],
		);
		const { rows: picks } = await pool.query(
			"SELECT * FROM picks WHERE group_code=$1",
			[req.params.groupCode],
		);
		const { rows: results } = await pool.query("SELECT * FROM results");

		const resultMap = {};
		results.forEach((r) => {
			resultMap[r.match_id] = {
				homeScore: r.home_score,
				awayScore: r.away_score,
				yellows: r.yellows,
				reds: r.reds,
			};
		});

		const board = players
			.map((p) => {
				const playerPicks = picks.filter(
					(pk) => pk.player_name.toLowerCase() === p.name.toLowerCase(),
				);
				let total = 0,
					predicted = 0;
				playerPicks.forEach((pk) => {
					predicted++;
					const result = resultMap[pk.match_id];
					if (result) {
						total += calcPoints(
							{
								homeScore: pk.home_score,
								awayScore: pk.away_score,
								yellows: pk.yellows,
								reds: pk.reds,
							},
							result,
						);
					}
				});
				return { name: p.name, total, predicted };
			})
			.sort((a, b) => b.total - a.total);

		res.json({ groupName, board });
	} catch (e) {
		res.status(500).json({ error: e.message });
	}
});

// Featured match picks for a group
app.get("/api/leaderboard/:groupCode/match/:matchId", async (req, res) => {
	const { groupCode, matchId } = req.params;
	try {
		const { rows: players } = await pool.query(
			"SELECT name FROM players WHERE group_code=$1",
			[groupCode],
		);
		const { rows: picks } = await pool.query(
			"SELECT player_name, home_score, away_score, yellows, reds FROM picks WHERE group_code=$1 AND match_id=$2",
			[groupCode, matchId],
		);
		const pickMap = {};
		picks.forEach((p) => {
			pickMap[p.player_name.toLowerCase()] = p;
		});

		const result = players.map((p) => {
			const pk = pickMap[p.name.toLowerCase()];
			return {
				name: p.name,
				pick: pk
					? { homeScore: pk.home_score, awayScore: pk.away_score, yellows: pk.yellows, reds: pk.reds }
					: null,
			};
		});
		res.json(result);
	} catch (e) {
		res.status(500).json({ error: e.message });
	}
});

// Return flow: validate existing player, suggest close matches, never create
app.get("/api/groups/:code/player/:name", async (req, res) => {
	const { code, name } = req.params;
	try {
		const { rows: players } = await pool.query(
			"SELECT name, pin FROM players WHERE group_code=$1",
			[code],
		);
		if (!players.length)
			return res
				.status(404)
				.json({ error: "Group not found or has no players yet." });

		const exact = players.find(
			(p) => p.name.toLowerCase() === name.toLowerCase(),
		);
		if (exact) return res.json({ found: true, exactName: exact.name });

		// Fuzzy match: simple Levenshtein distance, suggest closest if reasonably close
		function dist(a, b) {
			const m = a.length,
				n = b.length;
			const dp = Array.from({ length: m + 1 }, () =>
				new Array(n + 1).fill(0),
			);
			for (let i = 0; i <= m; i++) dp[i][0] = i;
			for (let j = 0; j <= n; j++) dp[0][j] = j;
			for (let i = 1; i <= m; i++) {
				for (let j = 1; j <= n; j++) {
					dp[i][j] =
						a[i - 1] === b[j - 1]
							? dp[i - 1][j - 1]
							: 1 +
								Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
				}
			}
			return dp[m][n];
		}

		let best = null,
			bestDist = Infinity;
		players.forEach((p) => {
			const d = dist(name.toLowerCase(), p.name.toLowerCase());
			if (d < bestDist) {
				bestDist = d;
				best = p.name;
			}
		});

		// Only suggest if reasonably close (within 40% of the longer string's length)
		const threshold = Math.max(
			2,
			Math.ceil(Math.max(name.length, best?.length || 0) * 0.4),
		);
		if (best && bestDist <= threshold) {
			return res
				.status(404)
				.json({ error: "Player not found.", suggestion: best });
		}
		return res.status(404).json({ error: "Player not found." });
	} catch (e) {
		res.status(500).json({ error: e.message });
	}
});

// ─── SCORING (server-side) ────────────────────────────────────────────────────
function calcPoints(pred, result) {
	if (!pred || !result) return 0;
	const ph = parseInt(pred.homeScore),
		pa = parseInt(pred.awayScore);
	const rh = parseInt(result.homeScore),
		ra = parseInt(result.awayScore);
	if (isNaN(ph) || isNaN(pa) || isNaN(rh) || isNaN(ra)) return 0;
	let pts = 0;
	const predResult = ph > pa ? "H" : ph < pa ? "A" : "D";
	const realResult = rh > ra ? "H" : rh < ra ? "A" : "D";
	if (predResult === realResult) pts += 3;
	if (ph === rh) pts += 2;
	if (pa === ra) pts += 2;
	if ((ph - pa) === (rh - ra)) pts += 1; // correct goal difference
	// if (ph !== rh || pa !== ra) {

	// }
	if (
		pred.yellows != null &&
		result.yellows != null &&
		parseInt(pred.yellows) === parseInt(result.yellows)
	)
		pts += 1;
	if (
		pred.reds != null &&
		result.reds != null &&
		parseInt(pred.reds) === parseInt(result.reds)
	)
		pts += 1;
	return pts;
}

// ─── SPA FALLBACK ─────────────────────────────────────────────────────────────
app.get("*", (req, res) => {
	res.sendFile(path.join(__dirname, "../client/dist/index.html"));
});

// ─── START ────────────────────────────────────────────────────────────────────
initDb()
	.then(() => {
		app.listen(PORT, () =>
			console.log(`Gaffer's Pick running on port ${PORT}`),
		);
	})
	.catch((err) => {
		console.error("DB init failed:", err);
		process.exit(1);
	});
