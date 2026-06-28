import React, { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";

export default function GroupStageRecap() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const { data: allMatches } = await supabase.from("matches").select(`
          *,
          home_team:teams!matches_home_team_id_fkey(name, flag_emoji),
          away_team:teams!matches_away_team_id_fkey(name, flag_emoji)
        `);

      const { data: predictions } = await supabase.from("predictions").select(`
          *,
          user:profiles(username)
        `);

      const { data: players } = await supabase
        .from("profiles")
        .select("*")
        .order("total_points", { ascending: false });

      // Filter to group stage only
      const gsMatches = (allMatches || []).filter(
        (m) => m.stage === "group_stage",
      );
      const completedGs = gsMatches.filter((m) => m.is_completed);
      const gsMatchIds = new Set(gsMatches.map((m) => m.id));
      const gsPreds = (predictions || []).filter((p) => gsMatchIds.has(p.match_id));

      // --- Points per player in group stage ---
      const playerGsPoints = {};
      players.forEach((pl) => {
        const pts = gsPreds
          .filter((p) => p.user_id === pl.id)
          .reduce((s, p) => s + p.points_earned, 0);
        playerGsPoints[pl.username] = pts;
      });
      const gsLeader = Object.entries(playerGsPoints).sort((a, b) => b[1] - a[1])[0];
      const gsLastPlace = Object.entries(playerGsPoints).sort((a, b) => a[1] - b[1])[0];

      // --- Total goals in group stage ---
      const totalGoals = completedGs.reduce(
        (s, m) => s + (m.home_score || 0) + (m.away_score || 0),
        0,
      );

      // --- Exact predictions (perfect score) per player ---
      const exactByPlayer = {};
      gsPreds.forEach((p) => {
        const m = gsMatches.find((m) => m.id === p.match_id);
        if (
          m?.is_completed &&
          p.predicted_home_score === m.home_score &&
          p.predicted_away_score === m.away_score
        ) {
          const name = p.user?.username;
          exactByPlayer[name] = (exactByPlayer[name] || 0) + 1;
        }
      });
      const topSniper = Object.entries(exactByPlayer).sort((a, b) => b[1] - a[1])[0];
      const noExact = Object.entries(exactByPlayer).filter(([, c]) => c === 0).map(([n]) => n);

      // --- Most optimistic (highest total goals predicted) ---
      const predGoals = {};
      players.forEach((pl) => {
        predGoals[pl.username] = gsPreds
          .filter((p) => p.user_id === pl.id)
          .reduce((s, p) => s + p.predicted_home_score + p.predicted_away_score, 0);
      });
      const mostOptimistic = Object.entries(predGoals).sort((a, b) => b[1] - a[1])[0];
      const mostPessimistic = Object.entries(predGoals).sort((a, b) => a[1] - b[1])[0];

      // --- Biggest upset (most players got the winner wrong) ---
      const upsets = completedGs
        .map((match) => {
          const matchPreds = gsPreds.filter((p) => p.match_id === match.id);
          const actualWinner =
            match.home_score > match.away_score
              ? "home"
              : match.home_score < match.away_score
              ? "away"
              : "draw";
          const wrong = matchPreds.filter((p) => {
            const pw =
              p.predicted_home_score > p.predicted_away_score
                ? "home"
                : p.predicted_home_score < p.predicted_away_score
                ? "away"
                : "draw";
            return pw !== actualWinner;
          }).length;
          return { match, wrong, total: matchPreds.length };
        })
        .sort((a, b) => b.wrong - a.wrong)[0];

      // --- Highest scoring match ---
      const highestScoring = completedGs.sort(
        (a, b) =>
          (b.home_score + b.away_score) - (a.home_score + a.away_score),
      )[0];

      // --- Most draws predicted ---
      const drawsByPlayer = {};
      players.forEach((pl) => {
        drawsByPlayer[pl.username] = gsPreds
          .filter(
            (p) =>
              p.user_id === pl.id &&
              p.predicted_home_score === p.predicted_away_score,
          ).length;
      });
      const drawLover = Object.entries(drawsByPlayer).sort((a, b) => b[1] - a[1])[0];

      // --- Hot streak in group stage ---
      const hotStreaks = players.map((pl) => {
        const sorted = gsPreds
          .filter((p) => p.user_id === pl.id)
          .sort((a, b) => {
            const ma = gsMatches.find((m) => m.id === a.match_id);
            const mb = gsMatches.find((m) => m.id === b.match_id);
            return new Date(ma?.match_date) - new Date(mb?.match_date);
          });
        let cur = 0, max = 0;
        sorted.forEach((p) => {
          if (p.points_earned > 0) { cur++; max = Math.max(max, cur); }
          else cur = 0;
        });
        return { username: pl.username, streak: max };
      }).sort((a, b) => b.streak - a.streak)[0];

      // --- Cold streak in group stage ---
      const coldStreaks = players.map((pl) => {
        const sorted = gsPreds
          .filter((p) => p.user_id === pl.id)
          .sort((a, b) => {
            const ma = gsMatches.find((m) => m.id === a.match_id);
            const mb = gsMatches.find((m) => m.id === b.match_id);
            return new Date(ma?.match_date) - new Date(mb?.match_date);
          });
        let cur = 0, max = 0;
        sorted.forEach((p) => {
          if (p.points_earned === 0) { cur++; max = Math.max(max, cur); }
          else cur = 0;
        });
        return { username: pl.username, streak: max };
      }).filter((s) => s.streak > 0).sort((a, b) => b.streak - a.streak)[0];

      // --- Most popular prediction ---
      const predCounts = {};
      gsPreds.forEach((p) => {
        const key = `${p.predicted_home_score}-${p.predicted_away_score}`;
        predCounts[key] = (predCounts[key] || 0) + 1;
      });
      const mostPopular = Object.entries(predCounts).sort((a, b) => b[1] - a[1])[0];

      // --- Worst single prediction (most off) ---
      const worstPreds = [];
      gsPreds.forEach((pred) => {
        const match = gsMatches.find((m) => m.id === pred.match_id && m.is_completed);
        if (!match) return;
        const err =
          Math.abs(pred.predicted_home_score - match.home_score) +
          Math.abs(pred.predicted_away_score - match.away_score);
        worstPreds.push({ username: pred.user?.username, match, err, predicted: `${pred.predicted_home_score}-${pred.predicted_away_score}`, actual: `${match.home_score}-${match.away_score}` });
      });
      const worstPred = worstPreds.sort((a, b) => b.err - a.err)[0];

      // --- Lone wolf (most unique predictions nobody else made) ---
      const loneWolf = players.map((pl) => {
        const playerPreds = gsPreds.filter((p) => p.user_id === pl.id);
        const uniqueCount = playerPreds.filter((pred) => {
          const sameCount = gsPreds.filter(
            (p) =>
              p.match_id === pred.match_id &&
              p.predicted_home_score === pred.predicted_home_score &&
              p.predicted_away_score === pred.predicted_away_score,
          ).length;
          return sameCount === 1;
        }).length;
        return { username: pl.username, count: uniqueCount };
      }).sort((a, b) => b.count - a.count)[0];

      // --- Overall accuracy in group stage ---
      const totalGsPreds = gsPreds.filter((p) => {
        const m = gsMatches.find((mm) => mm.id === p.match_id);
        return m?.is_completed;
      });
      const correctWinners = totalGsPreds.filter((p) => {
        const m = gsMatches.find((mm) => mm.id === p.match_id);
        const pw = p.predicted_home_score > p.predicted_away_score ? "home" : p.predicted_home_score < p.predicted_away_score ? "away" : "draw";
        const aw = m.home_score > m.away_score ? "home" : m.home_score < m.away_score ? "away" : "draw";
        return pw === aw;
      }).length;
      const accuracyRate = totalGsPreds.length > 0 ? Math.round((correctWinners / totalGsPreds.length) * 100) : 0;

      // --- Winner accuracy per player ---
      const oracle = players.map((pl) => {
        const plPreds = totalGsPreds.filter((p) => p.user_id === pl.id);
        const correct = plPreds.filter((p) => {
          const m = gsMatches.find((mm) => mm.id === p.match_id);
          const pw = p.predicted_home_score > p.predicted_away_score ? "home" : p.predicted_home_score < p.predicted_away_score ? "away" : "draw";
          const aw = m.home_score > m.away_score ? "home" : m.home_score < m.away_score ? "away" : "draw";
          return pw === aw;
        }).length;
        const rate = plPreds.length > 0 ? Math.round((correct / plPreds.length) * 100) : 0;
        return { username: pl.username, rate, correct, total: plPreds.length };
      }).sort((a, b) => b.rate - a.rate);
      const topOracle = oracle[0];
      const worstOracle = oracle[oracle.length - 1];

      // --- Almost perfect (off by exactly 1 goal total) ---
      const almostPerfect = players.map((pl) => {
        const count = totalGsPreds.filter((p) => {
          if (p.user_id !== pl.id) return false;
          const m = gsMatches.find((mm) => mm.id === p.match_id);
          return (
            Math.abs(p.predicted_home_score - m.home_score) +
            Math.abs(p.predicted_away_score - m.away_score)
          ) === 1;
        }).length;
        return { username: pl.username, count };
      }).sort((a, b) => b.count - a.count)[0];

      // --- Home believer (most home wins predicted) ---
      const homeBeliever = players.map((pl) => {
        const count = gsPreds.filter(
          (p) => p.user_id === pl.id && p.predicted_home_score > p.predicted_away_score
        ).length;
        return { username: pl.username, count };
      }).sort((a, b) => b.count - a.count)[0];

      // --- Away supporter (most away wins predicted) ---
      const awaySupporter = players.map((pl) => {
        const count = gsPreds.filter(
          (p) => p.user_id === pl.id && p.predicted_away_score > p.predicted_home_score
        ).length;
        return { username: pl.username, count };
      }).sort((a, b) => b.count - a.count)[0];

      // --- Lowest average error margin (most precise) ---
      const mostPrecise = players.map((pl) => {
        const plPreds = totalGsPreds.filter((p) => p.user_id === pl.id);
        if (plPreds.length === 0) return { username: pl.username, avg: 999 };
        const totalErr = plPreds.reduce((s, p) => {
          const m = gsMatches.find((mm) => mm.id === p.match_id);
          return s + Math.abs(p.predicted_home_score - m.home_score) + Math.abs(p.predicted_away_score - m.away_score);
        }, 0);
        return { username: pl.username, avg: +(totalErr / plPreds.length).toFixed(2) };
      }).sort((a, b) => a.avg - b.avg)[0];

      // --- Most repetitive (single score used most often) ---
      const parrot = players.map((pl) => {
        const plPreds = gsPreds.filter((p) => p.user_id === pl.id);
        const counts = {};
        plPreds.forEach((p) => {
          const k = `${p.predicted_home_score}-${p.predicted_away_score}`;
          counts[k] = (counts[k] || 0) + 1;
        });
        const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
        return top ? { username: pl.username, score: top[0], count: top[1] } : null;
      }).filter(Boolean).sort((a, b) => b.count - a.count)[1];

      // --- Most diverse (most different scores used) ---
      const mostDiverse = players.map((pl) => {
        const plPreds = gsPreds.filter((p) => p.user_id === pl.id);
        const unique = new Set(plPreds.map((p) => `${p.predicted_home_score}-${p.predicted_away_score}`)).size;
        return { username: pl.username, unique };
      }).sort((a, b) => b.unique - a.unique)[0];

      // --- Match where everyone got the winner wrong ---
      const unanimouslyWrong = completedGs
        .map((match) => {
          const matchPreds = gsPreds.filter((p) => p.match_id === match.id);
          if (matchPreds.length === 0) return null;
          const actualWinner = match.home_score > match.away_score ? "home" : match.home_score < match.away_score ? "away" : "draw";
          const allWrong = matchPreds.every((p) => {
            const pw = p.predicted_home_score > p.predicted_away_score ? "home" : p.predicted_home_score < p.predicted_away_score ? "away" : "draw";
            return pw !== actualWinner;
          });
          return allWrong ? { match, total: matchPreds.length } : null;
        })
        .filter(Boolean)[0];

      // --- Most controversial match (most unique score predictions) ---
      const controversialMatch = completedGs.map((match) => {
        const matchPreds = gsPreds.filter((p) => p.match_id === match.id);
        const variety = new Set(matchPreds.map((p) => `${p.predicted_home_score}-${p.predicted_away_score}`)).size;
        return { match, variety, total: matchPreds.length };
      }).sort((a, b) => b.variety - a.variety)[0];

      // --- Best single match (player who earned most points in one match) ---
      let bestSingleMatch = null;
      gsPreds.forEach((p) => {
        if (!bestSingleMatch || p.points_earned > bestSingleMatch.points) {
          const m = gsMatches.find((mm) => mm.id === p.match_id);
          if (m?.is_completed) {
            bestSingleMatch = {
              username: p.user?.username,
              points: p.points_earned,
              match: m,
              predicted: `${p.predicted_home_score}-${p.predicted_away_score}`,
            };
          }
        }
      });

      // --- Round-by-round points per player (rounds 1, 2, 3) ---
      const roundPoints = players.map((pl) => {
        const byRound = { 1: 0, 2: 0, 3: 0 };
        gsPreds
          .filter((p) => p.user_id === pl.id)
          .forEach((p) => {
            const m = gsMatches.find((mm) => mm.id === p.match_id);
            if (m && byRound[m.round] !== undefined)
              byRound[m.round] += p.points_earned;
          });
        return { username: pl.username, byRound };
      });
      // Who improved from round 1 to round 3
      const mostImproved = roundPoints
        .map((rp) => ({ username: rp.username, diff: rp.byRound[3] - rp.byRound[1] }))
        .sort((a, b) => b.diff - a.diff)[0];

      // Who collapsed most from round 1 to round 3
      const biggestCollapse = roundPoints
        .map((rp) => ({ username: rp.username, diff: rp.byRound[3] - rp.byRound[1] }))
        .sort((a, b) => a.diff - b.diff)[0];

      // Lone genius — match where only 1 player got the correct winner
      let loneGenius = null;
      completedGs.forEach((match) => {
        const matchPreds = gsPreds.filter((p) => p.match_id === match.id);
        if (matchPreds.length < 2) return;
        const actualWinner = match.home_score > match.away_score ? "home" : match.home_score < match.away_score ? "away" : "draw";
        const correct = matchPreds.filter((p) => {
          const pw = p.predicted_home_score > p.predicted_away_score ? "home" : p.predicted_home_score < p.predicted_away_score ? "away" : "draw";
          return pw === actualWinner;
        });
        if (correct.length === 1) {
          if (!loneGenius || matchPreds.length > loneGenius.total) {
            loneGenius = { username: correct[0].user?.username, match, total: matchPreds.length };
          }
        }
      });

      // Counter-puncher — most times scored points when majority (>50%) got zero
      const counterPuncher = players.map((pl) => {
        let count = 0;
        completedGs.forEach((match) => {
          const matchPreds = gsPreds.filter((p) => p.match_id === match.id);
          if (matchPreds.length < 2) return;
          const majority0 = matchPreds.filter((p) => p.points_earned === 0).length > matchPreds.length / 2;
          const plPred = matchPreds.find((p) => p.user_id === pl.id);
          if (majority0 && plPred && plPred.points_earned > 0) count++;
        });
        return { username: pl.username, count };
      }).sort((a, b) => b.count - a.count)[0];

      setStats({
        gsLeader,
        gsLastPlace,
        totalGoals,
        completedCount: completedGs.length,
        topSniper,
        noExact,
        mostOptimistic,
        mostPessimistic,
        upsets,
        highestScoring,
        drawLover,
        hotStreaks,
        coldStreaks,
        mostPopular,
        worstPred,
        loneWolf,
        accuracyRate,
        totalGsPlayers: players.length,
        playerGsPoints,
        topOracle,
        worstOracle,
        almostPerfect,
        homeBeliever,
        awaySupporter,
        mostPrecise,
        parrot,
        mostDiverse,
        unanimouslyWrong,
        controversialMatch,
        bestSingleMatch,
        mostImproved,
        roundPoints,
        biggestCollapse,
        loneGenius,
        counterPuncher,
      });
    } catch (err) {
      console.error("Error loading group stage recap:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading)
    return <div className="loading" style={{ textAlign: "center", padding: "2rem" }}>جاري التحميل... ⏳</div>;

  if (!stats)
    return <div style={{ textAlign: "center", padding: "2rem", color: "red" }}>حدث خطأ في تحميل الإحصائيات</div>;

  const {
    gsLeader, gsLastPlace, totalGoals, completedCount, topSniper, noExact,
    mostOptimistic, mostPessimistic, upsets, highestScoring, drawLover,
    hotStreaks, coldStreaks, mostPopular, worstPred, loneWolf, accuracyRate,
    totalGsPlayers, playerGsPoints,
    topOracle, worstOracle, almostPerfect, homeBeliever, awaySupporter,
    mostPrecise, parrot, mostDiverse, unanimouslyWrong, controversialMatch,
    bestSingleMatch, mostImproved, roundPoints,
    biggestCollapse, loneGenius, counterPuncher,
  } = stats;

  return (
    <div className="tournament-stats" dir="rtl" style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <h2 style={{ textAlign: "center", marginBottom: "0.5rem" }}>
        🏆 ملخص دور المجموعات — كأس العالم 2026
      </h2>
      <p style={{ textAlign: "center", color: "#888", marginBottom: "2rem", fontSize: "0.9rem" }}>
        {completedCount} مباراة مكتملة · {totalGoals} هدف سُجِّل · نسبة التوقع الصحيح {accuracyRate}%
      </p>

      <div className="stats-grid">

        {/* Leader */}
        {gsLeader && (
          <div className="stat-card champion-card">
            <h3>🥇 بطل دور المجموعات</h3>
            <div className="champion-name">{gsLeader[0]}</div>
            <div className="champion-points">{gsLeader[1]} نقطة في الدور الأول</div>
          </div>
        )}

        {/* Last place */}
        {gsLastPlace && gsLastPlace[0] !== gsLeader?.[0] && (
          <div className="stat-card" style={{ borderColor: "#e74c3c" }}>
            <h3>🪑 راعي المؤخرة 😂</h3>
            <div className="stat-detail" style={{ fontSize: "1.1rem", fontWeight: "bold" }}>
              {gsLastPlace[0]}
            </div>
            <div className="stat-desc" style={{ marginTop: "0.5rem" }}>
              جمع فقط <strong>{gsLastPlace[1]}</strong> نقطة في دور المجموعات 💀
            </div>
          </div>
        )}

        {/* All players ranking in group stage */}
        <div className="stat-card">
          <h3>📊 ترتيب دور المجموعات</h3>
          <div className="top-three">
            {Object.entries(playerGsPoints)
              .sort((a, b) => b[1] - a[1])
              .map(([name, pts], idx) => (
                <div key={name} className="top-player">
                  <span className="medal">
                    {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `${idx + 1}.`}
                  </span>
                  <span className="name">{name}</span>
                  <span className="pts">{pts} نق</span>
                </div>
              ))}
          </div>
        </div>

        {/* Sniper */}
        {topSniper && (
          <div className="stat-card">
            <h3>🎯 قناص النتائج</h3>
            <div className="stat-detail">
              <strong>{topSniper[0]}</strong> توقّع النتيجة الحرفية{" "}
              <strong>{topSniper[1]}</strong>{" "}
              {topSniper[1] === 1 ? "مرة" : "مرات"} في دور المجموعات 🔥
            </div>
          </div>
        )}

        {/* No exact predictions */}
        {noExact?.length > 0 && (
          <div className="stat-card" style={{ borderColor: "#e67e22" }}>
            <h3>🎲 "نقطة بالقريب ما تنفع" 😅</h3>
            <div className="stat-detail">
              {noExact.join("، ")} لم يتوقع{noExact.length > 1 ? "وا" : ""} أي نتيجة حرفية طوال الدور الأول 🙈
            </div>
          </div>
        )}

        {/* Worst prediction */}
        {worstPred && (
          <div className="stat-card" style={{ borderColor: "#c0392b" }}>
            <h3>💩 أسوأ توقع في التاريخ</h3>
            <div className="stat-detail">
              <strong>{worstPred.username}</strong> توقّع{" "}
              <strong>{worstPred.predicted}</strong> في مباراة{" "}
              <strong>
                {worstPred.match.home_team.flag_emoji}{" "}
                {worstPred.match.home_team.name} vs{" "}
                {worstPred.match.away_team.name}{" "}
                {worstPred.match.away_team.flag_emoji}
              </strong>
              ، والنتيجة الحقيقية كانت <strong>{worstPred.actual}</strong> 😭
              <br />
              <span style={{ color: "#c0392b", fontWeight: "bold" }}>
                فارق {worstPred.err} أهداف عن الواقع!
              </span>
            </div>
          </div>
        )}

        {/* Biggest upset */}
        {upsets && upsets.wrong > 0 && (
          <div className="stat-card">
            <h3>😱 أكبر مفاجأة خسّرت الجميع</h3>
            <div className="match-display">
              <div className="teams">
                {upsets.match.home_team.flag_emoji} {upsets.match.home_team.name}
                <strong className="score">
                  {" "}{upsets.match.home_score} - {upsets.match.away_score}{" "}
                </strong>
                {upsets.match.away_team.flag_emoji} {upsets.match.away_team.name}
              </div>
              <div className="upset-detail" style={{ marginTop: "0.5rem" }}>
                <strong>{upsets.wrong}</strong> من أصل <strong>{upsets.total}</strong> خسّر في هذه المباراة 🤦
              </div>
            </div>
          </div>
        )}

        {/* Highest scoring match */}
        {highestScoring && (
          <div className="stat-card">
            <h3>⚽ المباراة الأكثر أهدافاً</h3>
            <div className="match-display">
              <div className="teams">
                {highestScoring.home_team.flag_emoji} {highestScoring.home_team.name}
                <strong className="score">
                  {" "}{highestScoring.home_score} - {highestScoring.away_score}{" "}
                </strong>
                {highestScoring.away_team.flag_emoji} {highestScoring.away_team.name}
              </div>
              <div style={{ marginTop: "0.5rem", color: "#888" }}>
                إجمالي {highestScoring.home_score + highestScoring.away_score} أهداف
              </div>
            </div>
          </div>
        )}

        {/* Most popular prediction */}
        {mostPopular && (
          <div className="stat-card">
            <h3>🐑 النتيجة الأكثر تكراراً</h3>
            <div className="stat-highlight">
              <div className="big-number">{mostPopular[0]}</div>
              <div className="stat-desc">
                تكرّرت <strong>{mostPopular[1]}</strong> مرة — الجميع فكّروا بنفس الطريقة 😂
              </div>
            </div>
          </div>
        )}

        {/* Optimist */}
        {mostOptimistic && (
          <div className="stat-card">
            <h3>🚀 أكثر متفائل بالأهداف</h3>
            <div className="stat-detail">
              <strong>{mostOptimistic[0]}</strong> توقّع <strong>{mostOptimistic[1]}</strong> هدفاً في المجموع — يحب المباريات الصاروخية 🔥
            </div>
          </div>
        )}

        {/* Pessimist */}
        {mostPessimistic && mostPessimistic[0] !== mostOptimistic?.[0] && (
          <div className="stat-card">
            <h3>😴 أكثر متشائم بالأهداف</h3>
            <div className="stat-detail">
              <strong>{mostPessimistic[0]}</strong> توقّع <strong>{mostPessimistic[1]}</strong> هدفاً فقط — كأنه يشاهد مباريات تدريبية 😅
            </div>
          </div>
        )}

        {/* Draw lover */}
        {drawLover && drawLover[1] > 0 && (
          <div className="stat-card">
            <h3>🤝 عاشق التعادل</h3>
            <div className="stat-detail">
              <strong>{drawLover[0]}</strong> توقّع التعادل <strong>{drawLover[1]}</strong> مرة — "ما رضيش يخسّر حد" 😏
            </div>
          </div>
        )}

        {/* Hot streak */}
        {hotStreaks && hotStreaks.streak > 1 && (
          <div className="stat-card">
            <h3>🔥 أطول سلسلة انتصارات</h3>
            <div className="stat-detail">
              <strong>{hotStreaks.username}</strong> حصل على نقاط في <strong>{hotStreaks.streak}</strong> مباريات متتالية — يا سلام! 🎉
            </div>
          </div>
        )}

        {/* Cold streak */}
        {coldStreaks && coldStreaks.streak > 1 && (
          <div className="stat-card" style={{ borderColor: "#3498db" }}>
            <h3>🧊 أطول موجة جليدية</h3>
            <div className="stat-detail">
              <strong>{coldStreaks.username}</strong> مرّ بـ<strong>{coldStreaks.streak}</strong> مباريات متتالية بدون نقطة واحدة 💀😂
            </div>
          </div>
        )}

        {/* Lone wolf */}
        {loneWolf && loneWolf.count > 0 && (
          <div className="stat-card">
            <h3>🦅 الذئب المنفرد</h3>
            <div className="stat-detail">
              <strong>{loneWolf.username}</strong> توقّع نتائج لم يتوقّعها أحد غيره{" "}
              <strong>{loneWolf.count}</strong> مرة — إمّا عبقري وإمّا... 🤔
            </div>
          </div>
        )}

        {/* Top oracle */}
        {topOracle && (
          <div className="stat-card">
            <h3>🔮 العراف</h3>
            <div className="stat-detail">
              <strong>{topOracle.username}</strong> توقّع الفائز الصحيح في{" "}
              <strong>{topOracle.correct}</strong> من <strong>{topOracle.total}</strong> مباريات
              (<strong>{topOracle.rate}%</strong>) — ودّع تواضعك! 😎
            </div>
          </div>
        )}

        {/* Worst oracle */}
        {worstOracle && worstOracle.username !== topOracle?.username && (
          <div className="stat-card" style={{ borderColor: "#9b59b6" }}>
            <h3>🙈 «ما شفت شي» جائزة</h3>
            <div className="stat-detail">
              <strong>{worstOracle.username}</strong> توقّع الفائز الصحيح مجرد{" "}
              <strong>{worstOracle.rate}%</strong> من المرات —{" "}
              {worstOracle.rate === 0 ? "صفر! حتى بالعشوائي كان ينجح 💀" : "القلب مكانه والتوقع مكان ثاني 😂"}
            </div>
          </div>
        )}

        {/* Almost perfect */}
        {almostPerfect && almostPerfect.count > 0 && (
          <div className="stat-card">
            <h3>💔 كاد ولم يكن</h3>
            <div className="stat-detail">
              <strong>{almostPerfect.username}</strong> كان على بُعد هدف واحد من النتيجة الحرفية{" "}
              <strong>{almostPerfect.count}</strong> مرة — يا حظو الفاجر! 😭
            </div>
          </div>
        )}

        {/* Most precise */}
        {mostPrecise && mostPrecise.avg < 999 && (
          <div className="stat-card">
            <h3>🧮 أدق لاعب</h3>
            <div className="stat-detail">
              <strong>{mostPrecise.username}</strong> متوسط خطأه{" "}
              <strong>{mostPrecise.avg}</strong> هدف للمباراة — أكثر دقة من VAR 🎯
            </div>
          </div>
        )}

        {/* Parrot */}
        {parrot && parrot.count > 2 && (
          <div className="stat-card" style={{ borderColor: "#1abc9c" }}>
            <h3>🦜 الببغاء</h3>
            <div className="stat-detail">
              <strong>{parrot.username}</strong> كرّر نتيجة{" "}
              <strong>{parrot.score}</strong>{" "}
              <strong>{parrot.count}</strong> مرات مختلفة —{" "}
              ما عنده غيرها! 😂
            </div>
          </div>
        )}

        {/* Most diverse */}
        {mostDiverse && (
          <div className="stat-card">
            <h3>🎨 الأكثر إبداعاً</h3>
            <div className="stat-detail">
              <strong>{mostDiverse.username}</strong> استعمل{" "}
              <strong>{mostDiverse.unique}</strong> نتيجة مختلفة في توقعاته —{" "}
              كل مباراة بنكهة جديدة 🎭
            </div>
          </div>
        )}

        {/* Everyone wrong */}
        {unanimouslyWrong && (
          <div className="stat-card" style={{ borderColor: "#e74c3c" }}>
            <h3>🌊 خسّرنا كلنا هنا!</h3>
            <div className="match-display">
              <div className="teams">
                {unanimouslyWrong.match.home_team.flag_emoji}{" "}
                {unanimouslyWrong.match.home_team.name}
                <strong className="score">
                  {" "}{unanimouslyWrong.match.home_score} -{" "}
                  {unanimouslyWrong.match.away_score}{" "}
                </strong>
                {unanimouslyWrong.match.away_team.flag_emoji}{" "}
                {unanimouslyWrong.match.away_team.name}
              </div>
              <div style={{ marginTop: "0.5rem", color: "#e74c3c", fontWeight: "bold" }}>
                الـ{unanimouslyWrong.total} لاعبين كلهم توقّعوا غلط! 💀
              </div>
            </div>
          </div>
        )}

        {/* Controversial match */}
        {controversialMatch && controversialMatch.variety > 2 && (
          <div className="stat-card">
            <h3>🎭 المباراة الأكثر إثارة للجدل</h3>
            <div className="match-display">
              <div className="teams">
                {controversialMatch.match.home_team.flag_emoji}{" "}
                {controversialMatch.match.home_team.name}
                <strong className="score">
                  {" "}{controversialMatch.match.home_score} -{" "}
                  {controversialMatch.match.away_score}{" "}
                </strong>
                {controversialMatch.match.away_team.flag_emoji}{" "}
                {controversialMatch.match.away_team.name}
              </div>
              <div style={{ marginTop: "0.5rem", color: "#888" }}>
                <strong>{controversialMatch.variety}</strong> نتيجة مختلفة من{" "}
                <strong>{controversialMatch.total}</strong> لاعبين — كل واحد رأي! 🗣️
              </div>
            </div>
          </div>
        )}

        {/* Most improved */}
        {mostImproved && mostImproved.diff > 0 && (
          <div className="stat-card">
            <h3>📈 الأكثر تطوراً</h3>
            <div className="stat-detail">
              <strong>{mostImproved.username}</strong> تحسّن بـ<strong>+{mostImproved.diff}</strong> نقطة من الجولة الأولى للثالثة —
              الخبرة بتفيد! 🚀
            </div>
          </div>
        )}

        {/* Biggest collapse */}
        {biggestCollapse && biggestCollapse.diff < 0 && (
          <div className="stat-card" style={{ borderColor: "#e74c3c" }}>
            <h3>📉 الانهيار الكبير 😭</h3>
            <div className="stat-detail">
              <strong>{biggestCollapse.username}</strong> انهار بـ<strong>{biggestCollapse.diff}</strong> نقطة من الجولة الأولى للثالثة —
              بدأ قوي وانتهى... كده 😂
            </div>
          </div>
        )}

        {/* Lone genius */}
        {loneGenius && (
          <div className="stat-card" style={{ borderColor: "#f39c12" }}>
            <h3>💡 العبقري الوحيد</h3>
            <div className="match-display">
              <div className="teams">
                {loneGenius.match.home_team.flag_emoji} {loneGenius.match.home_team.name}
                <strong className="score">
                  {" "}{loneGenius.match.home_score} - {loneGenius.match.away_score}{" "}
                </strong>
                {loneGenius.match.away_team.flag_emoji} {loneGenius.match.away_team.name}
              </div>
              <div style={{ marginTop: "0.5rem" }}>
                <strong>{loneGenius.username}</strong> كان الوحيد من بين <strong>{loneGenius.total}</strong> لاعبين اللي توقّع الفائز الصحيح 🧠✨
              </div>
            </div>
          </div>
        )}

        {/* Counter-puncher */}
        {counterPuncher && counterPuncher.count > 0 && (
          <div className="stat-card">
            <h3>🥊 عكس التيار</h3>
            <div className="stat-detail">
              <strong>{counterPuncher.username}</strong> نجح في جمع نقاط بينما الأغلبية خسروا{" "}
              <strong>{counterPuncher.count}</strong> مرة — ما يمشي مع القطيع! 😎
            </div>
          </div>
        )}

        {/* Round by round breakdown */}
        {roundPoints && roundPoints.length > 0 && (
          <div className="stat-card" style={{ gridColumn: "1 / -1" }}>
            <h3>📅 النقاط جولة بجولة</h3>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "center", fontSize: "0.9rem" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #444" }}>
                    <th style={{ padding: "0.5rem", textAlign: "right" }}>اللاعب</th>
                    <th style={{ padding: "0.5rem" }}>الجولة 1</th>
                    <th style={{ padding: "0.5rem" }}>الجولة 2</th>
                    <th style={{ padding: "0.5rem" }}>الجولة 3</th>
                    <th style={{ padding: "0.5rem", fontWeight: "bold" }}>المجموع</th>
                  </tr>
                </thead>
                <tbody>
                  {roundPoints
                    .sort((a, b) => (b.byRound[1] + b.byRound[2] + b.byRound[3]) - (a.byRound[1] + a.byRound[2] + a.byRound[3]))
                    .map((rp) => {
                      const total = rp.byRound[1] + rp.byRound[2] + rp.byRound[3];
                      return (
                        <tr key={rp.username} style={{ borderBottom: "1px solid #333" }}>
                          <td style={{ padding: "0.5rem", textAlign: "right", fontWeight: "bold" }}>{rp.username}</td>
                          <td style={{ padding: "0.5rem" }}>{rp.byRound[1]}</td>
                          <td style={{ padding: "0.5rem" }}>{rp.byRound[2]}</td>
                          <td style={{ padding: "0.5rem" }}>{rp.byRound[3]}</td>
                          <td style={{ padding: "0.5rem", fontWeight: "bold", color: "#f1c40f" }}>{total}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Fun summary */}
        <div className="stat-card fun-fact" style={{ gridColumn: "1 / -1" }}>
          <h3>💬 خلاصة الدور الأول</h3>
          <div style={{ display: "grid", gap: "0.5rem" }}>
            <p>
              🎯 نسبة توقع الفائز الصحيح في الدور الأول:{" "}
              <strong>{accuracyRate}%</strong> — {accuracyRate >= 60 ? "مش بطالين! 👏" : accuracyRate >= 40 ? "عاديين 😐" : "قلة الحياء 😂"}
            </p>
            <p>
              ⚽ سُجِّل <strong>{totalGoals}</strong> هدف في <strong>{completedCount}</strong> مباراة — معدل{" "}
              <strong>{(totalGoals / completedCount).toFixed(1)}</strong> هدف للمباراة
            </p>
            <p>
              👥 عدد المشاركين: <strong>{totalGsPlayers}</strong> لاعبين —{" "}
              {gsLeader?.[0] && <>الأول <strong>{gsLeader[0]}</strong> والأخير <strong>{gsLastPlace?.[0]}</strong> 😅</>}
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
