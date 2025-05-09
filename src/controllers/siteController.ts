import { Request, Response } from 'express';
import { Site } from '../models/Site';

export const getIndexPage = async (req: Request, res: Response): Promise<void> => {
  const db = req.app.locals.db as any;

  // 1) 取所有站点基础信息
  const sites = (await db.all('SELECT * FROM sites')) as Site[];

  // 2) 聚合当天累计
  const rawDaily = (await db.all(`
    SELECT
      site_id,
      SUM(revenue) AS revenue_sum,
      SUM(cost)    AS cost_sum,
      SUM(profit)  AS profit_sum
    FROM site_metrics
    WHERE timestamp >= datetime('now','localtime','start of day')
    GROUP BY site_id
  `)) as Array<{
    site_id: number;
    revenue_sum: number | null;
    cost_sum: number | null;
    profit_sum: number | null;
  }>;
  const dailyMap = new Map<number, { revenue_sum: number; cost_sum: number; profit_sum: number }>();
  rawDaily.forEach(r => {
    dailyMap.set(r.site_id, {
      revenue_sum: r.revenue_sum ?? 0,
      cost_sum:    r.cost_sum    ?? 0,
      profit_sum:  r.profit_sum  ?? 0
    });
  });

  // 3) 取最新一条指标（包括 unit_profit）
  const rawLatest = (await db.all(`
    SELECT
      site_id,
      kas_price,
      network_hashrate,
      hourly_kas,
      revenue    AS hourly_revenue,
      cost       AS hourly_cost,
      profit     AS hourly_profit,
      unit_profit
    FROM site_metrics
    WHERE (site_id, timestamp) IN (
      SELECT site_id, MAX(timestamp)
      FROM site_metrics
      GROUP BY site_id
    )
  `)) as Array<{
    site_id: number;
    kas_price: string;
    network_hashrate: number;
    hourly_kas: number;
    hourly_revenue: number;
    hourly_cost: number;
    hourly_profit: number;
    unit_profit: string;
  }>;
  const latestMap = new Map<number, typeof rawLatest[0]>();
  rawLatest.forEach(r => latestMap.set(r.site_id, r));

  // 4) 合并
  const sitesWithMetrics = sites.map(site => {
    const daily = dailyMap.get(site.id) || { revenue_sum: 0, cost_sum: 0, profit_sum: 0 };
    const latest = latestMap.get(site.id) || {
      site_id: site.id,
      kas_price: '-',
      network_hashrate: 0,
      hourly_kas: 0,
      hourly_revenue: 0,
      hourly_cost: 0,
      hourly_profit: 0,
      unit_profit: '0.00'
    };
    return {
      ...site,
      kas_price:          latest.kas_price,
      hourly_revenue:     latest.hourly_revenue,
      hourly_cost:        latest.hourly_cost,
      hourly_profit:      latest.hourly_profit,
      unit_profit:        parseFloat(latest.unit_profit),
      cumulative_revenue: daily.revenue_sum,
      cumulative_cost:    daily.cost_sum,
      cumulative_profit:  daily.profit_sum
    };
  });

  // 5) 全局最新网络算力
  const rawGlobal = await db.get(
    `SELECT network_hashrate FROM site_metrics ORDER BY timestamp DESC LIMIT 1`
  );
  const networkHashrateTH = rawGlobal?.network_hashrate ?? 'N/A';

  // 6) 渲染
  res.render('index', {
    sites: sitesWithMetrics,
    networkHashrateTH,
    updatedTime: new Date().toLocaleString(),
    user: req.user,
    error: req.query.error as string | undefined,
    success: req.query.success as string | undefined
  });
};

export const getSitePage = async (req: Request, res: Response): Promise<void> => {
  const db = req.app.locals.db as any;
  const location = req.params.location;

  // 基础信息
  const rawSite = await db.get(
    'SELECT * FROM sites WHERE name = ? COLLATE NOCASE',
    location
  );
  const siteFromDB = rawSite as Site | undefined;
  if (!siteFromDB) {
    res.status(404).send('Site not found');
    return;
  }

  // 当日累计
  const rawDaily = await db.get(
    `
      SELECT
        SUM(revenue) AS revenue_sum,
        SUM(cost)    AS cost_sum,
        SUM(profit)  AS profit_sum
      FROM site_metrics
      WHERE site_id = ?
        AND timestamp >= datetime('now','localtime','start of day')
    `,
    siteFromDB.id
  ) as { revenue_sum: number | null; cost_sum: number | null; profit_sum: number | null };
  const daily = {
    revenue_sum: rawDaily.revenue_sum ?? 0,
    cost_sum:    rawDaily.cost_sum    ?? 0,
    profit_sum:  rawDaily.profit_sum  ?? 0
  };

  // 最新小时指标
  const rawLatest = await db.get(
    `
      SELECT
        kas_price,
        network_hashrate,
        revenue    AS hourly_revenue,
        cost       AS hourly_cost,
        profit     AS hourly_profit,
        unit_profit
      FROM site_metrics
      WHERE site_id = ?
      ORDER BY timestamp DESC
      LIMIT 1
    `,
    siteFromDB.id
  ) as {
    kas_price: string;
    network_hashrate: number;
    hourly_revenue: number | null;
    hourly_cost: number | null;
    hourly_profit: number | null;
    unit_profit: string;
  };
  const latest = {
    kas_price:       rawLatest.kas_price,
    network_hashrate: rawLatest.network_hashrate,
    hourly_revenue:  rawLatest.hourly_revenue ?? 0,
    hourly_cost:     rawLatest.hourly_cost    ?? 0,
    hourly_profit:   rawLatest.hourly_profit  ?? 0,
    unit_profit:     parseFloat(rawLatest.unit_profit)
  };

  // 组装
  const siteData = {
    ...siteFromDB,
    kas_price:          latest.kas_price,
    hourly_revenue:     latest.hourly_revenue,
    hourly_cost:        latest.hourly_cost,
    hourly_profit:      latest.hourly_profit,
    unit_profit:        latest.unit_profit,
    cumulative_revenue: daily.revenue_sum,
    cumulative_cost:    daily.cost_sum,
    cumulative_profit:  daily.profit_sum
  };

  res.render('site', {
    site: siteData,
    networkHashrateTH: latest.network_hashrate,
    updatedTime: new Date().toLocaleString(),
    user: req.user,
    error: req.query.error as string | undefined,
    success: req.query.success as string | undefined
  });
};



// export const getSitePage = async (req: Request, res: Response): Promise<void> => {
//   const db = req.app.locals.db;
//   const location = req.params.location;
//   console.log('🔍 [DEBUG] getSitePage for location:', location);

//   // 1) 取基础信息
//   const rawSite = await db.get(
//     'SELECT * FROM sites WHERE name = ? COLLATE NOCASE',
//     location
//   );
//   const siteFromDB = rawSite as Site | undefined;
//   console.log('🔍 [DEBUG] siteFromDB:', siteFromDB);
//   if (!siteFromDB) {
//     res.status(404).send('Site not found');
//     return;
//   }

//   // 2) 聚合当天累计数据（让 SQLite 自己计算本地今天零点）
//   const rawM = await db.get(
//     `
//       SELECT
//         SUM(hourly_kas) AS hourly_kas_sum,
//         SUM(revenue)    AS revenue_sum,
//         SUM(cost)       AS cost_sum,
//         SUM(profit)     AS profit_sum
//       FROM site_metrics
//       WHERE site_id = ?
//         AND timestamp >= datetime('now','localtime','start of day')
//     `,
//     siteFromDB.id
//   );
//   const m = rawM as {
//     hourly_kas_sum: number | null;
//     revenue_sum:    number | null;
//     cost_sum:       number | null;
//     profit_sum:     number | null;
//   };
//   console.log('🔍 [DEBUG] aggregated metrics m:', m);

//   // 3) 组装要渲染的数据
//   const siteData = {
//     ...siteFromDB,
//     daily_kas:     m.hourly_kas_sum ?? 0,
//     daily_revenue: m.revenue_sum    ?? 0,
//     daily_cost:    m.cost_sum       ?? 0,
//     daily_profit:  m.profit_sum     ?? 0
//   };
//   console.log('🔍 [DEBUG] siteData:', siteData);

//   // 4) 最新网络算力
//   const rawLast = await db.get(
//     `SELECT network_hashrate FROM site_metrics ORDER BY timestamp DESC LIMIT 1`
//   );
//   const last = rawLast as { network_hashrate: number } | undefined;
//   console.log('🔍 [DEBUG] latest network_hashrate:', last);

//   res.render('site', {
//     site: siteData,
//     networkHashrateTH: last?.network_hashrate ?? 'N/A',
//     updatedTime: new Date().toLocaleString()
//   });
// };


// export const getSitePage = async (req: Request, res: Response): Promise<void> => {
//   const db = req.app.locals.db;
//   const location = req.params.location;

//   console.log('🔍 [DEBUG] getSitePage called for location:', location);

//   // 1) 取单站点基础信息
//   const siteFromDB: Site | undefined = await db.get(
//     'SELECT * FROM sites WHERE name = ? COLLATE NOCASE',
//     location
//   );
//   console.log('🔍 [DEBUG] siteFromDB:', siteFromDB);

//   if (!siteFromDB) {
//     console.error('❌ [DEBUG] Site not found in DB for:', location);
//     res.status(404).send('Site not found');
//     return;
//   }

//   // 2) 计算今天零点时间
//   const todayMidnight = new Date();
//   todayMidnight.setHours(0, 0, 0, 0);
//   console.log('🔍 [DEBUG] todayMidnight:', todayMidnight.toISOString());

//   // 3) 聚合当天累计
//   const m: {
//     hourly_kas_sum: number;
//     revenue_sum: number;
//     cost_sum: number;
//     profit_sum: number;
//   } = await db.get(
//     `
//       SELECT
//         SUM(hourly_kas) AS hourly_kas_sum,
//         SUM(revenue)    AS revenue_sum,
//         SUM(cost)       AS cost_sum,
//         SUM(profit)     AS profit_sum
//       FROM site_metrics
//       WHERE site_id = ?
//         AND timestamp >= ?
//     `,
//     siteFromDB.id,
//     // todayMidnight.toISOString()
//   );
//   console.log('🔍 [DEBUG] aggregated metrics m:', m);

//   // 4) 组装“日累计”属性
//   const siteData = {
//     ...siteFromDB,
//     daily_kas:     m.hourly_kas_sum || 0,
//     daily_revenue: m.revenue_sum    || 0,
//     daily_cost:    m.cost_sum       || 0,
//     daily_profit:  m.profit_sum     || 0
//   };
//   console.log('🔍 [DEBUG] siteData (to be sent to template):', siteData);

//   // 5) 拿最新一次网络算力（TH/s）
//   const last = await db.get(
//     `SELECT network_hashrate FROM site_metrics ORDER BY timestamp DESC LIMIT 1`
//   );
//   console.log('🔍 [DEBUG] latest network_hashrate record:', last);

//   const networkHashrateTH = last ? last.network_hashrate : 'N/A';

//   res.render('site', {
//     site: siteData,
//     networkHashrateTH,
//     updatedTime: new Date().toLocaleString()
//   });
// };


// export const getSitePage = async (req: Request, res: Response): Promise<void> => {
//   const db = req.app.locals.db;
//   const location = req.params.location;

//   // 找到该站点
//   const siteFromDB: Site | undefined = await db.get(
//     'SELECT * FROM sites WHERE name = ? COLLATE NOCASE',
//     location
//   );
//   if (!siteFromDB) {
//     res.status(404).send('Site not found');
//     return;
//   }

//   // 当日累计
//   const todayMidnight = new Date();
//   todayMidnight.setHours(0, 0, 0, 0);

//   const m: {
//     hourly_kas_sum: number;
//     revenue_sum: number;
//     cost_sum: number;
//     profit_sum: number;
//   } = await db.get(
//     `
//       SELECT
//         SUM(hourly_kas) AS hourly_kas_sum,
//         SUM(revenue)    AS revenue_sum,
//         SUM(cost)       AS cost_sum,
//         SUM(profit)     AS profit_sum
//       FROM site_metrics
//       WHERE site_id = ?
//         AND timestamp >= ?
//     `,
//     siteFromDB.id,
//     todayMidnight.toISOString()
//   );

//   const site = {
//     ...siteFromDB,
//     hourly_kas: m.hourly_kas_sum || 0,
//     revenue: m.revenue_sum || 0,
//     cost: m.cost_sum || 0,
//     profit: m.profit_sum || 0
//   };

//   const last = await db.get(
//     `SELECT network_hashrate FROM site_metrics ORDER BY timestamp DESC LIMIT 1`
//   );
//   const networkHashrateTH = last ? last.network_hashrate : 'N/A';

//   res.render('site', {
//     site,
//     networkHashrateTH,
//     updatedTime: new Date().toLocaleString()
//   });
// };

export const postAddSite = async (req: Request, res: Response): Promise<void> => {
  const db = req.app.locals.db;
  const { name, num_machines, machine_type, power_rate } = req.body;
  await db.run(
    'INSERT INTO sites (name, num_machines, machine_type, power_rate) VALUES (?, ?, ?, ?)',
    [name, num_machines, machine_type, power_rate]
  );
  res.redirect('/');
};

export const postUpdateSite = async (req: Request, res: Response): Promise<void> => {
  const db = req.app.locals.db;
  const user = req.user as {
    id: number;
    username: string;
    role: 'admin' | 'user';
    location?: string | null;
  };
  const locationParam = req.params.location;
  const { num_machines, power_rate } = req.body;

  // 普通用户只能修改自己
  // if (user.role === 'user' && user.location?.toLowerCase() !== locationParam.toLowerCase()) {
  //   res.status(403).send('Unauthorized Access');
  //   return;
  // }

  // 确认站点存在
  const exists = await db.get(
    'SELECT 1 FROM sites WHERE name = ? COLLATE NOCASE',
    locationParam
  );
  if (!exists) {
    res.status(404).send('Site not found');
    return;
  }

  await db.run(
    `UPDATE sites
       SET num_machines = ?, power_rate = ?
     WHERE name = ? COLLATE NOCASE`,
    num_machines,
    power_rate,
    locationParam
  );

  // 更新完成后重定向
  if (user.role === 'admin') {
    return res.redirect(`/`);
  }
  res.redirect(`/site/${user.location}`);
};
