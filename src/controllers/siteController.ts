import { Request, Response } from 'express';
import { calculateSiteProfit } from '../utils/calc';
import { Site } from '../models/Site';

// export const getIndexPage = async (req: Request, res: Response): Promise<void> => {
//   const db = req.app.locals.db;

//   // 计算今天零点
//   const todayMidnight = new Date();
//   todayMidnight.setHours(0, 0, 0, 0);

//   // 取所有站点基础信息
//   const sites: Site[] = await db.all('SELECT * FROM sites');

//   // 按 site_id 聚合当天累计
//   const rows: Array<{
//     site_id: number;
//     hourly_kas_sum: number;
//     revenue_sum: number;
//     cost_sum: number;
//     profit_sum: number;
//   }> = await db.all(
//     `
//       SELECT
//         site_id,
//         SUM(hourly_kas) AS hourly_kas_sum,
//         SUM(revenue)    AS revenue_sum,
//         SUM(cost)       AS cost_sum,
//         SUM(profit)     AS profit_sum
//       FROM site_metrics
//       WHERE timestamp >= ?
//       GROUP BY site_id
//     `
//   );

//   // 将聚合结果映射到站点
//   const metricsMap = new Map<number, typeof rows[0]>();
//   rows.forEach(r => metricsMap.set(r.site_id, r));

//   const sitesWithMetrics = sites.map(site => {
//     const m = metricsMap.get(site.id) || {
//       site_id: site.id,
//       hourly_kas_sum: 0,
//       revenue_sum: 0,
//       cost_sum: 0,
//       profit_sum: 0
//     };
//     return {
//       ...site,
//       hourly_kas: m.hourly_kas_sum,
//       revenue: m.revenue_sum,
//       cost: m.cost_sum,
//       profit: m.profit_sum
//     };
//   });

//   // 最新一次网络算力
//   const last = await db.get(
//     `SELECT network_hashrate FROM site_metrics ORDER BY timestamp DESC LIMIT 1`
//   );
//   const networkHashrateTH = last ? last.network_hashrate : 'N/A';

//   res.render('index', {
//     sites: sitesWithMetrics,
//     networkHashrateTH,
//     updatedTime: new Date().toLocaleString()
//   });
// };

// src/controllers/siteController.ts


export const getIndexPage = async (req: Request, res: Response): Promise<void> => {
  const db = req.app.locals.db;

  // 1) 取所有站点基础信息
  const sites: Site[] = await db.all('SELECT * FROM sites');

  // 2) 聚合当天（本地时区）每站点累计
  const rawRows: any[] = await db.all(`
    SELECT
      site_id,
      SUM(hourly_kas) AS hourly_kas_sum,
      SUM(revenue)    AS revenue_sum,
      SUM(cost)       AS cost_sum,
      SUM(profit)     AS profit_sum
    FROM site_metrics
    WHERE timestamp >= datetime('now','localtime','start of day')
    GROUP BY site_id
  `);

  // 3) 构建一个 Map for quick lookup
  const metricsMap = new Map<number, {
    hourly_kas_sum: number;
    revenue_sum: number;
    cost_sum: number;
    profit_sum: number;
  }>();
  rawRows.forEach(r => {
    metricsMap.set(r.site_id, {
      hourly_kas_sum: r.hourly_kas_sum ?? 0,
      revenue_sum:    r.revenue_sum    ?? 0,
      cost_sum:       r.cost_sum       ?? 0,
      profit_sum:     r.profit_sum     ?? 0
    });
  });

  // 4) 合并基础信息与聚合数据
  const sitesWithMetrics = sites.map(site => {
    const m = metricsMap.get(site.id) || {
      hourly_kas_sum: 0,
      revenue_sum:    0,
      cost_sum:       0,
      profit_sum:     0
    };
    return {
      ...site,
      hourly_kas: m.hourly_kas_sum,
      revenue:    m.revenue_sum,
      cost:       m.cost_sum,
      profit:     m.profit_sum
    };
  });

  // 5) 拿最新网络算力
  const lastHash = await db.get(
    `SELECT network_hashrate FROM site_metrics ORDER BY timestamp DESC LIMIT 1`
  );
  const networkHashrateTH = lastHash?.network_hashrate ?? 'N/A';

  // 6) 渲染 admin 页面
  res.render('index', {
    sites: sitesWithMetrics,
    networkHashrateTH,
    updatedTime: new Date().toLocaleString()
  });
};


export const getSitePage = async (req: Request, res: Response): Promise<void> => {
  const db = req.app.locals.db;
  const location = req.params.location;
  console.log('🔍 [DEBUG] getSitePage for location:', location);

  // 1) 取基础信息
  const rawSite = await db.get(
    'SELECT * FROM sites WHERE name = ? COLLATE NOCASE',
    location
  );
  const siteFromDB = rawSite as Site | undefined;
  console.log('🔍 [DEBUG] siteFromDB:', siteFromDB);
  if (!siteFromDB) {
    res.status(404).send('Site not found');
    return;
  }

  // 2) 聚合当天累计数据（让 SQLite 自己计算本地今天零点）
  const rawM = await db.get(
    `
      SELECT
        SUM(hourly_kas) AS hourly_kas_sum,
        SUM(revenue)    AS revenue_sum,
        SUM(cost)       AS cost_sum,
        SUM(profit)     AS profit_sum
      FROM site_metrics
      WHERE site_id = ?
        AND timestamp >= datetime('now','localtime','start of day')
    `,
    siteFromDB.id
  );
  const m = rawM as {
    hourly_kas_sum: number | null;
    revenue_sum:    number | null;
    cost_sum:       number | null;
    profit_sum:     number | null;
  };
  console.log('🔍 [DEBUG] aggregated metrics m:', m);

  // 3) 组装要渲染的数据
  const siteData = {
    ...siteFromDB,
    daily_kas:     m.hourly_kas_sum ?? 0,
    daily_revenue: m.revenue_sum    ?? 0,
    daily_cost:    m.cost_sum       ?? 0,
    daily_profit:  m.profit_sum     ?? 0
  };
  console.log('🔍 [DEBUG] siteData:', siteData);

  // 4) 最新网络算力
  const rawLast = await db.get(
    `SELECT network_hashrate FROM site_metrics ORDER BY timestamp DESC LIMIT 1`
  );
  const last = rawLast as { network_hashrate: number } | undefined;
  console.log('🔍 [DEBUG] latest network_hashrate:', last);

  res.render('site', {
    site: siteData,
    networkHashrateTH: last?.network_hashrate ?? 'N/A',
    updatedTime: new Date().toLocaleString()
  });
};


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
