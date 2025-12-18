/**
 * Audit script for Convenience Tier cost estimation
 *
 * Analyzes the ModelCostHistory table to verify that:
 * 1. Estimated costs match actual costs within acceptable margins
 * 2. Accumulated model costs are accurate
 * 3. Flow multipliers are learning correctly
 *
 * Usage: npx tsx scripts/audit-cost-estimation.ts [userId]
 */
import { config } from "dotenv";
import postgres from "postgres";

config({
  path: ".env.local",
});

const auditCostEstimation = async () => {
  if (!process.env.POSTGRES_URL) {
    throw new Error("POSTGRES_URL is not defined");
  }

  const sql = postgres(process.env.POSTGRES_URL);
  const userId = process.argv[2]; // Optional: filter by user

  console.log("\n🔍 CONVENIENCE TIER COST ESTIMATION AUDIT");
  console.log("=".repeat(60));

  try {
    // =========================================================================
    // 1. SUMMARY STATISTICS
    // =========================================================================
    console.log("\n📊 SUMMARY STATISTICS");
    console.log("-".repeat(60));

    const summary = await sql`
      SELECT 
        COUNT(*) as total_queries,
        SUM(estimated_cost::numeric) as total_estimated,
        SUM(actual_cost::numeric) as total_actual,
        SUM(actual_cost::numeric) - SUM(estimated_cost::numeric) as total_delta,
        AVG(actual_cost::numeric - estimated_cost::numeric) as avg_delta,
        AVG(CASE WHEN estimated_cost::numeric > 0 
            THEN ((actual_cost::numeric - estimated_cost::numeric) / estimated_cost::numeric) * 100 
            ELSE 0 END) as avg_delta_percent,
        MIN(created_at) as first_query,
        MAX(created_at) as last_query
      FROM "ModelCostHistory"
      ${userId ? sql`WHERE user_id = ${userId}` : sql``}
    `;

    const s = summary[0];
    console.log(`Total Queries:           ${s.total_queries}`);
    console.log(
      `Total Estimated:         $${Number(s.total_estimated ?? 0).toFixed(6)}`
    );
    console.log(
      `Total Actual:            $${Number(s.total_actual ?? 0).toFixed(6)}`
    );
    console.log(
      `Total Delta:             $${Number(s.total_delta ?? 0).toFixed(6)}`
    );
    console.log(
      `Avg Delta per Query:     $${Number(s.avg_delta ?? 0).toFixed(6)}`
    );
    console.log(
      `Avg Delta %:             ${Number(s.avg_delta_percent ?? 0).toFixed(2)}%`
    );
    console.log(`First Query:             ${s.first_query}`);
    console.log(`Last Query:              ${s.last_query}`);

    // =========================================================================
    // 2. BREAKDOWN BY FLOW TYPE
    // =========================================================================
    console.log("\n📈 BREAKDOWN BY FLOW TYPE");
    console.log("-".repeat(60));

    const byFlowType = await sql`
      SELECT 
        flow_type,
        COUNT(*) as queries,
        AVG(ai_call_count) as avg_ai_calls,
        SUM(estimated_cost::numeric) as total_estimated,
        SUM(actual_cost::numeric) as total_actual,
        AVG(estimated_cost::numeric) as avg_estimated,
        AVG(actual_cost::numeric) as avg_actual,
        AVG(CASE WHEN estimated_cost::numeric > 0 
            THEN ((actual_cost::numeric - estimated_cost::numeric) / estimated_cost::numeric) * 100 
            ELSE 0 END) as avg_delta_percent
      FROM "ModelCostHistory"
      ${userId ? sql`WHERE user_id = ${userId}` : sql``}
      GROUP BY flow_type
      ORDER BY queries DESC
    `;

    for (const ft of byFlowType) {
      console.log(`\n  ${ft.flow_type}:`);
      console.log(`    Queries:         ${ft.queries}`);
      console.log(
        `    Avg AI Calls:    ${Number(ft.avg_ai_calls ?? 0).toFixed(1)}`
      );
      console.log(
        `    Total Estimated: $${Number(ft.total_estimated ?? 0).toFixed(6)}`
      );
      console.log(
        `    Total Actual:    $${Number(ft.total_actual ?? 0).toFixed(6)}`
      );
      console.log(
        `    Avg Estimated:   $${Number(ft.avg_estimated ?? 0).toFixed(6)}`
      );
      console.log(
        `    Avg Actual:      $${Number(ft.avg_actual ?? 0).toFixed(6)}`
      );
      console.log(
        `    Avg Delta %:     ${Number(ft.avg_delta_percent ?? 0).toFixed(2)}%`
      );
    }

    // =========================================================================
    // 3. BREAKDOWN BY MODEL
    // =========================================================================
    console.log("\n🤖 BREAKDOWN BY MODEL");
    console.log("-".repeat(60));

    const byModel = await sql`
      SELECT 
        model_id,
        COUNT(*) as queries,
        AVG(ai_call_count) as avg_ai_calls,
        SUM(estimated_cost::numeric) as total_estimated,
        SUM(actual_cost::numeric) as total_actual,
        AVG(CASE WHEN estimated_cost::numeric > 0 
            THEN ((actual_cost::numeric - estimated_cost::numeric) / estimated_cost::numeric) * 100 
            ELSE 0 END) as avg_delta_percent
      FROM "ModelCostHistory"
      ${userId ? sql`WHERE user_id = ${userId}` : sql``}
      GROUP BY model_id
      ORDER BY queries DESC
    `;

    for (const m of byModel) {
      console.log(`\n  ${m.model_id}:`);
      console.log(`    Queries:         ${m.queries}`);
      console.log(
        `    Avg AI Calls:    ${Number(m.avg_ai_calls ?? 0).toFixed(1)}`
      );
      console.log(
        `    Total Estimated: $${Number(m.total_estimated ?? 0).toFixed(6)}`
      );
      console.log(
        `    Total Actual:    $${Number(m.total_actual ?? 0).toFixed(6)}`
      );
      console.log(
        `    Avg Delta %:     ${Number(m.avg_delta_percent ?? 0).toFixed(2)}%`
      );
    }

    // =========================================================================
    // 4. LEARNED MULTIPLIERS
    // =========================================================================
    console.log("\n⚖️  LEARNED FLOW MULTIPLIERS");
    console.log("-".repeat(60));

    const multipliers = await sql`
      SELECT 
        model_id,
        flow_type,
        multiplier,
        sample_count,
        last_updated
      FROM "FlowCostMultipliers"
      ORDER BY model_id, flow_type
    `;

    if (multipliers.length === 0) {
      console.log("  No multipliers learned yet (using defaults)");
    } else {
      for (const m of multipliers) {
        console.log(
          `  ${m.model_id} / ${m.flow_type}: ${Number(m.multiplier).toFixed(4)}x (${m.sample_count} samples)`
        );
      }
    }

    // =========================================================================
    // 5. ACCUMULATED MODEL COSTS (USER SETTINGS)
    // =========================================================================
    console.log("\n💰 ACCUMULATED MODEL COSTS");
    console.log("-".repeat(60));

    const userCosts = await sql`
      SELECT 
        u.email,
        us.tier,
        us.accumulated_model_cost,
        us.updated_at
      FROM "UserSettings" us
      JOIN "User" u ON u.id = us.user_id
      WHERE us.tier = 'convenience'
      ${userId ? sql`AND us.user_id = ${userId}` : sql``}
      ORDER BY us.accumulated_model_cost DESC
    `;

    if (userCosts.length === 0) {
      console.log("  No convenience tier users found");
    } else {
      for (const uc of userCosts) {
        console.log(
          `  ${uc.email ?? "Unknown"}: $${Number(uc.accumulated_model_cost ?? 0).toFixed(6)}`
        );
      }
    }

    // =========================================================================
    // 6. CROSS-CHECK: Accumulated vs History Sum
    // =========================================================================
    console.log("\n✅ CROSS-CHECK: Accumulated Cost vs History Sum");
    console.log("-".repeat(60));

    const crossCheck = await sql`
      SELECT 
        us.user_id,
        u.email,
        us.accumulated_model_cost as stored_accumulated,
        COALESCE(SUM(mch.actual_cost::numeric), 0) as sum_from_history
      FROM "UserSettings" us
      JOIN "User" u ON u.id = us.user_id
      LEFT JOIN "ModelCostHistory" mch ON mch.user_id::uuid = us.user_id
      WHERE us.tier = 'convenience'
      ${userId ? sql`AND us.user_id = ${userId}` : sql``}
      GROUP BY us.user_id, u.email, us.accumulated_model_cost
      ORDER BY us.accumulated_model_cost DESC
    `;

    let allMatch = true;
    for (const cc of crossCheck) {
      const stored = Number(cc.stored_accumulated ?? 0);
      const summed = Number(cc.sum_from_history ?? 0);
      const delta = stored - summed;
      const deltaPercent =
        summed > 0 ? ((delta / summed) * 100).toFixed(2) : "0";
      const status = Math.abs(delta) < 0.000_001 ? "✓" : "⚠️";

      if (Math.abs(delta) >= 0.000_001) {
        allMatch = false;
      }

      console.log(`\n  ${cc.email ?? "Unknown"}:`);
      console.log(`    Stored Accumulated:  $${stored.toFixed(6)}`);
      console.log(`    Sum from History:    $${summed.toFixed(6)}`);
      console.log(
        `    Delta:               $${delta.toFixed(6)} (${deltaPercent}%) ${status}`
      );
    }

    // =========================================================================
    // 7. RECENT QUERIES (Last 20)
    // =========================================================================
    console.log("\n📝 RECENT QUERIES (Last 20)");
    console.log("-".repeat(60));

    const recentQueries = await sql`
      SELECT 
        mch.created_at,
        mch.model_id,
        mch.flow_type,
        mch.estimated_cost,
        mch.actual_cost,
        mch.ai_call_count,
        u.email
      FROM "ModelCostHistory" mch
      LEFT JOIN "User" u ON u.id = mch.user_id::uuid
      ${userId ? sql`WHERE mch.user_id = ${userId}` : sql``}
      ORDER BY mch.created_at DESC
      LIMIT 20
    `;

    console.log(
      "  Time                 | Model           | Flow         | Est      | Actual   | AI Calls | Delta %"
    );
    console.log(`  ${"-".repeat(100)}`);
    for (const q of recentQueries) {
      const est = Number(q.estimated_cost ?? 0);
      const act = Number(q.actual_cost ?? 0);
      const deltaP = est > 0 ? (((act - est) / est) * 100).toFixed(1) : "N/A";
      const time = new Date(q.created_at)
        .toISOString()
        .slice(0, 19)
        .replace("T", " ");
      console.log(
        `  ${time} | ${(q.model_id ?? "").slice(0, 15).padEnd(15)} | ${(q.flow_type ?? "").padEnd(12)} | $${est.toFixed(5)} | $${act.toFixed(5)} | ${String(q.ai_call_count).padStart(8)} | ${deltaP}%`
      );
    }

    // =========================================================================
    // 8. OUTLIERS (Large Delta %)
    // =========================================================================
    console.log("\n⚠️  OUTLIERS (Delta > 50%)");
    console.log("-".repeat(60));

    const outliers = await sql`
      SELECT 
        created_at,
        model_id,
        flow_type,
        estimated_cost,
        actual_cost,
        ai_call_count,
        delta_percent
      FROM (
        SELECT 
          mch.created_at,
          mch.model_id,
          mch.flow_type,
          mch.estimated_cost,
          mch.actual_cost,
          mch.ai_call_count,
          CASE WHEN mch.estimated_cost::numeric > 0 
              THEN ((mch.actual_cost::numeric - mch.estimated_cost::numeric) / mch.estimated_cost::numeric) * 100 
              ELSE 0 END as delta_percent
        FROM "ModelCostHistory" mch
        ${userId ? sql`WHERE mch.user_id = ${userId}` : sql``}
      ) subq
      WHERE ABS(delta_percent) > 50
      ORDER BY ABS(delta_percent) DESC
      LIMIT 10
    `;

    if (outliers.length === 0) {
      console.log("  No significant outliers found! 🎉");
    } else {
      for (const o of outliers) {
        const deltaP = Number(o.delta_percent ?? 0).toFixed(1);
        console.log(
          `  ${o.model_id} / ${o.flow_type}: Est $${Number(o.estimated_cost ?? 0).toFixed(6)} -> Actual $${Number(o.actual_cost ?? 0).toFixed(6)} (${deltaP}%, ${o.ai_call_count} AI calls)`
        );
      }
    }

    // =========================================================================
    // FINAL VERDICT
    // =========================================================================
    console.log(`\n${"=".repeat(60)}`);
    console.log("📋 FINAL VERDICT");
    console.log("=".repeat(60));

    const totalQueries = Number(s.total_queries ?? 0);
    const avgDeltaPercent = Math.abs(Number(s.avg_delta_percent ?? 0));
    const totalDelta = Number(s.total_delta ?? 0);

    if (totalQueries === 0) {
      console.log(
        "\n⚠️  No cost history data found. Start using the app to generate data!"
      );
    } else {
      console.log(`\n  Total queries analyzed: ${totalQueries}`);
      console.log(`  Average estimation error: ${avgDeltaPercent.toFixed(2)}%`);
      console.log(
        `  Net delta (actual - estimated): $${totalDelta.toFixed(6)}`
      );

      if (avgDeltaPercent <= 20) {
        console.log(
          "\n  ✅ EXCELLENT: Cost estimation is highly accurate (<20% avg error)"
        );
      } else if (avgDeltaPercent <= 50) {
        console.log(
          "\n  ⚠️  ACCEPTABLE: Cost estimation is within reasonable bounds (20-50% avg error)"
        );
        console.log(
          "     The system will continue learning and improve over time."
        );
      } else {
        console.log(
          "\n  ❌ NEEDS ATTENTION: Cost estimation has high variance (>50% avg error)"
        );
        console.log("     Review the outliers above for patterns.");
      }

      if (totalDelta < 0) {
        console.log(
          `\n  💰 User was overcharged by $${Math.abs(totalDelta).toFixed(6)} total`
        );
        console.log(
          "     (Estimates were higher than actual costs - conservative)"
        );
      } else if (totalDelta > 0) {
        console.log(
          `\n  📉 Platform subsidized $${totalDelta.toFixed(6)} total`
        );
        console.log(
          "     (Estimates were lower than actual costs - multipliers will adapt)"
        );
      }

      if (allMatch) {
        console.log(
          "\n  ✅ Cross-check passed: Accumulated costs match history sum"
        );
      } else {
        console.log(
          "\n  ⚠️  Cross-check warning: Some accumulated costs differ from history sum"
        );
        console.log(
          "     This may be due to rounding or concurrent operations."
        );
      }
    }

    console.log("\n");
  } catch (error) {
    console.error("❌ Audit failed:", error);
    throw error;
  } finally {
    await sql.end();
  }
};

auditCostEstimation()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
