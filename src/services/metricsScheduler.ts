// src/services/metricsScheduler.ts
import cron from 'node-cron';
import { calculateSiteProfit } from '../utils/calc';
import type { Database } from 'sqlite';

export function startMetricsScheduler(db: Database) {
  // 在每个小时的第 0 分钟触发
  cron.schedule('* * * * *', async () => {
    console.log('⏱️ Running hourly metrics calculation...');

    const sites: Array<{
      id: number;
      num_machines: number;
      power_rate: number;
    }> = await db.all('SELECT id, num_machines, power_rate FROM sites');

    for (const site of sites) {
      try {
        const result = await calculateSiteProfit({
          numMachines: site.num_machines,
          powerRate: site.power_rate
        });

        await db.run(
          `INSERT INTO site_metrics
             (site_id, kas_price, hourly_kas, revenue, cost, profit, unit_profit, network_hashrate)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          site.id,
          result.kas_price,
          result.hourly_kas,
          result.revenue,
          result.cost,
          result.profit,
          result.unit_profit,
          result.network_hashrate
        );
      } catch (err) {
        console.error(`Error calculating metrics for site ${site.id}:`, err);
      }
    }

    console.log('✅ Hourly metrics saved.');
  });
}
